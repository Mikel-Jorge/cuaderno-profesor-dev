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
  }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  addEventListener() {}
  setAttribute(name, value) { this[name] = value; }
}
function renderWith(result) {
  const ids = ['module', 'students', 'save', 'error', 'loading', 'loading-label',
    'mode-note', 'selection-tools', 'select-all', 'select-none', 'close'];
  const nodes = Object.fromEntries(ids.map(id => [id, new Node(id)]));
  const runner = { withSuccessHandler(handler) { this.success = handler; return this; },
    withFailureHandler() { return this; },
    obtenerDatosMatriculasModulos() { this.success(result); } };
  vm.runInNewContext(script, {
    document: { getElementById: id => nodes[id], createElement: () => new Node() },
    google: { script: { run: runner, host: { close() {} } } },
  });
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
assert.match(importDialog, /El grupo de EDUCA/);
assert.match(importDialog, /manualDifferentGroups/);
const menu = fs.readFileSync('Main.gs', 'utf8');
assert(menu.indexOf('CP.MENU.EDUCA_IMPORT') < menu.indexOf('CP.MENU.MODULE_ENROLLMENTS'));
assert(menu.indexOf('CP.MENU.MODULE_ENROLLMENTS') < menu.indexOf('CP.MENU.MODULE_CONFIG_CREATE'));
console.log('module menu, empty enrollment state and teacher-facing copy: ok');
