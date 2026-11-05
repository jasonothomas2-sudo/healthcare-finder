// Builds subscribable calendars, one per watch: calendar/watch-A.ics ... watch-D.ics
// Window: from the 1st of last month to 12 months ahead, so it only changes once a month.
// Run by the weekly workflow; users subscribe once and their calendar stays filled.
const fs = require('fs');
const path = require('path');
const S = require('../shift.js');

const today = S.jamaicaToday();
const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
const to = new Date(today.getFullYear(), today.getMonth() + 13, 1);
const days = Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86400000);

const dir = path.join(__dirname, '..', 'calendar');
fs.mkdirSync(dir, { recursive: true });
for (const w of ['A', 'B', 'C', 'D']) {
  const ics = S.buildICS(w, from, days, { name: 'JFB Watch ' + w + ' shifts', alarmMinutes: 60 });
  fs.writeFileSync(path.join(dir, 'watch-' + w + '.ics'), ics);
}
console.log(`Calendars built: ${from.toDateString()} for ${days} days`);
