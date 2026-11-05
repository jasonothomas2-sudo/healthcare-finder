// Run with: node --test tests/holidays.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../holidays.js');

const dates = (y) => Object.keys(H.buildYear(y, {})).sort();
const nameOn = (ds) => H.buildYear(Number(ds.slice(0, 4)), {})[ds];

test('ordinary year: 2026 has the standard ten holidays on their dates', () => {
  assert.deepEqual(dates(2026), [
    '2026-01-01', '2026-02-18', '2026-04-03', '2026-04-06', '2026-05-23',
    '2026-08-01', '2026-08-06', '2026-10-19', '2026-12-25', '2026-12-26',
  ]);
});

// Past years that were officially observed on the following weekday
test('2021: Labour Day and Emancipation Day on Sunday -> Monday', () => {
  assert.equal(nameOn('2021-05-24'), 'Labour Day (observed)');
  assert.equal(nameOn('2021-08-02'), 'Emancipation Day (observed)');
  assert.equal(nameOn('2021-05-23'), undefined);
});
test('2022: Christmas on Sunday -> observed Tuesday 27th, Boxing Day stays Monday', () => {
  assert.equal(nameOn('2022-12-26'), 'Boxing Day');
  assert.equal(nameOn('2022-12-27'), 'Christmas Day (observed)');
});
test('2023: New Year\'s Day on Sunday -> Monday 2 January', () => {
  assert.equal(nameOn('2023-01-02'), "New Year's Day (observed)");
});

// Upcoming tricky years
test('2027: Labour, Emancipation and Boxing Day all move to Monday', () => {
  assert.equal(nameOn('2027-05-24'), 'Labour Day (observed)');
  assert.equal(nameOn('2027-08-02'), 'Emancipation Day (observed)');
  assert.equal(nameOn('2027-12-27'), 'Boxing Day (observed)');
  assert.equal(nameOn('2027-12-25'), 'Christmas Day'); // Saturday: not moved
});
test('2028: Independence Day on Sunday -> Monday 7 August', () => {
  assert.equal(nameOn('2028-08-07'), 'Independence Day (observed)');
});
test('2033: Christmas on Sunday -> Tuesday 27th', () => {
  assert.equal(nameOn('2033-12-26'), 'Boxing Day');
  assert.equal(nameOn('2033-12-27'), 'Christmas Day (observed)');
});
test('2034: New Year\'s and Independence Day move to Monday', () => {
  assert.equal(nameOn('2034-01-02'), "New Year's Day (observed)");
  assert.equal(nameOn('2034-08-07'), 'Independence Day (observed)');
});

test('Easter-based holidays are correct for known years', () => {
  assert.equal(H.isoDate(H.easterSunday(2025)), '2025-04-20');
  assert.equal(H.isoDate(H.easterSunday(2026)), '2026-04-05');
  assert.equal(H.isoDate(H.easterSunday(2027)), '2027-03-28');
});

test('every year 2000-2100: ten holidays, none on a Sunday, no duplicates lost', () => {
  for (let y = 2000; y <= 2100; y++) {
    const map = H.buildYear(y, {});
    assert.equal(Object.keys(map).length, 10, `year ${y}`);
    for (const ds of Object.keys(map)) {
      const [yy, mm, dd] = ds.split('-').map(Number);
      assert.notEqual(new Date(yy, mm - 1, dd).getDay(), 0, `${ds} ${map[ds]} is a Sunday`);
    }
  }
});

test('one-off changes: add and remove', () => {
  const map = H.buildYear(2027, {
    add: [{ date: '2027-03-15', name: 'National Day of Mourning' }],
    remove: ['2027-05-24'],
  });
  assert.equal(map['2027-03-15'], 'National Day of Mourning');
  assert.equal(map['2027-05-24'], undefined);
  assert.equal(H.buildYear(2028, { add: [{ date: '2027-03-15', name: 'x' }] })['2027-03-15'], undefined);
});
