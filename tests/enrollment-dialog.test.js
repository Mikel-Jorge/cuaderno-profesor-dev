const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('UiDialogMatriculas.html', 'utf8');
const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
class Node {
  constructor(id = '') {
    this.children = [];
    this.hidden = false;
    this.disabled = false;
    this.value = id === 'module' ? 'M' : '';
    this.listeners = {};
  }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(event, handler) { this.listeners[event] = handler; }
  querySelectorAll(selector) {
    const inputs = this.children.flatMap(child => child.children).filter(child => child.type === 'checkbox');
    return selector === 'input:checked' ? inputs.filter(input => input.checked) : inputs;
  }
  setAttribute(name, value) { this[name] = value; }
}
function renderWith(result, saveFails = false) {
  const ids = ['module', 'students', 'save', 'error', 'loading', 'loading-label',
    'mode-note', 'selection-tools', 'select-all', 'select-none', 'close'];
  const nodes = Object.fromEntries(ids.map(id => [id, new Node(id)]));
  let closed = 0;
  const runner = { withSuccessHandler(handler) { this.success = handler; return this; },
    withFailureHandler(handler) { this.failure = handler; return this; },
    obtenerDatosMatriculasModulos() { this.success(result); },
    saveModuleEnrollments() {
      if (saveFails) this.failure({ message: 'Error de prueba' });
      else this.success({});
    } };
  vm.runInNewContext(script, {
    document: { getElementById: id => nodes[id], createElement: () => new Node() },
    google: { script: { run: runner, host: { close() { closed++; } } } },
  });
  nodes.closed = () => closed;
  nodes.runner = runner;
  return nodes;
}
const empty = renderWith({ modules: [{ id: 'M', acronym: 'GBD', name: 'Gestión de bases de datos',
  group: 'ASIR Online' }], students: [], enrollments: [], modes: {}, candidatesByModule: { M: [] } });
assert.equal(empty['selection-tools'].hidden, true);
assert.equal(empty['mode-note'].hidden, true);
assert.equal(empty.save.disabled, true);
assert.equal(empty.students.children[0].className, 'enrollment-empty');
assert.match(empty.students.children[0].children[0].textContent, /No hay alumnado disponible/);
assert.match(empty.students.children[0].children[1].textContent, /importarlo desde EDUCA/);
assert.match(html, /\.enrollment-empty\{[^}]*var\(--warning\)/);
const imported = renderWith({ modules: [{ id: 'M', acronym: 'GBD', name: 'Gestión de bases de datos',
  group: 'ASIR Online' }], students: [{ id: 'V', rowNumber: 2, surname: 'Apellido Cuatro',
  name: 'Vera', group: 'ASIR - VIRTUAL' }],
  enrollments: [{ studentId: 'V', activityId: 'M', active: true }], modes: { M: true },
  candidatesByModule: { M: [2] } });
assert.equal(imported['selection-tools'].hidden, false);
assert.equal(imported.students.children[0].children[0].checked, true);
assert.equal(imported.save.disabled, false);
assert.match(imported['mode-note'].textContent, /matriculado de forma individual/);
const legacy = renderWith({ modules: [{ id: 'M', acronym: 'GBD', name: 'Gestión de bases de datos',
  group: 'ASIR Online' }], students: [{ id: 'V', rowNumber: 2, surname: 'Apellido Cuatro',
  name: 'Vera', group: 'ASIR - VIRTUAL' }], enrollments: [], modes: {},
  candidatesByModule: { M: [2] } });
assert.equal(legacy.students.children[0].children[0].checked, true);
assert.match(legacy['mode-note'].textContent, /todo el alumnado del grupo/);
const visibleCopy = [html, fs.readFileSync('UiDialogEducaImport.html', 'utf8'),
  fs.readFileSync('Sidebar.gs', 'utf8'), fs.readFileSync('UiSidebar.html', 'utf8')].join('\n');
assert.doesNotMatch(visibleCopy, /matr[ií]culas? expl[ií]citas?/i);
const importDialog = fs.readFileSync('UiDialogEducaImport.html', 'utf8');
assert.match(importDialog, /El grupo del m\\u00f3dulo se actualizar\\u00e1/);
assert.match(importDialog, /groupWillUpdate/);
assert.match(importDialog, /manualDifferentGroups/);
assert.doesNotMatch(importDialog, /id="result"/);
assert.match(importDialog, /importarAlumnadoEduca','Importando alumnado[^\n]+google\.script\.host\.close\(\)/);
imported.save.listeners.click();
assert.equal(imported.closed(), 1);
const failed = renderWith({ modules: [{ id: 'M', acronym: 'GBD', name: 'Prueba',
  group: 'ASIR Online' }], students: [{ id: 'V', rowNumber: 2, surname: 'Apellido',
  name: 'Vera', group: 'ASIR Online' }], enrollments: [], modes: { M: true },
  candidatesByModule: { M: [2] } }, true);
failed.save.listeners.click();
assert.equal(failed.closed(), 0);
assert.equal(failed.error.textContent, 'Error de prueba');
function runImporter(fails) {
  const importer = importDialog.replace('<?= hasModules ?>', 'true');
  const importerScript = /<script>([\s\S]*?)<\/script>/.exec(importer)[1];
  const ids = ['upload-form', 'archivo', 'primary', 'back', 'error', 'no-modules',
    'loading', 'loading-label', 'file-name', 'confirm-cancel', 'confirm-accept'];
  const elements = Object.fromEntries(ids.map(id => [id, new Node(id)]));
  elements.archivo.files = [{}];
  elements['upload-form'].elements = { archivo: elements.archivo,
    mapping: { value: '{}' }, confirmDrops: { value: '' }, expectedDrops: { value: '0' } };
  let closed = 0;
  const runner = { withSuccessHandler(handler) { this.success = handler; return this; },
    withFailureHandler(handler) { this.failure = handler; return this; },
    importarAlumnadoEduca() {
      if (fails) this.failure({ message: 'Importación fallida' });
      else this.success({ summary: {} });
    } };
  const scope = { document: { getElementById: id => elements[id] },
    google: { script: { run: runner, host: { close() { closed++; } } } } };
  vm.runInNewContext(importerScript, scope);
  scope.applyImport(false);
  return { closed, error: elements.error.textContent };
}
assert.equal(runImporter(false).closed, 1);
assert.equal(runImporter(true).closed, 0);
assert.equal(runImporter(true).error, 'Importación fallida');
const menu = fs.readFileSync('Main.gs', 'utf8');
assert(menu.indexOf('CP.MENU.EDUCA_IMPORT') < menu.indexOf('CP.MENU.MODULE_ENROLLMENTS'));
assert(menu.indexOf('CP.MENU.MODULE_ENROLLMENTS') < menu.indexOf('CP.MENU.MODULE_CONFIG_CREATE'));
console.log('module menu, empty enrollment state and teacher-facing copy: ok');
