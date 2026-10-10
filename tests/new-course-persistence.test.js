const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const calls = [];
const store = new Map();
const properties = {
  getProperty: key => store.has(key) ? store.get(key) : null,
  setProperty: (key, value) => { store.set(key, value); },
  deleteProperty: key => { store.delete(key); },
};
const config = { curso_academico: '2027-2028', profesor: 'Docente', tema_preset: 'verde' };
const calendar = { academicYear: '2027-2028', types: [{ id: 'FP1', active: false,
  startDate: '', endDate: '', evaluations: [] }], events: [], categories: [] };
const schedule = { slots: [{ id: 'T1', type: 'SESION', startTime: '08:00', durationMinutes: 60 }],
  activities: [{ id: 'A1', name: 'Actividad' }], sessions: [] };
const context = {
  CP: { CONFIG_KEYS: { ACADEMIC_YEAR: 'curso_academico' } },
  PropertiesService: { getDocumentProperties: () => properties },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSpreadsheetTimeZone: () => 'Europe/Madrid',
    getId: () => 'BOOK', toast: () => calls.push('toast') }) },
  getGeneralConfigValues_: () => ({ ...config }),
  proponerCursoAcademico_: () => '2027-2028',
  getCalendarConfigForUi_: () => ({ ...JSON.parse(JSON.stringify(calendar)), categories: ['FESTIVO'] }),
  getScheduleConfigForUi_: () => ({ ...JSON.parse(JSON.stringify(schedule)), days: ['L'] }),
  buildDefaultCalendarEventsForAcademicYear_: () => [],
  normalizeGeneralConfigInput_: value => value,
  validateAcademicYear_: () => {}, validateThemeConfig_: () => {},
  normalizeAndValidateScheduleConfig_: value => value,
  normalizeNewCourseProcessInput_: value => value,
  validateNotebookOriginalLocation_: () => {},
  saveGeneralConfig_: () => calls.push('general'),
  guardarConfiguracionCalendario_: () => calls.push('calendarData'),
  guardarConfiguracionHorario_: () => calls.push('scheduleData'),
  createOrRepairCalendarSheet_: () => calls.push('calendarView'),
  createOrRepairScheduleSheet_: () => calls.push('scheduleView'),
  hideTechnicalSheets_: () => calls.push('hide'),
  reorderManagedVisibleSheets_: () => calls.push('order'),
  initializeCoverStructure_: () => calls.push('cover'),
  initializeMetaStructure_: () => calls.push('meta'),
  installAllManagedProtections_: () => calls.push('protect'),
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('NewCourse.gs', 'utf8'), context);
context.normalizeNewCourseProcessInput_ = value => value;
context.validateNotebookOriginalLocation_ = () => {};
const first = context.getNewCourseDraft_();
assert.strictEqual(store.size, 0, 'abrir el borrador no escribe');
assert.strictEqual(first.schedule.sessions.length, 0);
context.guardarSeguridadNuevoCurso({ config, originalFileName: 'Cuaderno',
  originalFolderId: 'ORIGIN', destinationFolderId: 'DEST' });
context.guardarVisitaNuevoCurso(1);
context.guardarDatosGeneralesNuevoCurso(config);
context.guardarVisitaNuevoCurso(2);
context.guardarCalendarioNuevoCurso({ types: calendar.types, events: [] });
context.guardarVisitaNuevoCurso(3);
context.guardarHorarioNuevoCurso(schedule, 3);
assert.deepStrictEqual(calls, [], 'los pasos no escriben en el libro ni renderizan');
assert.strictEqual(context.getNewCourseDraft_().visited[3], true);
assert.strictEqual(context.getNewCourseDraft_().reviewed[3], true);
assert.strictEqual(context.getNewCourseDraftSummary_(context.getNewCourseDraft_()).reasons.sessions,
  'No hay sesiones asignadas.');
const templates = [];
context.HtmlService = { createTemplateFromFile: () => {
  const template = { evaluate: () => ({ getContent: () => '<body></body>' }) };
  templates.push(template); return template;
} };
context.setCommonUiTemplateData_ = () => {};
context.obtenerFormularioPasoNuevoCurso(2);
context.obtenerFormularioPasoNuevoCurso(3);
assert.deepStrictEqual(templates[0].calendarConfig.categories, ['FESTIVO']);
assert.deepStrictEqual(templates[1].scheduleConfig.days, ['L']);
assert.throws(() => context.aplicarBorradorNuevoCurso(), /copia de seguridad/);
context.getNewCourseProcessDefinition_ = () => ({ input: {}, steps: [
  { run: () => calls.push('backup') }, { run: () => calls.push('annualReset') },
] });
context.iniciarPreparacionNuevoCurso();
assert.deepStrictEqual(calls, ['backup', 'annualReset']);
assert.strictEqual(context.getNewCourseDraft_().generationPhase, 1);
context.aplicarBorradorNuevoCurso();
assert.deepStrictEqual(calls, ['backup', 'annualReset', 'general', 'calendarData', 'scheduleData']);
assert.strictEqual(context.getNewCourseDraft_().generationPhase, 2);
context.finalizarCalendarioNuevoCurso();
context.finalizarHorarioNuevoCurso();
context.finalizarEstructuraNuevoCurso();
assert.deepStrictEqual(calls, ['backup', 'annualReset', 'general', 'calendarData', 'scheduleData', 'calendarView',
  'scheduleView', 'hide', 'order', 'cover', 'meta', 'protect', 'toast']);
assert.strictEqual(store.size, 0, 'el borrador se limpia tras finalizar');
console.log('borrador persistente y generación final diferida: ok');
