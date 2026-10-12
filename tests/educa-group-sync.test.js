const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({
  CP: { SHEETS: { STUDENTS: '3 Alumnado', SCHEDULE_ACTIVITIES: '_HOR_ACTIVIDADES' },
    CONFIG_KEYS: { IS_TUTOR: 'es_tutor', TUTOR_GROUP: 'grupo_tutoria' } },
  CP_SCHEDULE_HEADERS: { ACTIVITIES: Array(8) },
  normalizeScheduleActivityCategory_: value => value,
  getModuleDisplayName_: activity => activity.acronym + ' · ' + activity.group,
});
['Matriculas.gs', 'EducaImport.gs', 'Students.gs'].forEach(file =>
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file }));

const sourceGroup = 'ASIR - VIRTUAL';
const activity = { id: 'M', category: 'MODULO', name: 'Gestión de bases de datos',
  acronym: 'GBD', group: 'ASIR Online', color: '#888888', classroom: 'Aula 1' };
const student = { id: 'S', rowNumber: 2, surname: 'Apellido Uno', name: 'Ana',
  group: 'ASIR Online', email: 'ana@example.invalid', reaca: true, measures: 'Medida' };
const imported = { surname: student.surname, name: student.name, group: sourceGroup };
const block = { key: 'GBD\n' + sourceGroup, subject: activity.name,
  group: sourceGroup, variants: 1, students: [imported] };
const activityRows = [['M', 'MODULO', activity.name, activity.acronym, 'ONLINE',
  activity.group, activity.classroom, activity.color]];
const studentRows = [[student.surname, student.name, student.group, student.email,
  student.reaca, student.measures, student.id]];
let writes = 0;
let groupValidation = null;
function table(rows) {
  return { getLastRow: () => rows.length + 1, getMaxRows: () => 201,
    getRange(start, column, height, width) {
      return {
        getValues: () => rows.slice(start - 2, start - 2 + height)
          .map(row => row.slice(column - 1, column - 1 + width)),
        setValues(values) {
          values.forEach((line, index) => line.forEach((value, offset) => {
            rows[start - 2 + index][column - 1 + offset] = value;
          }));
          writes++;
        },
        setDataValidation(validation) { groupValidation = validation; },
        clearDataValidations() { groupValidation = null; },
      };
    } };
}
const activitiesSheet = table(activityRows);
const studentsSheet = table(studentRows);
const sheets = new Map();
function managed(id, name) {
  const sheet = { getSheetId: () => id, getName: () => name,
    setName(next) { sheets.delete(name); name = next; sheets.set(name, sheet); } };
  sheets.set(name, sheet);
  return sheet;
}
const config = managed(10, '4 Config GBD · ASIR Online');
const tracking = managed(11, '5 Seg GBD · ASIR Online');
const evaluation = managed(12, '6 Eval GBD · ASIR Online');
const byId = { 10: config, 11: tracking, 12: evaluation };
const book = { getSheetByName(name) {
  if (name === '_HOR_ACTIVIDADES') return activitiesSheet;
  if (name === '3 Alumnado') return studentsSheet;
  return sheets.get(name) || null;
} };
context.readModuleConfigRegistry_ = () => [{ activityId: 'M', sheetId: 10,
  trackingSheetId: 11, evaluationSheetId: 12 }];
context.getSheetById_ = (_book, id) => byId[id];
context.getEnrollmentStudents_ = () => studentRows.map((row, index) => ({
  id: row[6], rowNumber: index + 2, surname: row[0], name: row[1],
  group: row[2], email: row[3], reaca: row[4], measures: row[5],
}));
context.getGeneralConfigValues_ = () => ({});
context.isTutorEnabled_ = () => false;
context.normalizeScheduleText_ = value => String(value || '').trim();
context.SpreadsheetApp = { newDataValidation: () => ({
  requireValueInList(list) { this.list = list; return this; },
  setAllowInvalid(value) { this.allowInvalid = value; return this; },
  build() { return { list: this.list, allowInvalid: this.allowInvalid }; },
}) };
const plan = context.buildEducaImportPlan_([block], {}, [activity], [student], [], {});
assert.equal(plan.blocks[0].groupWillUpdate, true);
assert.equal(plan.summary.groupUpdates, 1);
assert.equal(writes, 0); // Preview no modifica hojas.
const changes = context.prepareEducaModuleGroupChanges_(book, plan);
assert.equal(writes, 0);
context.syncEducaExistingStudentGroups_(book, plan);
context.applyEducaModuleGroupChanges_(changes);
context.syncStudentGroupValidation_(book);
assert.equal(activityRows[0][5], sourceGroup);
assert.equal(studentRows[0][2], sourceGroup);
assert.equal(studentRows[0][3], student.email);
assert.equal(studentRows[0][4], true);
assert.equal(studentRows[0][5], 'Medida');
assert.equal(studentRows[0][6], student.id);
assert.equal(activityRows[0][0], activity.id);
assert.equal(activityRows[0][4], 'ONLINE');
assert.equal(activityRows[0][6], activity.classroom);
assert.equal(activityRows[0][7], activity.color);
assert.deepEqual(JSON.parse(JSON.stringify(groupValidation.list)), [sourceGroup]);
assert.equal(groupValidation.allowInvalid, true);
assert.equal(config.getName(), '4 Config GBD · ' + sourceGroup);
assert.equal(tracking.getName(), '5 Seg GBD · ' + sourceGroup);
assert.equal(evaluation.getName(), '6 Eval GBD · ' + sourceGroup);
const occupied = managed(99, '4 Config GBD · ASIR Online');
assert.equal(occupied.getSheetId(), 99);
const reverseBlock = { ...block, key: activity.name + '\nASIR Online', group: 'ASIR Online',
  students: [{ ...imported, group: 'ASIR Online' }] };
assert.throws(() => context.prepareEducaModuleGroupChanges_(book,
  context.buildEducaImportPlan_([reverseBlock], {}, [{ ...activity, group: sourceGroup }],
    [{ ...student, group: sourceGroup }], [], {})), /Ya existe una hoja/);
console.log('EDUCA group update preserves IDs, managed sheets and student fields: ok');
