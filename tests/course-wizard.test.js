const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const menuCalls = [];
let teachingTypes;
function menu(label) {
  const node = { label, items: [] };
  return {
    node,
    addItem(text, action) { node.items.push([text, action]); return this; },
    addSubMenu(child) { node.items.push(child.node); return this; },
    addSeparator() { node.items.push('separator'); return this; },
    addToUi() { menuCalls.push(node); return this; },
  };
}
const ctx = {
  CP: { MENU: { NAME: '📘 Cuaderno del Profesor 📘', CONFIG: '⚙️ Configuración', MODULES: '📚 Módulos',
    GENERAL_DATA: '🪪 Configurar datos del docente y centro', CALENDAR_CONFIG: '📅 Configurar calendario', SCHEDULE_CONFIG: '🕒 Configurar horario',
    MODULE_CONFIG_CREATE: 'Crear Config', MODULE_CONFIG_RECALCULATE: 'Recalcular', MODULE_TRACKING_CREATE: 'Crear Seg/Eval',
    INIT: 'Reparar', NEW_COURSE: 'Preparar nuevo curso', HELP: 'Ayuda' },
    CONFIG_KEYS: { ACADEMIC_YEAR: 'curso_academico' } },
  SpreadsheetApp: { getUi: () => ({ createMenu: menu }), getActiveSpreadsheet: () => ({}) },
  abrirAsistenteNuevoCurso: () => { ctx.opened = (ctx.opened || 0) + 1; },
  getGeneralConfigValues_: () => ({ curso_academico: '2026-2027' }),
  getCalendarTeachingTypes_: () => teachingTypes,
  isCalendarConfiguredForSidebar_: () => true,
  getScheduleTimeSlots_: () => [{}, {}], getScheduleActivities_: () => [{}], getWeeklySchedule_: () => [{}, {}, {}],
};
vm.createContext(ctx);
teachingTypes = [{ active: true,
  startDate: vm.runInContext("new Date('2026-09-01')", ctx),
  endDate: vm.runInContext("new Date('2027-06-30')", ctx) }];
vm.runInContext(fs.readFileSync('Main.gs', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('Ui.gs', 'utf8'), ctx);
ctx.onOpen();
assert.strictEqual(menuCalls.length, 1);
assert.strictEqual(menuCalls[0].label, '📘 Cuaderno del Profesor 📘');
assert.strictEqual(menuCalls[0].items[0].label, '⚙️ Configuración');
assert.strictEqual(menuCalls[0].items[1].label, '📚 Módulos');
assert.strictEqual(menuCalls[0].items[0].items[0][0], '🪪 Configurar datos del docente y centro');
assert.strictEqual(menuCalls[0].items[0].items[1][0], '📅 Configurar calendario');
assert.strictEqual(menuCalls[0].items[0].items[2][0], '🕒 Configurar horario');
assert.deepStrictEqual(menuCalls[0].items.at(-2), ['Preparar nuevo curso', 'abrirPrepararNuevoCurso']);
assert.deepStrictEqual(menuCalls[0].items.at(-1), ['Ayuda', 'mostrarAyuda']);
assert(!JSON.stringify(menuCalls).includes('Asistente de configuración'));
ctx.abrirPrepararNuevoCurso();
assert.strictEqual(ctx.opened, 1);
const summary = ctx.getCourseWizardSummary_();
assert.strictEqual(summary.academicYear, '2026-2027');
assert.strictEqual(summary.calendar, true);
assert.strictEqual(summary.slots, 2);
assert.strictEqual(summary.activities, 1);
assert.strictEqual(summary.sessions, 3);
assert.deepStrictEqual(Object.values(summary.reasons), ['', '', '', '']);
teachingTypes = [];
assert.strictEqual(ctx.getCourseWizardSummary_().reasons.calendar,
  'No hay ningún tipo de enseñanza activo.');
teachingTypes = [{ active: true, startDate: null, endDate: null }];
assert.strictEqual(ctx.getCourseWizardSummary_().reasons.calendar,
  'Faltan fechas en los tipos de enseñanza activos.');

const html = fs.readFileSync('UiDialogNewCourse.html', 'utf8');
assert.strictEqual((html.match(/class="course-step(?: current)?"/g) || []).length, 7);
assert(!html.includes('confirm-reset'));
assert(html.includes('reviewed[currentStep]=true'));
assert(html.includes('Finalizar y generar cuaderno'));
assert(html.includes('obtenerFormularioPasoNuevoCurso'));
assert(!html.includes('abrirPasoAsistenteCurso'));
assert(!html.includes('showModalDialog'));
const backend = fs.readFileSync('NewCourse.gs', 'utf8');
assert(backend.includes('process.steps.forEach(function(step) { step.run(process.input); })'));
assert(backend.includes("isCalendar ? 'UiDialogCalendarConfig' : 'UiDialogScheduleConfig'"));
assert(fs.readFileSync('UiStyles.html', 'utf8').includes('.schedule-accordion.is-hidden'));
console.log('unified menu and seven-step single-dialog wizard: ok');
