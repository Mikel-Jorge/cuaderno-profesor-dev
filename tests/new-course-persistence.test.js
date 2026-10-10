const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function load(file, context, prelude) {
  vm.createContext(context);
  if (prelude) vm.runInContext(prelude, context);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  return context;
}

const calls = [];
const course = load('NewCourse.gs', {
  CP: { CONFIG_KEYS: { ACADEMIC_YEAR: 'curso_academico' },
    UI: { NEW_COURSE_PROCESS_ID: 'NEW' }, MENU: { NEW_COURSE: 'Preparar nuevo curso' } },
  normalizeGeneralConfigInput_: value => value,
  validateThemeConfig_: () => {},
  saveGeneralConfig_: (values, options) => { calls.push(['general', options]); return { values }; },
  guardarConfiguracionCalendario_: (values, options) => { calls.push(['calendar', options]); return values; },
  guardarConfiguracionHorario_: (values, options) => { calls.push(['schedule', options]); return values; },
  createOrRepairCalendarSheet_: options => calls.push(['calendarView', options]),
  createOrRepairScheduleSheet_: options => calls.push(['scheduleView', options]),
  hideTechnicalSheets_: () => calls.push(['hide']),
  reorderManagedVisibleSheets_: () => calls.push(['order']),
  initializeCoverStructure_: () => calls.push(['cover']),
  initializeMetaStructure_: () => calls.push(['meta']),
  installAllManagedProtections_: () => calls.push(['protect']),
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getId: () => 'BOOK', toast: () => calls.push(['toast']) }) },
});
course.normalizeNewCourseProcessInput_ = input => input;
const preparation = course.getNewCourseProcessDefinition_({ moveNotebook: true });
assert.deepStrictEqual(Array.from(preparation.steps, step => step.label), [
  'Creando copia de seguridad...', 'Moviendo cuaderno...',
  'Renombrando cuaderno activo...', 'Actualizando curso académico...',
  'Reiniciando datos anuales...',
]);
course.guardarDatosGeneralesNuevoCurso({ tema_preset: 'atlantico' });
course.guardarCalendarioNuevoCurso({ types: [] });
course.guardarHorarioNuevoCurso({ slots: [] }, 3);
course.guardarHorarioNuevoCurso({ activities: [] }, 4);
course.guardarHorarioNuevoCurso({ sessions: [] }, 5);
assert.strictEqual(calls[0][1].updateCover, false);
assert.strictEqual(calls[1][1].renderViews, false);
assert.deepStrictEqual(calls.slice(2, 5).map(call => call[1].section),
  ['slots', 'activities', 'sessions']);
assert(calls.slice(2, 5).every(call => call[1].renderViews === false));
assert(!calls.some(call => /View|cover/.test(call[0])));
course.finalizarCalendarioNuevoCurso();
course.finalizarHorarioNuevoCurso();
course.finalizarEstructuraNuevoCurso();
assert.deepStrictEqual(calls.slice(5).map(call => call[0]),
  ['calendarView', 'scheduleView', 'hide', 'order', 'cover', 'meta', 'protect', 'toast']);
assert.strictEqual(calls[5][1].skipIndex, true);
assert.strictEqual(calls[6][1].skipIndex, true);
const annualCalls = [];
course.initializeCalendarStructure_ = () => annualCalls.push('structureCalendar');
course.ensureScheduleTechnicalStructure_ = () => annualCalls.push('structureSchedule');
course.assertScheduleStructureReady_ = () => {};
course.assertCalendarStructureReady_ = () => {};
course.captureNewCourseAnnualSnapshots_ = () => ({});
course.clearStudentsForNewCourse_ = () => annualCalls.push('students');
course.clearWeeklyScheduleForNewCourse_ = () => annualCalls.push('sessions');
course.resetCalendarForNewCourse_ = () => annualCalls.push('calendarData');
course.archiveTrackingAndDeleteModuleSheetsForNewCourse_ = () => annualCalls.push('archive');
course.prepareNewCourseAnnualData_({ config: { curso_academico: '2027-2028' } });
assert.deepStrictEqual(annualCalls, ['structureCalendar', 'structureSchedule',
  'students', 'sessions', 'calendarData', 'archive']);
const copy = { getName: () => 'Cuaderno original', isTrashed: () => false };
const source = { makeCopy(name, folder) { assert.strictEqual(name, 'Cuaderno original');
  assert.strictEqual(folder, 'DESTINATION'); return copy; } };
course.DriveApp = { getFileById: () => source };
course.getDriveFolderById_ = () => 'DESTINATION';
course.isFileInFolder_ = (file, folderId) => file === source ? folderId === 'ORIGINAL'
  : file === copy && folderId === 'SELECTED';
assert.strictEqual(course.createNewCourseBackup_({ originalFolderId: 'ORIGINAL',
  destinationFolderId: 'SELECTED', destinationFolderName: 'Destino',
  originalFileName: 'Cuaderno original' }), 'Copia de seguridad creada en Destino.');
course.HtmlService = { createTemplateFromFile: () => ({ evaluate: () => ({
  getContent: () => '<html><body></body></html>' }) }) };
course.setCommonUiTemplateData_ = () => {};
course.assertCalendarStructureReady_ = () => {};
course.getCalendarConfigForUi_ = () => ({});
course.assertScheduleStructureReady_ = () => {};
course.getScheduleConfigForUi_ = () => ({});
for (const step of [2, 3, 4, 5]) {
  const embedded = course.obtenerFormularioPasoNuevoCurso(step);
  assert(embedded.includes('ResizeObserver'));
  assert(embedded.includes('course-wizard-ready'));
  if (step > 2) assert(embedded.includes('.schedule-accordion-toggle{display:none'));
  for (const match of embedded.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    new vm.Script(match[1]);
  }
}

const written = [];
const schedule = load('Schedule.gs', {
  CP: { SHEETS: { SCHEDULE_SLOTS: 'slots', SCHEDULE_ACTIVITIES: 'activities', SCHEDULE_SESSIONS: 'sessions' } },
}, "const CP_CALENDAR_TYPE_DEFINITIONS=[{id:'FP1'}]");
schedule.writeScheduleTable_ = sheet => written.push(sheet);
const config = { slots: [{ id: 'S', type: 'SESION', name: '', startTime: '08:00', durationMinutes: 60 }],
  activities: [{ id: 'A', category: 'MODULO', name: 'Módulo', acronym: 'MOD',
    teachingTypeId: 'FP1', group: 'A', classroom: '', color: '#123456' }],
  sessions: [{ id: 'X', day: 'L', slotId: 'S', activityId: 'A', support: '' }] };
const spreadsheet = { getSheetByName: name => name };
schedule.persistScheduleConfig_(spreadsheet, config, 'slots');
schedule.persistScheduleConfig_(spreadsheet, config, 'activities');
schedule.persistScheduleConfig_(spreadsheet, config, 'sessions');
assert.deepStrictEqual(written, ['slots', 'activities', 'sessions']);
const scheduleCalls = [];
schedule.SpreadsheetApp = { getActiveSpreadsheet: () => ({ toast: () => scheduleCalls.push('toast') }) };
schedule.LockService = { getDocumentLock: () => ({ tryLock: () => true, releaseLock() {} }) };
schedule.assertScheduleStructureReady_ = () => {};
schedule.normalizeAndValidateScheduleConfig_ = () => config;
schedule.captureScheduleSnapshots_ = () => [];
schedule.persistScheduleConfig_ = (spreadsheet, data, section) => scheduleCalls.push(section || 'all');
schedule.createOrRepairScheduleSheet_ = () => scheduleCalls.push('render');
schedule.guardarConfiguracionHorario_({}, { section: 'slots', renderViews: false, showToast: false });
assert.deepStrictEqual(scheduleCalls, ['slots']);
schedule.guardarConfiguracionHorario({});
assert.deepStrictEqual(scheduleCalls, ['slots', 'all', 'render', 'toast']);

const calendarCalls = [];
const calendar = load('Calendar.gs', {
  CP: { SHEETS: {} },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ toast: () => calendarCalls.push('toast') }) },
  LockService: { getDocumentLock: () => ({ tryLock: () => true, releaseLock() {} }) },
});
calendar.assertCalendarStructureReady_ = () => {};
calendar.normalizeAndValidateCalendarConfig_ = input => input;
calendar.captureCalendarTableSnapshots_ = () => [];
calendar.persistCalendarConfig_ = () => calendarCalls.push('persist');
calendar.createOrRepairCalendarSheet_ = () => calendarCalls.push('render');
calendar.getCalendarConfigForUi_ = () => ({});
calendar.guardarConfiguracionCalendario_({}, { renderViews: false, showToast: false });
assert.deepStrictEqual(calendarCalls, ['persist']);
calendar.guardarConfiguracionCalendario({});
assert.deepStrictEqual(calendarCalls, ['persist', 'persist', 'render', 'toast']);
console.log('wizard saves canonical data and defers visible generation: ok');
