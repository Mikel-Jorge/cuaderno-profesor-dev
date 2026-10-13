const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class Element {
  constructor() {
    this.children = []; this.dataset = {}; this.hidden = false; this.disabled = false;
    this.value = ''; this.textContent = ''; this.listeners = {};
    this.classes = new Set();
    this.classList = { toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name) };
  }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  append(...children) {
    children.forEach((child, index) => {
      child.nextElementSibling = children[index + 1] || null;
      this.children.push(child);
    });
  }
  appendChild(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
  setAttribute() {}
  focus() { this.focused = true; }
  scrollIntoView(options) { this.scrolled = options; }
}
const ids = Object.fromEntries(['file-form', 'action', 'close', 'back', 'error', 'loading',
  'loading-label', 'intro', 'preview', 'group', 'students', 'count', 'emails',
  'tutor-body', 'tutor-actions'].map(id => [id, new Element()]));
ids.intro.hidden = false;
ids.preview.hidden = true;
ids.loading.hidden = true;
ids.back.hidden = true;
ids['file-form'].elements = { archivo: new Element(), emails: ids.emails };
ids['file-form'].elements.archivo.files = [];
const student = { key: 'KEY', surname: 'Apellido', name: 'Nombre', email: 'known@example.test' };
let previewStudents = [student];
let importResult = { ok: true, academicImported: true, contactsOk: true };
let backendThrows = false, closes = 0, imports = 0;
let duringImport;
const document = {
  getElementById: id => ids[id],
  createElement: () => new Element(),
  querySelectorAll: selector => selector === '.tutor-row input'
    ? ids.students.children.filter(row => row.className === 'tutor-row').map(row => row.children[1].children[0]) : [],
};
const run = {
  withSuccessHandler(callback) { this.success = callback; return this; },
  withFailureHandler(callback) { this.failure = callback; return this; },
  analizarArchivoTutorEduca() { this.success({ group: 'DAM 2A', students: previewStudents }); },
  importarAlumnadoTutoria() {
    imports++;
    duringImport = { previewHidden: ids.preview.hidden, introHidden: ids.intro.hidden,
      loadingVisible: !ids.loading.hidden, actionsHidden: ids['tutor-actions'].hidden,
      overflowLocked: ids['tutor-body'].classes.has('is-busy'),
      email: document.querySelectorAll('.tutor-row input')[0].value };
    if (backendThrows) this.failure({ message: 'Servicio no disponible.' });
    else this.success(importResult);
  },
};
const source = fs.readFileSync('UiDialogTutorImport.html', 'utf8');
assert.match(source, /\.tutor-body\.is-busy\{overflow:hidden\}/);
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
const context = vm.createContext({ document, google: { script: { run,
  host: { close: () => { closes++; } } } } });
vm.runInContext(script, context);
assert(source.includes('id="action" disabled'));
ids['file-form'].elements.archivo.listeners.change();
assert.strictEqual(ids.action.disabled, true);
ids['file-form'].elements.archivo.files = [{}];
ids['file-form'].elements.archivo.listeners.change();
assert.strictEqual(ids.action.disabled, false);
ids.action.listeners.click();
assert.strictEqual(ids.intro.hidden, true);
assert.strictEqual(ids.preview.hidden, false);
assert.strictEqual(ids.students.children.length, 2);
assert.strictEqual(ids.students.children[1].children[1].children[0].value, 'known@example.test');
assert.strictEqual(ids.count.textContent, '1 de 1 correos válidos');
assert.strictEqual(ids.action.disabled, false);
const first = ids.students.children[1].children[1].children[0];
first.value = '';
first.listeners.input();
assert.strictEqual(ids.action.disabled, false);
const beforeInvalid = imports;
ids.action.listeners.click();
assert.equal(imports, beforeInvalid);
assert.equal(first.focused, true);
assert.equal(first.scrolled.block, 'center');
assert.match(ids.error.textContent, /Completa o corrige/);
assert.equal(first.nextElementSibling.textContent, 'Introduce el Email.');
first.value = 'texto-invalido';
first.listeners.input();
ids.action.listeners.click();
assert.equal(imports, beforeInvalid);
assert.equal(first.nextElementSibling.textContent, 'Revisa el formato del Email.');
first.value = 'known@example.test';
first.listeners.input();
ids.action.listeners.click();
assert.strictEqual(closes, 1);
assert.deepStrictEqual(duringImport, { previewHidden: true, introHidden: true,
  loadingVisible: true, actionsHidden: true, overflowLocked: true,
  email: 'known@example.test' });
assert.strictEqual(ids.preview.hidden, true, 'el éxito cierra sin volver al formulario');
vm.runInContext('busy=false', context);

importResult = { ok: false, academicImported: false, message: 'Email inválido.' };
ids.action.listeners.click();
assert.strictEqual(closes, 1);
assert.strictEqual(ids.preview.hidden, false);
assert.strictEqual(ids.loading.hidden, true);
assert.strictEqual(ids.error.textContent, 'Email inválido.');

backendThrows = true;
ids.action.listeners.click();
assert.strictEqual(closes, 1);
assert.strictEqual(ids.preview.hidden, false);
assert.strictEqual(ids.loading.hidden, true);
assert.strictEqual(ids['tutor-actions'].hidden, false);
assert.strictEqual(ids['tutor-body'].classes.has('is-busy'), false);
assert.strictEqual(first.value, 'known@example.test');
assert.strictEqual(ids.error.textContent, 'Servicio no disponible.');

backendThrows = false;
importResult = { ok: true, academicImported: true, contactsOk: false,
  contactsWarning: 'No se ha podido actualizar Google Contacts.' };
ids.action.listeners.click();
assert.strictEqual(closes, 2);
vm.runInContext('busy=false', context);
ids.back.listeners.click();
ids['file-form'].elements.archivo.files = [];
ids['file-form'].elements.archivo.listeners.change();
assert.equal(ids.action.disabled, true);
previewStudents = Array.from({ length: 5 }, (_, index) => ({
  key: 'KEY-' + index, surname: 'Apellido ' + index, name: 'Nombre',
  email: index === 4 ? '' : `alumno${index}@example.test`,
}));
ids['file-form'].elements.archivo.files = [{}];
ids['file-form'].elements.archivo.listeners.change();
ids.action.listeners.click();
assert.equal(ids.count.textContent, '4 de 5 correos válidos');
assert.equal(ids.action.disabled, false);
const lastInput = document.querySelectorAll('.tutor-row input')[4];
const beforeFive = imports;
ids.action.listeners.click();
assert.equal(imports, beforeFive);
assert.equal(lastInput.focused, true);
assert.equal(lastInput.scrolled.block, 'center');
console.log('Tutor import UI: preview, emails, close, academic error and failure handler: ok');
