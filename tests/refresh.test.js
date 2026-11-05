const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const html = fs.readFileSync(require('node:path').join(__dirname, '../watch/index.html'), 'utf8');
const refreshCode = html.slice(html.indexOf('function refreshClock(){'), html.indexOf("if('serviceWorker' in navigator"));
function harness(oldDate, selectedDate = oldDate, followingToday = true, viewMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)) {
  const calls = [], listeners = {};
  let now = new Date(oldDate);
  const ctx = { lastToday: oldDate, selectedDate, followingToday, viewMonth, Date,
    S: { jamaicaToday: () => new Date(now) },
    sameDay: (a,b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(),
    renderAll: () => calls.push('all'), renderNow: () => calls.push('now'), renderForecast: () => calls.push('forecast'),
    setInterval: (fn) => { listeners.timer = fn; },
    document: { hidden: false, addEventListener: (name,fn) => { listeners[name] = fn; } },
    window: { addEventListener: (name,fn) => { listeners[name] = fn; } } };
  vm.createContext(ctx); vm.runInContext(refreshCode, ctx);
  return { ctx, calls, listeners, advance: d => { now = d; } };
}
const key = d => [d.getFullYear(),d.getMonth(),d.getDate()];
test('same day refreshes live cards without rebuilding the calendar', () => {
  const h = harness(new Date(2026,10,5)); h.listeners.timer();
  assert.deepEqual(h.calls,['now','forecast']);
});
test('midnight advances today and refreshes the full calendar', () => {
  const h = harness(new Date(2026,10,5)); h.advance(new Date(2026,10,6)); h.listeners.timer();
  assert.deepEqual(key(h.ctx.selectedDate),[2026,10,6]); assert.deepEqual(h.calls,['all']);
});
test('December rollover advances the displayed month and year', () => {
  const h = harness(new Date(2026,11,31)); h.advance(new Date(2027,0,1)); h.listeners.timer();
  assert.deepEqual(key(h.ctx.viewMonth),[2027,0,1]);
});
test('future selection and browsed month survive midnight', () => {
  const h = harness(new Date(2026,10,5),new Date(2027,1,12),false,new Date(2027,2,1));
  h.advance(new Date(2026,10,6)); h.listeners.timer();
  assert.deepEqual(key(h.ctx.selectedDate),[2027,1,12]); assert.deepEqual(key(h.ctx.viewMonth),[2027,2,1]);
  assert.deepEqual(h.calls,['all']);
});
test('returning from sleep catches up after multiple days', () => {
  const h = harness(new Date(2026,10,5)); h.advance(new Date(2026,10,9));
  h.ctx.document.hidden = true; h.listeners.visibilitychange(); assert.equal(h.calls.length,0);
  h.ctx.document.hidden = false; h.listeners.visibilitychange();
  assert.deepEqual(key(h.ctx.selectedDate),[2026,10,9]); assert.deepEqual(h.calls,['all']);
});
test('restoring a cached page also catches up', () => {
  const h = harness(new Date(2026,10,5)); h.advance(new Date(2026,10,6)); h.listeners.pageshow();
  assert.deepEqual(h.calls,['all']);
});
