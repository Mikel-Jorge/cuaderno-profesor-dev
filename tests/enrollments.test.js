const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({
  console: { warn() {} },
  CP: { SHEETS: { STUDENTS: '3 Alumnado', ENROLLMENTS: '_MATRICULAS',
    ENROLLMENT_META: '_MATRICULAS_META' } },
  SpreadsheetApp: { getActiveSpreadsheet: () => book },
  LockService: { getDocumentLock: () => ({ tryLock: () => true, releaseLock() {} }) },
});
['Matriculas.gs', 'EducaImport.gs', 'Evaluation.gs'].forEach(file =>
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file }));
const ana = { id: 'A', rowNumber: 2, surname: 'Apellido Uno', name: 'Ana', group: 'DAM 2A',
  email: 'existing@example.invalid', reaca: true, measures: 'Tiempo extra' };
const javi = { id: 'J', rowNumber: 3, surname: 'Apellido Dos', name: 'Javi', group: 'DAM 2A',
  email: '', reaca: false, measures: '' };
const other = { id: 'X', rowNumber: 4, surname: 'Apellido Tres', name: 'Xavi', group: 'DAM 2B' };
const acda = { id: 'ACDA', category: 'MODULO', name: 'Acceso a datos', acronym: 'ACDA', group: 'DAM 2A' };
const pmdm = { id: 'PMDM', category: 'MODULO', name: 'Programación multimedia', acronym: 'PMDM', group: 'DAM 2A' };
const pmdmB = { id: 'PMDM-B', category: 'MODULO', name: 'Programación multimedia', acronym: 'PMDM', group: 'DAM 2B' };
const tutor = { id: 'T', category: 'TUTORIA', name: 'Tutoría', group: 'DAM 2A' };
const modules = [acda, pmdm, pmdmB];
context.getScheduleActivities_ = () => [...modules, tutor];
assert.deepEqual(Array.from(context.getModuleActivitiesForEnrollment_().map(item => item.id)),
  ['ACDA', 'PMDM', 'PMDM-B']);
const block = (subject, students, group = 'DAM 2A') => ({
  key: subject + '\n' + group, subject, group, variants: 1, students,
});
const blocks = [block('Acceso a datos', [ana]), block('Programación multimedia', [ana, javi])];
const plan = context.buildEducaImportPlan_(blocks, {}, modules, [ana, javi], [], {});
assert.equal(plan.summary.modules, 2);
assert.equal(plan.summary.newStudents, 0);
assert.equal(plan.summary.existingStudents, 2);
assert.equal(plan.summary.deactivations, 1); // Javi deja ACDA, no PMDM.
assert.equal(plan.blocks[0].activityId, 'ACDA');
assert.equal(plan.blocks[1].activityId, 'PMDM');
assert.equal(plan.blocks[1].candidates.some(item => item.id === 'PMDM-B'), true);
assert.equal(ana.email, 'existing@example.invalid');
assert.equal(ana.reaca, true);
assert.equal(ana.measures, 'Tiempo extra');
const crossGroupPlan = context.buildEducaImportPlan_(blocks,
  { [blocks[0].key]: 'PMDM-B' }, modules, [ana, javi], [], {});
assert.equal(crossGroupPlan.blocks[0].groupMismatch, true);
assert.equal(crossGroupPlan.summary.manualDifferentGroups, 1);
assert.throws(() => context.buildEducaImportPlan_(blocks,
  { [blocks[0].key]: 'PMDM', [blocks[1].key]: 'PMDM' }, modules, [ana, javi], [], {}), /mismo módulo/);
assert.equal(context.buildEducaImportPlan_(blocks, {}, modules, [ana, javi], [], {})
  .summary.detectedStudents, 2);
const repeated = context.buildEducaImportPlan_([block('Programación multimedia', [ana])],
  {}, modules, [ana, javi], [
    { studentId: 'A', activityId: 'PMDM', active: true },
    { studentId: 'J', activityId: 'PMDM', active: true },
  ], { PMDM: true });
assert.equal(repeated.summary.deactivations, 1);
assert.equal(repeated.summary.newStudents, 0);
assert.throws(() => context.buildEducaImportPlan_(blocks, {}, modules,
  [ana, { ...ana, id: 'A-duplicate' }], [], {}), /dos alumnos/);
const virtual = { id: 'V', rowNumber: 5, surname: 'Apellido Cuatro', name: 'Vera', group: 'ASIR - VIRTUAL' };
const virtualModule = { id: 'ASIR', category: 'MODULO', name: 'Gestión de bases de datos',
  acronym: 'GBD', group: 'ASIR Online' };
const virtualBlock = block('Gestión de bases de datos', [virtual], 'ASIR - VIRTUAL');
const virtualPlan = context.buildEducaImportPlan_([virtualBlock], {},
  [virtualModule, ...modules], [virtual], [], {});
assert.equal(virtualPlan.blocks[0].activityId, 'ASIR');
assert.equal(virtualPlan.blocks[0].groupMismatch, false);
assert.equal(virtualPlan.blocks[0].candidates[0].id, 'ASIR');
assert.equal(context.normalizeEnrollmentGroupHint_('DAM 2A'), context.normalizeEnrollmentGroupHint_('DAM2A'));
assert.equal(context.normalizeEnrollmentGroupHint_('DAM-2A'), context.normalizeEnrollmentGroupHint_('DAM2A'));
assert.equal(context.normalizeEnrollmentGroupHint_('ASIR Online'),
  context.normalizeEnrollmentGroupHint_('ASIR - VIRTUAL'));
const compactGroup = { ...acda, group: 'DAM2A' };
assert.equal(context.buildEducaImportPlan_([block('Acceso a datos', [ana])], {},
  [compactGroup], [ana], [], {}).blocks[0].activityId, 'ACDA');
const existingCompact = { ...ana, group: 'DAM2A' };
const equivalentIdentityPlan = context.buildEducaImportPlan_([block('Acceso a datos', [ana])], {},
  [compactGroup], [existingCompact], [], {});
assert.equal(equivalentIdentityPlan.summary.newStudents, 0);
assert.equal(equivalentIdentityPlan.summary.existingStudents, 1);
assert.equal(existingCompact.group, 'DAM2A');
const differentGroup = { id: 'SMR', category: 'MODULO', name: 'Acceso a datos',
  acronym: 'SMR', group: 'SMR 1A' };
const differentPlan = context.buildEducaImportPlan_([block('Acceso a datos', [ana])], {},
  [differentGroup], [ana], [], {});
assert.equal(differentPlan.blocks[0].activityId, '');
assert.equal(differentPlan.blocks[0].candidates[0].id, 'SMR');
assert.equal(context.buildEducaImportPlan_([block('Acceso a datos', [ana])],
  { [block('Acceso a datos', [ana]).key]: 'SMR' }, [differentGroup], [ana], [], {})
  .summary.manualDifferentGroups, 1);

let students = [ana, javi, other], rows = [], modes = {}, saved;
const book = {};
context.getModuleActivitiesForEnrollment_ = () => modules;
context.getEnrollmentStudents_ = () => students;
context.readEnrollmentRows_ = () => rows;
context.readEnrollmentModes_ = () => modes;
context.ensureEnrollmentStructure_ = () => {};
context.writeEnrollmentState_ = (_book, nextRows, nextModes) => {
  saved = { rows: nextRows, modes: nextModes }; rows = nextRows; modes = nextModes;
};
const syncedEvaluations = [];
context.repairEvaluationsForActivities_ = ids => syncedEvaluations.push(...ids);
assert.throws(() => context.saveModuleEnrollments({ activityId: 'ACDA', studentIds: ['X'] }),
  /no disponible/);
assert.throws(() => context.saveModuleEnrollments({ activityId: 'T', studentIds: [] }),
  /módulo válido/);
context.saveModuleEnrollments({ activityId: 'ACDA', studentIds: ['A'] });
assert.deepEqual(syncedEvaluations, ['ACDA']);
assert.equal(saved.modes.ACDA, true);
assert.deepEqual(Array.from(saved.rows.filter(row => row.activityId === 'ACDA')
  .map(row => [row.studentId, row.active, row.origin])),
[['A', true, 'EDUCA_XLS'], ['J', false, 'MANUAL']]);
context.saveModuleEnrollments({ activityId: 'PMDM', studentIds: [] });
assert.equal(modes.PMDM, true);
assert.equal(rows.filter(row => row.activityId === 'PMDM' && row.active).length, 0);
rows = rows.filter(row => row.activityId !== 'PMDM').concat([
  { studentId: 'A', activityId: 'PMDM', active: true, origin: 'EDUCA_XLS' },
  { studentId: 'J', activityId: 'PMDM', active: true, origin: 'EDUCA_XLS' },
]);
context.saveModuleEnrollments({ activityId: 'PMDM', studentIds: ['A'] });
assert.equal(rows.find(row => row.activityId === 'PMDM' && row.studentId === 'A').origin,
  'EDUCA_XLS');
assert.deepEqual(JSON.parse(JSON.stringify(rows.find(row => row.activityId === 'PMDM' &&
  row.studentId === 'J'))),
{ studentId: 'J', activityId: 'PMDM', active: false, origin: 'MANUAL' });
const beforeFailedSave = JSON.stringify(rows);
context.repairEvaluationsForActivities_ = () => { throw new Error('Eval no disponible'); };
assert.throws(() => context.saveModuleEnrollments({ activityId: 'PMDM', studentIds: ['A', 'J'] }),
  /Eval no disponible/);
assert.equal(JSON.stringify(rows), beforeFailedSave);
context.repairEvaluationsForActivities_ = ids => syncedEvaluations.push(...ids);
students = [ana, javi, other, virtual];
rows.push({ studentId: 'V', activityId: 'ACDA', active: true, origin: 'EDUCA_XLS' });
assert.equal(context.getModuleEnrollmentManagerData_().candidatesByModule.ACDA.includes(5), true);
context.saveModuleEnrollments({ activityId: 'ACDA', studentIds: ['A', 'V'] });
assert.equal(rows.find(row => row.activityId === 'ACDA' && row.studentId === 'V').active, true);
students = [ana, javi, other];
rows = rows.filter(row => row.studentId !== 'V');
context.saveModuleEnrollments({ activityId: 'ACDA', studentIds: ['A'] });
assert.equal(rows.filter(row => row.activityId === 'ACDA').length, 2);
context.getEvaluationStudents_ = () => [
  ...students.filter(student => student.group === 'DAM 2A')
    .map(student => ({ id: student.id, surname: student.surname,
      name: student.name, group: student.group, measures: student.measures })),
];
assert.deepEqual(Array.from(context.getStudentsForModuleActivity_(book, acda).map(item => item.id)), ['A']);
students = [{ ...ana, group: 'DAM 2B' }, javi, other];
assert.deepEqual(Array.from(context.getStudentsForModuleActivity_(book, acda).map(item => item.id)), ['A']);
students = [ana, javi, other];
modes = {}; // Legacy: todo el grupo continúa activo.
assert.deepEqual(Array.from(context.getStudentsForModuleActivity_(book, acda).map(item => item.id)), ['A', 'J']);
modes = { ACDA: true };
const evalRows = context.buildEvaluationStudentRows_(
  [[javi.surname, javi.name, '', '8', 'J']],
  [['', '', '', '', '']], [['', '', 'Nota histórica', '', '']],
  context.getStudentsForModuleActivity_(book, acda), 5, [4]);
assert.equal(evalRows.additions, 1);
assert.equal(evalRows.items.find(item => item.id === 'J').inactive, true);
assert.equal(evalRows.items.find(item => item.id === 'J').values[3], '8');
assert.equal(evalRows.items.find(item => item.id === 'J').notes[2], 'Nota histórica');
assert.equal(evalRows.items.find(item => item.id === 'A').inactive, false);
const html = fs.readFileSync('UiDialogMatriculas.html', 'utf8');
assert.match(html, /checkbox\.checked=explicit\?selected\[student\.id\]===true:true/);
assert.match(fs.readFileSync('NewCourse.gs', 'utf8'), /clearEnrollmentsForNewCourse_\(\)/);
context.clearEnrollmentsForNewCourse_();
assert.equal(rows.length, 0);
assert.deepEqual(Object.keys(modes), []);
rows = [
  { studentId: 'A', activityId: 'ACDA', active: true, origin: 'EDUCA_XLS' },
  { studentId: 'A', activityId: 'ACDA', active: false, origin: 'MANUAL' },
  { studentId: 'X', activityId: 'ACDA', active: true, origin: 'MANUAL' },
  { studentId: 'X', activityId: 'ACDA', active: false, origin: 'EDUCA_XLS' },
];
modes = { ACDA: true, REMOVED: true };
book.getSheetByName = () => ({ getLastRow: () => 3 });
context.normalizeEnrollmentStorage_(book);
assert.equal(rows.length, 2);
assert.equal(rows.find(row => row.studentId === 'A').active, false);
assert.equal(rows.find(row => row.studentId === 'A').origin, 'MANUAL');
assert.equal(rows.find(row => row.studentId === 'X').active, true); // La relación por ID permanece activa.
assert.equal(rows.find(row => row.studentId === 'X').origin, 'MANUAL');
assert.deepEqual(Object.keys(modes), ['ACDA']);
console.log('legacy, manual and EDUCA memberships; Eval history and annual reset: ok');
