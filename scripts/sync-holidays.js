// Checks this year's and next year's Jamaican public holidays against two
// independent sources and updates holidays-auto.js on its own.
//
// Safety rules:
//  - A holiday is only ADDED when BOTH sources list it, it's a weekday, and the
//    calculator doesn't already have it (e.g. a newly declared holiday).
//  - Nothing the law-based rules produce is ever removed automatically.
//  - If a source is down or looks incomplete, that year is left unchanged.
//  - More than 3 new holidays in one year is treated as bad data and skipped.
//  - Anything that disagrees but isn't safe to change is written to a report.
//
// Usage: node scripts/sync-holidays.js [--dry-run]
const fs = require('fs');
const path = require('path');
const H = require('../holidays.js');

const ROOT = path.join(__dirname, '..');
const AUTO_FILE = path.join(ROOT, 'holidays-auto.js');
const REPORT_FILE = path.join(ROOT, 'holiday-sync-report.md');
const DRY = process.argv.includes('--dry-run');
const MAX_ADDS_PER_YEAR = 3;
const GOOGLE_ICS = 'https://calendar.google.com/calendar/ical/en.jm%23holiday%40group.v.calendar.google.com/public/basic.ics';

function loadWindowFile(file, key) {
  const window = {};
  new Function('window', fs.readFileSync(file, 'utf8'))(window);
  return window[key] || {};
}
const isWeekday = (ds) => { const [y, m, d] = ds.split('-').map(Number); const g = new Date(y, m - 1, d).getDay(); return g !== 0 && g !== 6; };

async function getText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'jfb-tools-holiday-sync' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

// Source 1: Nager.Date  -> Map(date -> name)
async function fromNager(year) {
  const list = JSON.parse(await getText(`https://date.nager.at/api/v3/PublicHolidays/${year}/JM`));
  const out = new Map();
  for (const h of list) if (!h.types || h.types.includes('Public')) out.set(h.date, h.name || h.localName);
  return out;
}

// Source 2: Google public holiday calendar for Jamaica -> Map(year -> Map(date -> name))
async function fromGoogle() {
  const ics = (await getText(GOOGLE_ICS)).replace(/\r?\n[ \t]/g, '');
  const events = ics.split('BEGIN:VEVENT').slice(1).map((block) => {
    const get = (k) => { const m = block.match(new RegExp('^' + k + '[^:\\n]*:(.*)$', 'm')); return m ? m[1].trim() : ''; };
    const dt = get('DTSTART');
    return { date: `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`, name: get('SUMMARY'), desc: get('DESCRIPTION') };
  });
  const labelled = events.some((e) => /public holiday|observance/i.test(e.desc));
  const byYear = new Map();
  for (const e of events) {
    if (labelled && !/public holiday/i.test(e.desc)) continue;
    const y = Number(e.date.slice(0, 4));
    if (!byYear.has(y)) byYear.set(y, new Map());
    byYear.get(y).set(e.date, e.name);
  }
  return byYear;
}

async function main() {
  const manual = loadWindowFile(path.join(ROOT, 'holidays-extra.js'), 'JFB_HOLIDAY_CHANGES');
  const prevAuto = loadWindowFile(AUTO_FILE, 'JFB_HOLIDAY_AUTO');
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear + 1];

  let google = null, googleErr = '';
  try { google = await fromGoogle(); } catch (e) { googleErr = e.message; }

  // Keep previous auto entries from last year onwards; years we can verify get replaced below
  let auto = (prevAuto.add || []).filter((h) => Number(h.date.slice(0, 4)) >= thisYear - 1);
  const report = [], log = [];

  for (const y of years) {
    const base = H.buildYear(y, manual);
    let nager = null, nagerErr = '';
    try { nager = await fromNager(y); } catch (e) { nagerErr = e.message; }
    const g = google && google.get(y);
    const nagerOk = nager && nager.size >= 5, googleOk = g && g.size >= 5;
    log.push(`${y}: Nager ${nagerOk ? nager.size + ' holidays' : 'unavailable ' + nagerErr} | Google ${googleOk ? g.size + ' holidays' : 'unavailable ' + googleErr}`);
    if (!nagerOk || !googleOk) { log.push(`${y}: need both sources, leaving unchanged`); continue; }

    const agreed = [...nager.keys()].filter((d) => g.has(d) && isWeekday(d));
    const adds = agreed.filter((d) => !base[d]).map((d) => ({ date: d, name: nager.get(d) || g.get(d) }));

    if (adds.length > MAX_ADDS_PER_YEAR) {
      report.push(`- **${y}**: sources agree on ${adds.length} extra holidays, which looks wrong, so nothing was changed: ${adds.map((a) => a.date).join(', ')}`);
    } else {
      auto = auto.filter((h) => !h.date.startsWith(y + '-')).concat(adds);
      adds.forEach((a) => log.push(`${y}: add ${a.date} ${a.name}`));
    }
    // Informational only: rule-based weekday holidays neither source lists
    for (const d of Object.keys(base).filter(isWeekday)) {
      if (!nager.has(d) && !g.has(d)) report.push(`- **${d}** (${base[d]}): calculator has it, neither source lists it. Kept, since it comes from the law-based rules.`);
    }
  }

  auto.sort((a, b) => a.date.localeCompare(b.date));
  const body = `/* AUTO-GENERATED by .github/workflows/holiday-sync.yml — do not edit by hand.
 * Holidays that two independent sources agree on but the built-in rules
 * don't produce (e.g. a holiday declared by the Government).
 * For manual changes, use holidays-extra.js instead. */
window.JFB_HOLIDAY_AUTO = ${JSON.stringify({ add: auto }, null, 2)};
`;
  const changed = body !== fs.readFileSync(AUTO_FILE, 'utf8');
  console.log(log.join('\n'));
  console.log(changed ? 'holidays-auto.js: CHANGED' : 'holidays-auto.js: no change');
  if (report.length) console.log('Report:\n' + report.join('\n'));
  if (DRY) return;
  if (changed) fs.writeFileSync(AUTO_FILE, body);
  if (report.length) fs.writeFileSync(REPORT_FILE, '## Holiday sync notes\n\nNo action is needed unless something below looks wrong.\n\n' + report.join('\n') + '\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
