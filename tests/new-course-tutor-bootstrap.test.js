const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const clone = value => JSON.parse(JSON.stringify(value));
const store = new Map();
const properties = {
  getProperty: key => store.has(key) ? store.get(key) : null,
  setProperty: (key, value) => store.set(key, value),
  deleteProperty: key => store.delete(key),
};
const book = { getSpreadsheetTimeZone: () => 'Europe/Madrid', getId: () => 'BOOK',
  getSheetByName: () => ({}), toast() {} };
const context = vm.createContext({ console });
['Config.gs', 'Theme.gs', 'Calendar.gs', 'Schedule.gs', 'GeneralConfig.gs', 'NewCourse.gs'].forEach(file => {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
});

let nextId = 0;
context.createCalendarRecordId_ = prefix => prefix + '-' + ++nextId;
context.PropertiesService = { getDocumentProperties: () => properties };
context.SpreadsheetApp = { getActiveSpreadsheet: () => book };
context.LockService = { getDocumentLock: () => ({ tryLock: () => true, releaseLock() {} }) };
context.validateThemeConfig_ = () => {};
context.validateNotebookOriginalLocation_ = () => {};
context.normalizeNewCourseProcessInput_ = value => value;
context.proponerCursoAcademico_ = () => '2027-2028';
context.buildDefaultCalendarEventsForAcademicYear_ = () => [];
context.formatCalendarDateForUi_ = value => value;
context.setCommonUiTemplateData_ = () => {};

const moduleActivity = { id: 'MOD-1', category: 'MODULO', name: 'Módulo', acronym: 'MOD',
  teachingTypeId: 'FP1', group: 'DAM 2A', classroom: 'A1', color: '#123456' };
const initialConfig = { curso_academico: '2026-2027', profesor: 'Docente', centro: 'Centro',
  email: '', es_tutor: 'false', grupo_tutoria: '', actividad_tutoria_id: '',
  actividades_base_curso: '2026-2027' };
let liveConfig = clone(initialConfig);
let liveSchedule = { slots: [{ id: 'TR-1', type: 'SESION', name: '', startTime: '08:00',
  durationMinutes: 60 }], activities: [moduleActivity], sessions: [] };
let liveCalendar = { academicYear: '2027-2028', types: [{ id: 'FP1', name: '1º', active: true,
  startDate: '2027-09-01', endDate: '2028-06-20', evaluations: [] }], events: [] };

context.getGeneralConfigValues_ = () => clone(liveConfig);
context.getCalendarConfigForUi_ = () => clone(liveCalendar);
context.getScheduleConfigForUi_ = () => Object.assign(clone(liveSchedule), {
  blockingError: '', days: [{ id: 'LUN', label: 'Lunes' }], slotTypes: { SESION: 'Sesión' },
  categories: context.getManualScheduleActivityCategories_(), activityDefaults: {},
  teachingTypes: [{ id: 'FP1', label: '1º', active: true }], supportMaxLength: 40,
  managedTutorActivityId: liveConfig.actividad_tutoria_id,
});
context.getScheduleActivities_ = () => clone(liveSchedule.activities);
context.getWeeklySchedule_ = () => clone(liveSchedule.sessions);
context.getScheduleTeachingTypesForUi_ = () => [{ id: 'FP1', label: '1º', active: true }];
context.assertScheduleStructureReady_ = () => {};
context.persistScheduleConfig_ = (_book, value, section) => {
  if (!section || section === 'slots') liveSchedule.slots = clone(value.slots);
  if (!section || section === 'activities') liveSchedule.activities = clone(value.activities);
  if (!section || section === 'sessions') liveSchedule.sessions = clone(value.sessions);
};
context.captureScheduleSnapshots_ = () => clone(liveSchedule);
context.restoreScheduleSnapshots_ = (_book, snapshot) => { liveSchedule = clone(snapshot); };
context.captureCalendarTableSnapshots_ = () => clone(liveCalendar);
context.restoreCalendarTableSnapshots_ = (_book, snapshot) => { liveCalendar = clone(snapshot); };
let savedGeneralOptions;
context.saveGeneralConfig_ = (value, options) => {
  savedGeneralOptions = options;
  liveConfig = clone(value);
};
let failCalendarOnce = true;
context.guardarConfiguracionCalendario_ = value => {
  if (failCalendarOnce) { failCalendarOnce = false; throw new Error('Fallo de calendario simulado'); }
  liveCalendar = clone(value);
};
context.syncStudentGroupValidation_ = () => {};
context.createOrRepairCalendarSheet_ = () => {};
context.createOrRepairScheduleSheet_ = () => {};
context.hideTechnicalSheets_ = () => {};
context.reorderManagedVisibleSheets_ = () => {};
context.initializeCoverStructure_ = () => {};
context.initializeMetaStructure_ = () => {};
context.installAllManagedProtections_ = () => {};
context.onOpen = () => {};

const initialDraft = context.getNewCourseDraft_();
assert.strictEqual(initialDraft.managedTutorActivity, null);
context.guardarSeguridadNuevoCurso({ config: initialDraft.config, originalFileName: 'Cuaderno',
  originalFolderId: 'ORIGIN', destinationFolderId: 'DEST' });
context.guardarDatosGeneralesNuevoCurso(Object.assign({}, initialDraft.config, {
  curso_academico: '2027-2028', es_tutor: 'true', grupo_tutoria: 'DAM 2A',
}));
context.guardarCalendarioNuevoCurso(liveCalendar);

let draft = context.getNewCourseDraft_();
context.guardarHorarioNuevoCurso(draft.schedule, 3);
draft = context.getNewCourseDraft_();
let shownTemplate;
context.HtmlService = { createTemplateFromFile: () => {
  shownTemplate = { evaluate: () => ({ getContent: () => '<body></body>' }) };
  return shownTemplate;
} };
context.obtenerFormularioPasoNuevoCurso(4);
const activitiesPayload = clone(shownTemplate.scheduleConfig);
const managedId = activitiesPayload.managedTutorActivityId;
const managed = activitiesPayload.activities.find(activity => activity.id === managedId);
assert(managed, 'Tutoría aparece automáticamente en el paso Actividades');
assert.strictEqual(managed.group, 'DAM 2A');
assert.strictEqual(managed.category, 'TUTORIA');
assert(!activitiesPayload.categories.includes('TUTORIA'));
context.guardarHorarioNuevoCurso(activitiesPayload, 4);

draft = context.getNewCourseDraft_();
draft.schedule.sessions = [{ id: '', day: 'LUN', slotId: 'TR-1', activityId: managedId, support: '' }];
context.guardarHorarioNuevoCurso(Object.assign({}, draft.schedule, {
  activities: context.getNewCourseDraftActivities_(draft),
}), 5);

const phases = [];
context.getNewCourseProcessDefinition_ = () => ({ input: {}, steps: [
  { run: () => phases.push('backup') }, { run: () => phases.push('annualReset') },
] });
context.iniciarPreparacionNuevoCurso();
assert.deepStrictEqual(phases, ['backup', 'annualReset']);
assert.strictEqual(liveSchedule.activities.some(activity => activity.category === 'TUTORIA'), false,
  'previousActivities del Spreadsheet todavía no contiene Tutoría');
const finalPlan = context.getNewCourseDraft_().finalPlan;
liveConfig = clone(finalPlan.config);
assert.throws(() => context.guardarConfiguracionHorario_(finalPlan.schedule,
  { renderViews: false, showToast: false }), /gestiona desde Datos/,
  'el guardado normal continúa rechazando el bootstrap');
liveConfig = clone(initialConfig);
assert.throws(() => context.aplicarBorradorNuevoCurso(), /No se han aplicado cambios parciales/);
assert.strictEqual(context.getNewCourseDraft_().generationPhase, 1);
assert.strictEqual(liveConfig.es_tutor, 'false');
assert.strictEqual(liveSchedule.activities.some(activity => activity.category === 'TUTORIA'), false);
context.obtenerFormularioPasoNuevoCurso(4);
assert(shownTemplate.scheduleConfig.activities.some(activity => activity.id === managedId),
  'Tutoría sigue visible tras rollback');

context.aplicarBorradorNuevoCurso();
assert.strictEqual(savedGeneralOptions.newCourseManagedTutorId, managedId);
assert.strictEqual(context.getNewCourseDraft_().generationPhase, 2);
assert.strictEqual(liveConfig.actividad_tutoria_id, managedId);
assert.strictEqual(liveSchedule.activities.filter(activity => activity.category === 'TUTORIA').length, 1);
assert.strictEqual(liveSchedule.activities.find(activity => activity.category === 'TUTORIA').id, managedId);
assert.strictEqual(liveSchedule.sessions[0].activityId, managedId);

const unauthorized = clone(liveSchedule);
unauthorized.activities.push({ ...managed, id: 'MANUAL-TUTOR' });
assert.throws(() => context.assertManagedTutorActivityForNewCourse_(
  unauthorized.activities, liveConfig, [moduleActivity]), /no coincide/);

context.finalizarCalendarioNuevoCurso();
context.finalizarHorarioNuevoCurso();
context.finalizarEstructuraNuevoCurso();
assert.strictEqual(store.size, 0);
console.log('new course false-to-true tutor bootstrap, rollback and retry: ok');
