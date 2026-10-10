const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync('Students.gs', 'utf8'), context);
const normalize = context.normalizeStudentReacaValue_;
assert.strictEqual(normalize(true), true);
assert.strictEqual(normalize(false), false);
assert.strictEqual(normalize('TRUE'), true);
assert.strictEqual(normalize(' false '), false);
assert.strictEqual(normalize(''), false);
assert.strictEqual(normalize(null), false);
assert.strictEqual(normalize('REACA'), null);
assert.strictEqual(normalize(1), null);
const source = fs.readFileSync('Students.gs', 'utf8');
assert.ok(source.includes('.insertCheckboxes()'));
assert.ok(source.includes("row.slice(0, 3).every"));
const studentRows = [
  ['Abad', 'Ana', 'DAM 2A', '', false, '', ''],
  ['Sin grupo', 'Eva', '', '', false, '', ''],
  ['Sanz', 'Luis', 'Online', '', false, '', 'old-id'],
];
let groupRule;
let cleared = false;
context.CP = { SHEETS: { STUDENTS: 'students', SCHEDULE_ACTIVITIES: 'activities' } };
context.Utilities = { getUuid: () => 'new-id' };
context.normalizeScheduleText_ = value => String(value || '').trim();
context.normalizeScheduleActivityCategory_ = value => String(value || '').trim().toUpperCase();
context.SpreadsheetApp = { newDataValidation: () => ({
  requireValueInList(groups, dropdown) { groupRule = { groups, dropdown }; return this; },
  setAllowInvalid(value) { groupRule.allowInvalid = value; return this; },
  build() { return groupRule; },
}) };
const studentSheet = { getLastRow: () => 4, getMaxRows: () => 201,
  getRange(row, column) {
    if (column === 7) return { setValue: value => { studentRows[row - 2][6] = value; } };
    if (column === 3) return { setDataValidation: rule => { groupRule = rule; },
      clearDataValidations: () => { cleared = true; } };
    return { getValues: () => studentRows };
  } };
let activities = [['id', 'MODULO', '', '', '', ' DAM 2A '],
  ['id2', 'MODULO', '', '', '', 'Online'], ['id3', 'MODULO', '', '', '', 'DAM 2A'],
  ['id4', 'REUNION', '', '', '', 'Ignorar']];
const activitiesSheet = { getLastRow: () => activities.length + 1,
  getRange: () => ({ getValues: () => activities.map(row => row.slice(1)) }) };
const book = { getSheetByName: name => name === 'students' ? studentSheet : activitiesSheet };
assert.strictEqual(context.ensureStudentIdsForValidRows_(book), 1);
assert.strictEqual(studentRows[0][6], 'new-id');
assert.strictEqual(studentRows[1][6], '');
assert.strictEqual(studentRows[2][6], 'old-id');
context.syncStudentGroupValidation_(book);
assert.deepStrictEqual(Array.from(groupRule.groups), ['DAM 2A', 'Online']);
assert.strictEqual(groupRule.allowInvalid, true);
activities = [];
context.syncStudentGroupValidation_(book);
assert.strictEqual(cleared, true);
console.log('REACA checkbox normalization and valid-row checks passed');
