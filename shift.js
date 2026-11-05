/* JFB shift rota — shared by the Shift Forecast page and the calendar builder.
 *
 * Four watches (A-D) rotate Day -> Evening -> Night -> Off, one step per day,
 * every day of the year (weekends and public holidays included).
 * Anchor: Fri 10 Jul 2026 — C=Day, D=Evening, A=Night, B=Off.
 * All times are Jamaica time (UTC-5, no daylight saving).
 *
 * Works in the browser (globals) and in Node (module.exports).
 */
(function (root) {
  var ANCHOR = { y: 2026, m: 6, d: 10 };
  var ANCHOR_SLOTS = { 0: 'C', 1: 'D', 2: 'A', 3: 'B' };
  var SLOT_NAMES = ['Day', 'Evening', 'Night', 'Off'];
  var SLOT_START = { Day: 7, Evening: 15, Night: 22 };
  var SLOT_HOURS = { Day: '07:00 – 15:00', Evening: '15:00 – 22:00', Night: '22:00 – 07:00 (next day)', Off: 'Off duty' };
  var TZ = 'America/Jamaica';

  function dayOffset(date) {
    var a = Date.UTC(ANCHOR.y, ANCHOR.m, ANCHOR.d);
    var b = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((b - a) / 86400000);
  }
  function slotsForDate(date) {
    var off = dayOffset(date), r = {};
    for (var i = 0; i < 4; i++) r[SLOT_NAMES[i]] = ANCHOR_SLOTS[((i - off) % 4 + 4) % 4];
    return r;
  }
  function watchSlotForDate(w, date) {
    var s = slotsForDate(date);
    for (var i = 0; i < SLOT_NAMES.length; i++) if (s[SLOT_NAMES[i]] === w) return SLOT_NAMES[i];
  }
  /* Start/end of a working slot that belongs to calendar date `date`. */
  function shiftTimes(date, slot) {
    var start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), SLOT_START[slot]);
    var end = new Date(start);
    if (slot === 'Day') end.setHours(15);
    else if (slot === 'Evening') end.setHours(22);
    else { end.setDate(end.getDate() + 1); end.setHours(7); }
    return { start: start, end: end };
  }
  /* "Now" as Jamaica wall-clock time, regardless of the device's time zone.
     The returned Date's local fields (getHours etc.) read as Jamaica time. */
  function jamaicaNow(real) {
    real = real || new Date();
    try {
      var p = {};
      new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(real).forEach(function (x) { p[x.type] = x.value; });
      return new Date(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    } catch (e) {
      var j = new Date(real.getTime() - 5 * 3600000); // fallback: fixed UTC-5
      return new Date(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate(), j.getUTCHours(), j.getUTCMinutes(), j.getUTCSeconds());
    }
  }
  function jamaicaToday(real) { var n = jamaicaNow(real); n.setHours(0, 0, 0, 0); return n; }

  /* Which watch is on duty at Jamaica wall time `now`. */
  function currentDuty(now) {
    var h = now.getHours(), eff = new Date(now); eff.setHours(0, 0, 0, 0);
    var slot = h >= 7 && h < 15 ? 'Day' : h >= 15 && h < 22 ? 'Evening' : 'Night';
    if (h < 7) eff.setDate(eff.getDate() - 1);
    return { slot: slot, watch: slotsForDate(eff)[slot], endsAt: shiftTimes(eff, slot).end };
  }
  /* Next shift of watch w that hasn't ended yet (may be in progress). */
  function nextShift(w, now, slotFilter) {
    var base = new Date(now); base.setHours(0, 0, 0, 0);
    for (var i = -1; i < 10; i++) {
      var d = new Date(base); d.setDate(d.getDate() + i);
      var slot = watchSlotForDate(w, d);
      if (slot === 'Off' || (slotFilter && slot !== slotFilter)) continue;
      var t = shiftTimes(d, slot);
      if (t.end > now) return { slot: slot, date: d, start: t.start, end: t.end, inProgress: t.start <= now };
    }
    return null;
  }
  /* Next shift start strictly after now. */
  function nextShiftStart(w, now) {
    var s = nextShift(w, now);
    if (s && s.inProgress) { var later = new Date(s.end); s = nextShift(w, later); }
    return s;
  }

  /* ---- Calendar (.ics) ---- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function icsLocal(d) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00'; }
  /* from: Date (calendar day), days: number; opts: { name, alarmMinutes, stamp } */
  function buildICS(w, from, days, opts) {
    opts = opts || {};
    var stamp = opts.stamp || '20260101T000000Z';
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//JFB Tools by Jay//Shift Forecast//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:' + (opts.name || 'JFB Watch ' + w + ' shifts'), 'X-WR-TIMEZONE:' + TZ,
      'REFRESH-INTERVAL;VALUE=DURATION:P1D', 'X-PUBLISHED-TTL:P1D',
      'BEGIN:VTIMEZONE', 'TZID:' + TZ, 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0500',
      'TZNAME:EST', 'END:STANDARD', 'END:VTIMEZONE'];
    for (var i = 0; i < days; i++) {
      var d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
      var slot = watchSlotForDate(w, d);
      if (slot === 'Off') continue;
      var t = shiftTimes(d, slot);
      L.push('BEGIN:VEVENT', 'UID:jfb-' + w + '-' + icsLocal(t.start) + '@jfbtools', 'DTSTAMP:' + stamp,
        'DTSTART;TZID=' + TZ + ':' + icsLocal(t.start), 'DTEND;TZID=' + TZ + ':' + icsLocal(t.end),
        'SUMMARY:Watch ' + w + ' — ' + slot + ' shift', 'DESCRIPTION:' + SLOT_HOURS[slot].replace(/–/g, '-'));
      if (opts.alarmMinutes) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + slot + ' shift starts soon',
        'TRIGGER:-PT' + opts.alarmMinutes + 'M', 'END:VALARM');
      L.push('END:VEVENT');
    }
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  var api = { SLOT_NAMES: SLOT_NAMES, SLOT_START: SLOT_START, SLOT_HOURS: SLOT_HOURS, slotsForDate: slotsForDate,
    watchSlotForDate: watchSlotForDate, shiftTimes: shiftTimes, jamaicaNow: jamaicaNow, jamaicaToday: jamaicaToday,
    currentDuty: currentDuty, nextShift: nextShift, nextShiftStart: nextShiftStart, buildICS: buildICS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JFBShift = api;
})(typeof window !== 'undefined' ? window : globalThis);
