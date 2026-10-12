const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class Element {
  constructor() {
    this.children = []; this.dataset = {}; this.hidden = false; this.disabled = false;
    this.value = ''; this.textContent = ''; this.listeners = {};
    this.classList = { toggle() {} };
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
}
const ids = Object.fromEntries(['file-form', 'action', 'close', 'back', 'error', 'loading',
  'loading-label', 'intro', 'preview', 'group', 'students', 'count', 'emails'].map(id => [id, new Element()]));
ids.intro.hidden = false;
ids.preview.hidden = true;
ids.loading.hidden = true;
ids.back.hidden = true;
ids['file-form'].elements = { archivo: { files: [{}] }, emails: ids.emails };
const student = { key: 'KEY', surname: 'Apellido', name: 'Nombre', email: 'known@example.test' };
let importResult = { ok: true, academicImported: true, contactsOk: true };
let backendThrows = false, closes = 0;
const document = {
  getElementById: id => ids[id],
  createElement: () => new Element(),
  querySelectorAll: selector => selector === '.tutor-row input'
    ? ids.students.children.map(row => row.children[1].children[0]) : [],
};
const run = {
  withSuccessHandler(callback) { this.success = callback; return this; },
  withFailureHandler(callback) { this.failure = callback; return this; },
  analizarArchivoTutorEduca() { this.success({ group: 'DAM 2A', students: [student] }); },
  importarAlumnadoTutoria() {
    if (backendThrows) this.failure({ message: 'Servicio no disponible.' });
    else this.success(importResult);
  },
};
const source = fs.readFileSync('UiDialogTutorImport.html', 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
const context = vm.createContext({ document, google: { script: { run,
  host: { close: () => { closes++; } } } } });
vm.runInContext(script, context);
ids.action.listeners.click();
assert.strictEqual(ids.intro.hidden, true);
assert.strictEqual(ids.preview.hidden, false);
assert.strictEqual(ids.students.children.length, 1);
assert.strictEqual(ids.students.children[0].children[1].children[0].value, 'known@example.test');
assert.strictEqual(ids.count.textContent, '1 de 1 correos completados');
assert.strictEqual(ids.action.disabled, false);
ids.action.listeners.click();
assert.strictEqual(closes, 1);
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
assert.strictEqual(ids.error.textContent, 'Servicio no disponible.');

backendThrows = false;
importResult = { ok: true, academicImported: true, contactsOk: false,
  contactsWarning: 'No se ha podido actualizar Google Contacts.' };
ids.action.listeners.click();
assert.strictEqual(closes, 2);
console.log('Tutor import UI: preview, emails, close, academic error and failure handler: ok');
