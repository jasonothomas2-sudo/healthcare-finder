/* Jamaican public holidays — computed by rule for any year.
 *
 * Rules:
 *  - Fixed-date holidays: New Year's Day, Labour Day, Emancipation Day,
 *    Independence Day, Christmas Day, Boxing Day.
 *  - When a fixed-date holiday falls on a SUNDAY, the next weekday that is not
 *    already a holiday is the public holiday instead (e.g. Christmas on Sunday
 *    -> Boxing Day stays Monday, Christmas is observed Tuesday).
 *    Saturday holidays are not moved.
 *  - Easter-based holidays (Ash Wednesday, Good Friday, Easter Monday) and
 *    National Heroes Day (3rd Monday in October) never fall on a Sunday.
 *  - One-off changes (declared holidays, official moves) come from
 *    holidays-extra.js, which is applied last.
 *
 * Works in the browser (globals) and in Node (module.exports) for tests.
 */
(function (root) {
  function isoDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function easterSunday(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }
  function thirdMondayOct(y) { var d = new Date(y, 9, 1); var off = (8 - d.getDay()) % 7; return new Date(y, 9, 1 + off + 14); }

  /* changes: { add:[{date,name}], remove:['YYYY-MM-DD'] } — defaults to holidays-extra.js */
  function buildYear(y, changes) {
    var easter = easterSunday(y), map = {};
    // Holidays that are never on a Sunday
    map[isoDate(addDays(easter, -46))] = "Ash Wednesday";
    map[isoDate(addDays(easter, -2))] = "Good Friday";
    map[isoDate(addDays(easter, 1))] = "Easter Monday";
    map[isoDate(thirdMondayOct(y))] = "National Heroes Day";
    // Fixed dates, in calendar order so Christmas is placed before Boxing Day
    var fixed = [[0, 1, "New Year's Day"], [4, 23, "Labour Day"], [7, 1, "Emancipation Day"],
                 [7, 6, "Independence Day"], [11, 25, "Christmas Day"], [11, 26, "Boxing Day"]];
    var sundays = [];
    fixed.forEach(function (f) {
      var d = new Date(y, f[0], f[1]);
      if (d.getDay() === 0) sundays.push([d, f[2]]); else map[isoDate(d)] = f[2];
    });
    // Sunday holidays: observed on the next weekday that is free
    sundays.forEach(function (s) {
      var d = addDays(s[0], 1);
      while (d.getDay() === 0 || d.getDay() === 6 || map[isoDate(d)]) d = addDays(d, 1);
      map[isoDate(d)] = s[1] + ' (observed)';
    });
    // One-off changes: automatic (holidays-auto.js) first, then manual (holidays-extra.js) wins
    var lists = changes ? [changes] : [root.JFB_HOLIDAY_AUTO || {}, root.JFB_HOLIDAY_CHANGES || {}];
    lists.forEach(function (c) {
      (c.remove || []).forEach(function (ds) { if (ds.slice(0, 4) === String(y)) delete map[ds]; });
      (c.add || []).forEach(function (h) { if (h.date.slice(0, 4) === String(y)) map[h.date] = h.name; });
    });
    return map;
  }

  var cache = {};
  function holidaysForYear(y) { return cache[y] || (cache[y] = buildYear(y)); }
  function holidayName(d) { return holidaysForYear(d.getFullYear())[isoDate(d)] || null; }

  var api = { isoDate: isoDate, addDays: addDays, easterSunday: easterSunday, buildYear: buildYear,
              holidaysForYear: holidaysForYear, holidayName: holidayName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else for (var k in api) root[k] = api[k];
})(typeof window !== 'undefined' ? window : globalThis);
