const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const calls = [];
const context = {
  CP: { MENU: { COURSE_WIZARD: 'Asistente' }, CONFIG_KEYS: { ACADEMIC_YEAR: 'curso_academico' } },
  abrirDatosGenerales: step => calls.push(['general', step]),
  abrirConfiguracionCalendario: step => calls.push(['calendar', step]),
  abrirConfiguracionHorario: step => calls.push(['schedule', step]),
  getGeneralConfigValues_: () => ({ curso_academico: '2026-2027' }),
  isCalendarConfiguredForSidebar_: () => true,
  getScheduleTimeSlots_: () => [{}, {}],
  getScheduleActivities_: () => [{}],
  getWeeklySchedule_: () => [{}, {}, {}],
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({}),
    getUi: () => ({ showModalDialog: (_html, title) => calls.push(['summary', title]) }),
  },
  HtmlService: { createTemplateFromFile: name => ({
    evaluate: () => ({ setWidth() { return this; }, setHeight() { return this; } }), name,
  }) },
  setCommonUiTemplateData_: () => {},
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('Ui.gs', 'utf8'), context);
context.setCommonUiTemplateData_ = () => {};
context.abrirAsistenteConfiguracionCurso();
assert.strictEqual(JSON.stringify(calls), JSON.stringify([['general', 1]]));
calls.length = 0;
for (let step = 1; step <= 6; step++) context.abrirPasoAsistenteCurso(step);
assert.strictEqual(JSON.stringify(calls), JSON.stringify([
  ['general', 1], ['calendar', 2], ['schedule', 3], ['schedule', 4],
  ['schedule', 5], ['summary', 'Asistente'],
]));
const summary = context.getCourseWizardSummary_();
assert.strictEqual(JSON.stringify(summary), JSON.stringify({
  academicYear: '2026-2027', calendar: true, slots: 2, activities: 1, sessions: 3,
}));
assert.throws(() => context.abrirPasoAsistenteCurso(7), /no existe/);
console.log('course wizard routing and summary: ok');
