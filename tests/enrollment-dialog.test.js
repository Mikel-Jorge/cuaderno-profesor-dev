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
    this.classes = new Set();
    this.classList = { toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name) };
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
    'loading', 'loading-label', 'file-name', 'confirm-cancel', 'confirm-accept',
    'educa-body', 'import-actions', 'intro', 'preview'];
  const elements = Object.fromEntries(ids.map(id => [id, new Node(id)]));
  elements.archivo.files = [{}];
  elements['upload-form'].elements = { archivo: elements.archivo,
    mapping: { value: '{"subject":"module"}' }, confirmDrops: { value: '' }, expectedDrops: { value: '0' } };
  let closed = 0;
  let duringImport;
  const runner = { withSuccessHandler(handler) { this.success = handler; return this; },
    withFailureHandler(handler) { this.failure = handler; return this; },
    importarAlumnadoEduca() {
      duringImport = { introHidden: elements.intro.hidden, previewHidden: elements.preview.hidden,
        loadingVisible: !elements.loading.hidden, actionsHidden: elements['import-actions'].hidden,
        overflowLocked: elements['educa-body'].classes.has('is-busy'),
        mapping: elements['upload-form'].elements.mapping.value };
      if (fails) this.failure({ message: 'Importación fallida' });
      else this.success({ summary: {} });
    } };
  const scope = { document: { getElementById: id => elements[id] },
    google: { script: { run: runner, host: { close() { closed++; } } } } };
  vm.createContext(scope);
  vm.runInContext(importerScript, scope);
  vm.runInContext('preview={summary:{modules:1}};showPage("preview")', scope);
  scope.applyImport(false);
  return { closed, error: elements.error.textContent, duringImport,
    restored: !elements.preview.hidden && elements.loading.hidden &&
      !elements['import-actions'].hidden && !elements['educa-body'].classes.has('is-busy'),
    mapping: elements['upload-form'].elements.mapping.value };
}
const importSuccess = runImporter(false);
assert.equal(importSuccess.closed, 1);
assert.deepEqual(importSuccess.duringImport, { introHidden: true, previewHidden: true,
  loadingVisible: true, actionsHidden: true, overflowLocked: true, mapping: '{"subject":"module"}' });
const importFailure = runImporter(true);
assert.equal(importFailure.closed, 0);
assert.equal(importFailure.restored, true);
assert.equal(importFailure.mapping, '{"subject":"module"}');
assert.equal(importFailure.error, 'Importación fallida');
const tutorDialog = fs.readFileSync('UiDialogTutorImport.html', 'utf8');
const commonStyles = fs.readFileSync('UiStyles.html', 'utf8');
assert.match(importDialog, /<nav class="educa-route" aria-label="Ruta en EDUCA">/);
assert.match(tutorDialog, /<nav class="educa-route" aria-label="Ruta en EDUCA">/);
assert.match(commonStyles, /\.educa-route\s*\{/);
assert.match(importDialog, /Por profesor/);
assert.match(importDialog, /Mostrar todas las asignaturas/);
assert.match(importDialog, /\.educa-body\.is-busy\{[^}]*overflow:hidden/);
assert.doesNotMatch(importDialog, /\.educa-loading\{position:absolute/);
const menu = fs.readFileSync('Main.gs', 'utf8');
assert(menu.indexOf('CP.MENU.EDUCA_IMPORT') < menu.indexOf('CP.MENU.MODULE_ENROLLMENTS'));
assert(menu.indexOf('CP.MENU.MODULE_ENROLLMENTS') < menu.indexOf('CP.MENU.MODULE_CONFIG_CREATE'));
console.log('module menu, empty enrollment state and teacher-facing copy: ok');
