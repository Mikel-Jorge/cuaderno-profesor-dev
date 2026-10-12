const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class Sheet {
  constructor(rows) { this.rows = rows.map(row => row.slice()); }
  getLastRow() { return this.rows.length; }
  getRange(r, c, nr, nc) {
    const sheet = this;
    return {
      getValues() { return Array.from({ length: nr }, (_, i) =>
        Array.from({ length: nc }, (_, j) => sheet.rows[r - 1 + i]?.[c - 1 + j] ?? '')); },
      setValues(values) { values.forEach((row, i) => row.forEach((v, j) => {
        while (sheet.rows.length < r + i) sheet.rows.push([]);
        sheet.rows[r - 1 + i][c - 1 + j] = v;
      })); },
      clearContent() { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
        if (sheet.rows[r - 1 + i]) sheet.rows[r - 1 + i][c - 1 + j] = '';
      } },
    };
  }
  hideSheet() {}
}
const sheets = {
  students: new Sheet([['Apellidos', 'Nombre', 'Grupo', 'Email', 'REACA', 'Medidas', 'ID'],
    ['Pérez', 'Ana', 'DAM2A', 'old@example.test', true, 'Medidas', 'A'],
    ['López', 'Luis', 'DAM 2A', '', false, '', 'L']]),
  roster: new Sheet([['alumno_id', 'curso', 'grupo', 'activo'],
    ['A', '2026-2027', 'DAM 2A', true], ['L', '2026-2027', 'DAM 2A', true]]),
  enrollment: new Sheet([['A', 'P', true, 'MANUAL']]),
};
const book = { getSheetByName(name) { return sheets[name] || null; },
  insertSheet(name) { return (sheets[name] = new Sheet([])); },
  deleteSheet(sheet) { for (const key of Object.keys(sheets)) if (sheets[key] === sheet) delete sheets[key]; } };
let uuid = 0;
const config = { course: '2026-2027', tutor: true, group: 'DAM2A' };
const ctx = vm.createContext({
  CP: { SHEETS: { STUDENTS: 'students', TUTOR_ROSTER: 'roster', CONFIG: 'config' },
    CONFIG_KEYS: { ACADEMIC_YEAR: 'course', IS_TUTOR: 'tutor', TUTOR_GROUP: 'group', CONTACTS_SYNC_COURSE: 'marker' } },
  CP_STUDENT_HEADERS: ['Apellidos', 'Nombre', 'Grupo', 'Email', 'REACA', 'Medidas', 'ID'],
  SpreadsheetApp: { getActiveSpreadsheet: () => book },
  Utilities: { getUuid: () => `id-${++uuid}` },
  isTutorEnabled_: v => v === true,
  getGeneralConfigValues_: () => ({ ...config }),
  getEnrollmentStudents_: () => sheets.students.rows.slice(1).filter(row => row[0]).map((row, i) => ({
    rowNumber: i + 2, surname: row[0], name: row[1], group: row[2], email: row[3], id: row[6],
  })),
  ensureSheetSize_: (sheet, rows) => { while (sheet.rows.length < rows) sheet.rows.push([]); },
  getOrCreateSheet_: (_, name) => sheets[name] || book.insertSheet(name),
  installManagedSheetProtections_: () => {},
  isValidContactEmail_: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  normalizeContactEmail_: v => String(v || '').trim().toLowerCase(),
});
for (const file of ['EducaTutorBiff.gs', 'TutorRoster.gs', 'EducaTutorImport.gs']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
}
const makeReport = names => ({ group: 'DAM 2A', students: names.map(([surname, name]) => ({
  surname, name, key: ctx.tutorStudentKey_(surname, name, 'DAM 2A'),
})) });
const report = makeReport([['Pérez', 'Ana'], ['López', 'Luis'], ['Sanz', 'Javi']]);
const enrollmentBefore = JSON.stringify(sheets.enrollment.rows);
const plan = ctx.buildTutorImportPlan_(book, report);
assert.strictEqual(plan[0].email, 'old@example.test');
assert.strictEqual(plan[1].email, '');
assert.strictEqual(plan[2].email, '');
assert.throws(() => ctx.validateTutorEmails_(plan, JSON.stringify({ [plan[0].key]: 'new@example.test' })), /lista/);
const input = Object.fromEntries(plan.map((student, index) => [student.key,
  ['new@example.test', 'luis@example.test', 'javi@example.test'][index]]));
const emails = ctx.validateTutorEmails_(plan, JSON.stringify(input));
const ids = ctx.applyTutorStudents_(book, plan, emails);
ctx.applyTutorRoster_(book, report, config.course, ids);
assert.deepStrictEqual(sheets.students.rows[1].slice(3), ['new@example.test', true, 'Medidas', 'A']);
assert.strictEqual(sheets.students.rows[3][6], 'id-1');
assert.strictEqual(ctx.getActiveTutorRoster_(book, config).length, 3);
assert.strictEqual(JSON.stringify(sheets.enrollment.rows), enrollmentBefore);
const next = makeReport([['Pérez', 'Ana'], ['Sanz', 'Javi']]);
const nextPlan = ctx.buildTutorImportPlan_(book, next);
ctx.applyTutorRoster_(book, next, config.course,
  Object.fromEntries(nextPlan.map(row => [row.key, row.studentId])));
assert.strictEqual(ctx.getActiveTutorRoster_(book, config).length, 2);
assert.strictEqual(sheets.roster.rows.find(row => row[0] === 'L')[3], false);
assert.strictEqual(JSON.stringify(sheets.enrollment.rows), enrollmentBefore);
config.group = 'SMR 1A';
assert.strictEqual(ctx.getActiveTutorRoster_(book, config).length, 0);
ctx.clearTutorRosterForNewCourse_();
assert.strictEqual(ctx.readTutorRosterRows_(book).length, 0);
const localXls = '_local_testdata/rptALMPorGrupo.xls';
if (fs.existsSync(localXls)) {
  const real = ctx.parseTutorEducaFile_({ getBytes: () => [...fs.readFileSync(localXls)] });
  sheets.students.rows = [sheets.students.rows[0]];
  sheets.roster.rows = [sheets.roster.rows[0]];
  config.group = real.group;
  const realPlan = ctx.buildTutorImportPlan_(book, real);
  const realEmails = ctx.validateTutorEmails_(realPlan, JSON.stringify(Object.fromEntries(
    realPlan.map((student, index) => [student.key, `student${index}@example.test`]))));
  const realIds = ctx.applyTutorStudents_(book, realPlan, realEmails);
  ctx.applyTutorRoster_(book, real, config.course, realIds);
  assert.strictEqual(ctx.getActiveTutorRoster_(book, config).length, real.students.length);
  assert.strictEqual(JSON.stringify(sheets.enrollment.rows), enrollmentBefore);
  console.log(`Real Tutor XLS academic pipeline: ${real.sheetCount} sheet; group ${real.group}; ${real.students.length} students; no PII printed`);
}
// The final call reparses the file and commits academic data before the optional People step.
sheets.students.rows = [sheets.students.rows[0],
  ['Pérez', 'Ana', 'DAM2A', 'old@example.test', true, 'Medidas', 'A']];
sheets.roster.rows = [sheets.roster.rows[0]];
config.group = 'DAM2A';
const one = makeReport([['Pérez', 'Ana']]);
ctx.parseTutorEducaFile_ = () => one;
ctx.LockService = { getDocumentLock: () => ({ tryLock: () => true, releaseLock() {} }) };
ctx.saveGeneralConfig_ = values => Object.assign(config, values);
ctx.createOrRepairStudentsSheet_ = () => {};
ctx.executeContactsSync_ = () => ({ incidents: 0 });
ctx.updateConfigValues_ = (_, values) => { config.marker = values.marker; };
book.toast = () => {};
const finalEmails = JSON.stringify({ [one.students[0].key]: 'final@example.test' });
const academic = ctx.importarAlumnadoTutoria({ archivo: {}, emails: finalEmails });
assert.strictEqual(academic.imported, 1);
assert.strictEqual(config.group, 'DAM 2A');
assert.strictEqual(config.marker, config.course);
assert.strictEqual(sheets.students.rows[1][3], 'final@example.test');
assert.strictEqual(JSON.stringify(sheets.enrollment.rows), enrollmentBefore);
const beforeMismatch = JSON.stringify(sheets.students.rows);
ctx.parseTutorEducaFile_ = () => ({ ...one, group: 'SMR 1A' });
assert.throws(() => ctx.analizarArchivoTutorEduca({ archivo: {} }), /SMR 1A/);
assert.strictEqual(JSON.stringify(sheets.students.rows), beforeMismatch);
ctx.parseTutorEducaFile_ = () => one;
ctx.executeContactsSync_ = () => { throw new Error('People unavailable'); };
const warning = ctx.importarAlumnadoTutoria({ archivo: {}, emails: finalEmails });
assert.strictEqual(warning.contactsWarning, true);
assert.strictEqual(JSON.stringify(sheets.enrollment.rows), enrollmentBefore);
console.log('Tutor emails, identity, roster, reimport, annual reset and matrícula isolation: ok');
