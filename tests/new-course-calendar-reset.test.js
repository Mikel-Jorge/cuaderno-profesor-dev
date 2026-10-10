const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const sheets = { types: {}, evaluations: {}, dates: {}, dateTypes: {} };
const spreadsheet = {
  getSheetByName(name) { return sheets[name]; },
  getSpreadsheetTimeZone() { return 'Europe/Madrid'; },
};
const context = {
  CP: { SHEETS: { CALENDAR_TYPES: 'types', CALENDAR_EVALUATIONS: 'evaluations',
    CALENDAR_DATES: 'dates', CALENDAR_DATE_TYPES: 'dateTypes' } },
  SpreadsheetApp: { getActiveSpreadsheet() { return spreadsheet; } },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('Calendar.gs', 'utf8'), context);
context.assertCalendarStructureReady_ = () => {};
context.validateAcademicYear_ = () => {};
context.buildDefaultCalendarEventsForAcademicYear_ = () => [];
context.hideTechnicalSheets_ = () => {};
context.readCalendarTableRows_ = sheet => sheet === sheets.evaluations ? [
  ['FP1-1', 'FP1', 1, 'Primera', '2026-12-01'],
  ['FP2-1', 'FP2', 1, 'Primera', '2026-12-02'],
  ['ONLINE-1', 'ONLINE', 1, 'Primera', '2026-12-03'],
  ['CE-1', 'CE', 1, 'Primera', '2026-12-04'],
] : [];
const written = new Map();
context.writeCalendarTable_ = (sheet, headers, rows) => written.set(sheet, rows);
context.resetCalendarForNewCourse_('2026-2027');

const evaluations = written.get(sheets.evaluations);
assert.strictEqual(evaluations.length, 0);
assert(written.get(sheets.types).every(row => row[2] === false && row.slice(3).every(value => value === '')));
console.log('new course clears annual evaluations while retaining teaching types: ok');
