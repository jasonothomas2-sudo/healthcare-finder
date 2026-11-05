/* One-off public holiday changes for the Leave Calculator.
 *
 * Regular holidays (including Sunday -> Monday moves) are worked out
 * automatically in holidays.js. Only edit this file when the Government
 * announces something that the normal rules don't cover.
 *
 *  add:    a holiday that isn't normally there
 *          { date: 'YYYY-MM-DD', name: 'Name shown to users' }
 *  remove: a date that should NOT be a holiday after all
 *          'YYYY-MM-DD'
 *
 * To MOVE a holiday, remove the old date and add the new one.
 * Remove old entries whenever you like; past years don't matter.
 */
window.JFB_HOLIDAY_CHANGES = {
  add: [
    // { date: '2027-03-15', name: 'National Day of Mourning' },
  ],
  remove: [
    // '2027-05-24',
  ],
};
