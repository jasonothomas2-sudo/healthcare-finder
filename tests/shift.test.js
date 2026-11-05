// Run with: node --test tests/shift.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../shift.js');

// The original page logic, kept here to prove the shared file gives the same rota
const ANCHOR = new Date(2026, 6, 10), ANCHOR_SLOTS = { 0: 'C', 1: 'D', 2: 'A', 3: 'B' }, NAMES = ['Day', 'Evening', 'Night', 'Off'];
function oldSlots(date) {
  const off = Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(2026, 6, 10)) / 86400000);
  const r = {}; for (let i = 0; i < 4; i++) r[NAMES[i]] = ANCHOR_SLOTS[((i - off) % 4 + 4) % 4]; return r;
}

test('rota matches the original page for 2020-2040', () => {
  for (let d = new Date(2020, 0, 1); d < new Date(2041, 0, 1); d.setDate(d.getDate() + 1)) {
    assert.deepEqual(S.slotsForDate(d), oldSlots(d), d.toDateString());
  }
});
test('anchor day: C=Day, D=Evening, A=Night, B=Off', () => {
  assert.deepEqual(S.slotsForDate(new Date(2026, 6, 10)), { Day: 'C', Evening: 'D', Night: 'A', Off: 'B' });
});
test('each watch cycles Day -> Evening -> Night -> Off', () => {
  const seq = [0, 1, 2, 3, 4].map((i) => S.watchSlotForDate('C', new Date(2026, 6, 10 + i)));
  assert.deepEqual(seq, ['Day', 'Evening', 'Night', 'Off', 'Day']);
});
test('on duty at 03:00 is the Night crew that started the previous evening', () => {
  const duty = S.currentDuty(new Date(2026, 6, 11, 3, 0));
  assert.equal(duty.slot, 'Night');
  assert.equal(duty.watch, 'A'); // A started Night on 10 Jul at 22:00
  assert.equal(duty.endsAt.getHours(), 7);
});
test('next shift is time-aware: after the Day shift ends it moves on', () => {
  // 10 Jul 2026: C is on Day 07-15. At 16:00 the next C Day shift is 4 days later.
  const n = S.nextShift('C', new Date(2026, 6, 10, 16, 0), 'Day');
  assert.equal(n.date.getDate(), 14);
  const during = S.nextShift('C', new Date(2026, 6, 10, 9, 0), 'Day');
  assert.equal(during.inProgress, true);
});
test('night shift in progress after midnight is found', () => {
  const n = S.nextShift('A', new Date(2026, 6, 11, 2, 0));
  assert.equal(n.slot, 'Night'); assert.equal(n.inProgress, true); assert.equal(n.date.getDate(), 10);
});
test('Jamaica time is used regardless of the device time zone', () => {
  // 2026-07-10 03:30 UTC is 22:30 on 9 Jul in Jamaica
  const j = S.jamaicaNow(new Date(Date.UTC(2026, 6, 10, 3, 30)));
  assert.deepEqual([j.getDate(), j.getHours(), j.getMinutes()], [9, 22, 30]);
});
test('calendar file: Jamaica time zone, reminders, no Off days', () => {
  const ics = S.buildICS('C', new Date(2026, 6, 10), 8, { alarmMinutes: 60 });
  assert.match(ics, /DTSTART;TZID=America\/Jamaica:20260710T070000/);
  assert.match(ics, /DTEND;TZID=America\/Jamaica:20260713T070000/); // Night 12th ends 07:00 13th
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 6);
  assert.equal((ics.match(/TRIGGER:-PT60M/g) || []).length, 6);
});
