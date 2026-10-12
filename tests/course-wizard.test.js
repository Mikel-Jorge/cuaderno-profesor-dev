const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const menuCalls = [];
let teachingTypes, tutorActive = false;
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
  CP: { MENU: { NAME: '📘 Cuaderno del Profesor 📘', CONFIG: '⚙️ Configuración', STUDENTS: 'Alumnado', MODULES: '📚 Módulos',
    GENERAL_DATA: '🪪 Configurar datos del docente y centro', CALENDAR_CONFIG: '📅 Configurar calendario', SCHEDULE_CONFIG: '🕒 Configurar horario',
    MODULE_CONFIG_CREATE: 'Crear Config', MODULE_CONFIG_RECALCULATE: 'Recalcular', MODULE_TRACKING_CREATE: 'Crear Seg/Eval',
    EDUCA_IMPORT: 'Importar alumnado de módulos', TUTOR_IMPORT: 'Importar grupo de tutoría',
    MODULE_ENROLLMENTS: 'Matrículas', CONTACTS_SYNC: 'Contacts',
    INIT: 'Reparar', NEW_COURSE: 'Preparar nuevo curso', HELP: 'Ayuda' },
    CONFIG_KEYS: { ACADEMIC_YEAR: 'curso_academico', IS_TUTOR: 'es_tutor' } },
  SpreadsheetApp: { getUi: () => ({ createMenu: menu }), getActiveSpreadsheet: () => ({}) },
  abrirAsistenteNuevoCurso: () => { ctx.opened = (ctx.opened || 0) + 1; },
  getGeneralConfigValues_: () => ({ curso_academico: '2026-2027', es_tutor: tutorActive }),
  isTutorEnabled_: value => value === true,
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
assert.strictEqual(menuCalls[0].items[1].label, 'Alumnado');
assert.strictEqual(menuCalls[0].items[2].label, '📚 Módulos');
assert.deepStrictEqual(menuCalls[0].items[1].items.map(item => item[0]),
  ['Importar alumnado de módulos', 'Matrículas', 'Contacts']);
assert.deepStrictEqual(menuCalls[0].items[2].items.map(item => item[0]),
  ['Crear Config', 'Recalcular', 'Crear Seg/Eval']);
assert.strictEqual(menuCalls[0].items[0].items[0][0], '🪪 Configurar datos del docente y centro');
assert.strictEqual(menuCalls[0].items[0].items[1][0], '📅 Configurar calendario');
assert.strictEqual(menuCalls[0].items[0].items[2][0], '🕒 Configurar horario');
assert.deepStrictEqual(menuCalls[0].items.at(-2), ['Preparar nuevo curso', 'abrirPrepararNuevoCurso']);
assert.deepStrictEqual(menuCalls[0].items.at(-1), ['Ayuda', 'mostrarAyuda']);
assert(!menuCalls[0].items[1].items.includes('separator'));
tutorActive = true;
ctx.onOpen();
assert.strictEqual(menuCalls.length, 2);
assert.deepStrictEqual(menuCalls[1].items[1].items.map(item => item === 'separator' ? item : item[0]),
  ['Importar grupo de tutoría', 'separator', 'Importar alumnado de módulos', 'Matrículas', 'Contacts']);
assert.strictEqual(menuCalls[1].items.length, menuCalls[0].items.length);
assert(!JSON.stringify(menuCalls).includes('Asistente de configuración'));
ctx.abrirPrepararNuevoCurso();
assert.strictEqual(ctx.opened, 1);
const html = fs.readFileSync('UiDialogNewCourse.html', 'utf8');
assert.strictEqual((html.match(/class="course-step(?: current)?"/g) || []).length, 7);
assert(!html.includes('confirm-reset'));
assert(html.includes('summary.steps[step]'));
assert(html.includes('Finalizar y generar cuaderno'));
assert(html.includes("callServer('guardarSeguridadNuevoCurso',input)"));
assert(html.includes("if(finalPhase<1){await callServer('iniciarPreparacionNuevoCurso',null)"));
assert(html.includes('function cancelWizard(){if(!busy)google.script.host.close()}'));
assert(html.includes('obtenerFormularioPasoNuevoCurso'));
assert(!html.includes('abrirPasoAsistenteCurso'));
assert(!html.includes('showModalDialog'));
const backend = fs.readFileSync('NewCourse.gs', 'utf8');
assert(backend.includes('process.steps.forEach(function(step) { step.run(process.input); })'));
assert(backend.includes('PropertiesService.getDocumentProperties()'));
assert(backend.includes("isCalendar ? 'UiDialogCalendarConfig' : 'UiDialogScheduleConfig'"));
assert(fs.readFileSync('UiStyles.html', 'utf8').includes('.schedule-accordion.is-hidden'));
console.log('unified menu and seven-step single-dialog wizard: ok');
