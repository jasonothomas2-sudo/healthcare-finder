// Finds a map location for every town in data.js and writes towns.js,
// which the Provider Finder uses for "Near me" / "Nearest first".
//
// - Kingston postal districts aren't searchable place names, so their
//   approximate area centres are set in KNOWN below.
// - Everything else is looked up on OpenStreetMap (Nominatim), politely:
//   one request per second, results cached in towns.js so each town is
//   only looked up once.
// - A result is only accepted if OpenStreetMap puts it in the same parish
//   (Kingston and St. Andrew count as one) and within 45 km of the parish
//   centre; otherwise that town falls back to the parish centre in the app.
// - Spelling variants ("Spalding P.O.", "Yallahs Main Road", "Unit 13, Kingston 6")
//   reuse the plain town's location.
//
// Usage: node scripts/geocode-towns.js   (run by .github/workflows/geocode-towns.yml)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'towns.js');
const window = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8').replace('const DATA', 'window.DATA'))(window);
const DATA = window.DATA;

// Must match townKey() in index.html
const townKey = (town, parish) => (town || '').toLowerCase().replace(/[^a-z0-9]+/g, '') + '|' + parish;

const PARISH_CENTERS = {
  'Kingston': [17.9712, -76.7928], 'St. Andrew': [18.0179, -76.8099], 'St. Catherine': [18.0364, -77.0564],
  'Clarendon': [17.9557, -77.2405], 'Manchester': [18.0417, -77.5071], 'St. Elizabeth': [18.0788, -77.6994],
  'Westmoreland': [18.2944, -78.1564], 'Hanover': [18.4098, -78.1336], 'St. James': [18.4762, -77.8939],
  'Trelawny': [18.3526, -77.6078], 'St. Ann': [18.4045, -77.1031], 'St. Mary': [18.3093, -76.8998],
  'Portland': [18.1761, -76.4509], 'St. Thomas': [17.9700, -76.4332],
};

// Kingston postal districts and other names a map search can't place
const KNOWN = {
  'kingston|Kingston': [17.9686, -76.7936],           // Downtown Kingston
  'downtown|Kingston': [17.9686, -76.7936],
  '|Kingston': [17.9686, -76.7936],
  'kingston|St. Andrew': [18.0120, -76.7960],
  'kingston2|St. Andrew': [17.9790, -76.7830], 'kingston2|Kingston': [17.9790, -76.7830],
  'kingston3|St. Andrew': [17.9840, -76.7700], 'kingston3|Kingston': [17.9840, -76.7700],
  'kingston4|St. Andrew': [17.9780, -76.8000], 'kingston4|Kingston': [17.9780, -76.8000],
  'kingston5|St. Andrew': [18.0170, -76.7840],          // New Kingston / Hope Road
  'kingston6|St. Andrew': [18.0280, -76.7700],          // Liguanea / Barbican
  'kingston7|St. Andrew': [18.0080, -76.7470],          // Mona / UHWI
  'kingston8|St. Andrew': [18.0400, -76.7950],          // Constant Spring / Manor Park
  'kingston10|St. Andrew': [18.0130, -76.7970],         // Half Way Tree / Cross Roads
  'kingston11|St. Andrew': [17.9950, -76.8250],         // Waterhouse / Seaview
  'kingston13|St. Andrew': [17.9930, -76.8100],
  'kingston14|St. Andrew': [17.9740, -76.8150],
  'kingston16|St. Andrew': [17.9670, -76.7550],
  'kingston17|St. Andrew': [17.9500, -76.7250],         // Harbour View / Bull Bay
  'kingston19|St. Andrew': [18.0400, -76.8200],         // Meadowbrook / Red Hills Road
  'kingston20|St. Andrew': [18.0250, -76.8300],         // Washington Boulevard / Duhaney Park
  'rosehall|St. James': [18.5060, -77.8240],
  'barnetttechpark|St. James': [18.4640, -77.9040],    // Montego Bay
  // Listing has these in the wrong parish or spelt differently; use the real town
  'linstead|Clarendon': [18.1366, -77.0304],            // Linstead (St. Catherine)
  'greaterportmore|St. Andrew': [17.9415, -76.9065],    // Greater Portmore (St. Catherine)
  'spalding|Clarendon': [18.1560, -77.4565],            // Spaldings
  'frankfield|Clarendon': [18.1440, -77.3680],
};
// Town name with post-office / road suffixes removed
const cleanTown = (t) => (t || '').replace(/\bp\.?\s*o\.?\s*$/i, '').replace(/\bmain\s+road\s*$/i, '').replace(/^.*,\s*/, '').trim();
const parishNorm = (p) => (p || '').toLowerCase().replace(/saint/g, 'st').replace(/parish/g, '').replace(/[^a-z]/g, '')
  .replace(/^kingston$/, 'kingstonstandrew').replace(/^standrew$/, 'kingstonstandrew');

function km(a, b) {
  const R = 6371, r = (x) => (x * Math.PI) / 180;
  const dLat = r(b[0] - a[0]), dLon = r(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lookup(q) {
  const url = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=jm&q=' + encodeURIComponent(q);
  const res = await fetch(url, { headers: { 'User-Agent': 'jfb-tools-provider-finder (github.com/jasonothomas2-sudo/healthcare-finder)' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return (await res.json()).map((r) => ({ ll: [Number(Number(r.lat).toFixed(4)), Number(Number(r.lon).toFixed(4))],
    parish: (r.address && (r.address.state || r.address.county)) || '' }));
}

async function main() {
  let cache = {};
  if (fs.existsSync(OUT)) { const w = {}; new Function('window', fs.readFileSync(OUT, 'utf8'))(w); cache = w.JFB_TOWNS || {}; }

  const wanted = new Map();
  for (const d of DATA) { const k = townKey(d.c, d.p); if (!wanted.has(k)) wanted.set(k, { town: (d.c || '').trim(), parish: d.p }); }

  const out = {}, log = [];
  for (const [k, { town, parish }] of wanted) {
    if (KNOWN[k]) { out[k] = KNOWN[k]; continue; }
    const kd = town.toLowerCase().match(/kingston\s*(\d+)/);
    if (kd && KNOWN['kingston' + kd[1] + '|St. Andrew']) { out[k] = KNOWN['kingston' + kd[1] + '|St. Andrew']; continue; }
    if (cache[k]) { out[k] = cache[k]; continue; }
    if (!town) continue;
    const base = cleanTown(town), bk = townKey(base, parish);
    if (bk !== k && (KNOWN[bk] || out[bk] || cache[bk])) { out[k] = KNOWN[bk] || out[bk] || cache[bk]; continue; }
    const centre = PARISH_CENTERS[parish];
    let found = null;
    for (const q of [`${base}, ${parish}, Jamaica`, `${base}, Jamaica`]) {
      try {
        const hits = await lookup(q);
        const h = hits.find((x) => (!x.parish || parishNorm(x.parish) === parishNorm(parish)) && (!centre || km(x.ll, centre) <= 45));
        found = h ? h.ll : null;
      } catch (e) { log.push(`${k}: lookup failed (${e.message})`); }
      await sleep(1100);
      if (found) break;
    }
    if (found) { out[k] = found; log.push(`${k}: ${found.join(', ')}`); }
    else log.push(`${k}: not found, parish centre will be used`);
  }

  const keys = Object.keys(out).sort();
  const body = '/* AUTO-GENERATED by .github/workflows/geocode-towns.yml from data.js.\n'
    + ' * Approximate map location of each town (town|parish -> [lat, lon]) for "Near me".\n'
    + ' * Kingston postal districts are set by hand in scripts/geocode-towns.js. */\n'
    + 'window.JFB_TOWNS = {\n' + keys.map((k) => `  ${JSON.stringify(k)}: [${out[k].join(', ')}]`).join(',\n') + '\n};\n';
  fs.writeFileSync(OUT, body);
  console.log(log.join('\n'));
  console.log(`towns.js: ${keys.length} of ${wanted.size} town/parish pairs placed`);
}
main().catch((e) => { console.error(e); process.exit(1); });
