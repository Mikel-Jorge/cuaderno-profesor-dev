const assert = require('node:assert/strict');
const fs = require('node:fs');

const dialogs = fs.readdirSync('.').filter(name => /^UiDialog.*\.html$/.test(name));
assert(dialogs.length >= 12);
for (const name of dialogs) {
  const source = fs.readFileSync(name, 'utf8');
  const footers = [...source.matchAll(/<footer class="author-footer">([\s\S]*?)<\/footer>/g)];
  assert(footers.length, name + ' no tiene footer de autor');
  for (const [, footer] of footers) {
    assert(footer.includes('uiConfig.author'), name + ' no muestra el autor');
    assert(footer.includes('mailto:<?= uiConfig.authorEmail ?>'), name + ' no enlaza el correo');
    assert(footer.includes('<?= uiConfig.authorEmail ?>'), name + ' no muestra el correo');
    assert(/&middot;|·/.test(footer), name + ' no usa el separador');
  }
  assert(!source.includes('<small>© <?= uiConfig.author ?></small>'), name + ' conserva un pie divergente');
}
const contacts = fs.readFileSync('UiDialogContacts.html', 'utf8');
assert(contacts.includes('id="loading" role="status"'));
assert(contacts.includes('.analizarGoogleContacts();'));
assert(!contacts.includes('>Analizar Google Contacts</button>'));
assert(!contacts.includes('Confirmar sincronización'));
assert(contacts.includes("document.getElementById('intro').hidden=true"));
assert(contacts.includes('Google Contacts actualizado con incidencias'));
const tutor = fs.readFileSync('UiDialogTutorImport.html', 'utf8');
for (const step of ['Alumnado', 'Informes', 'Listado mi alumnado', 'Por grupo', 'Excel',
  'Todos los alumnos', 'Enviar']) assert(tutor.includes(step));
assert(tutor.includes('input.value=student.email||'));
assert(tutor.includes('complete!==inputs.length'));
assert(tutor.includes('importarAlumnadoTutoria(form)'));
for (const name of ['UiDialogMatriculas.html', 'UiDialogEducaImport.html',
  'UiDialogContacts.html', 'UiDialogTutorImport.html']) {
  const html = fs.readFileSync(name, 'utf8');
  const bodyStart = html.indexOf('class="' + ({
    'UiDialogMatriculas.html': 'enrollment-body', 'UiDialogEducaImport.html': 'educa-body',
    'UiDialogContacts.html': 'contacts-body', 'UiDialogTutorImport.html': 'tutor-body',
  }[name]) + '"');
  assert(bodyStart > 0 && bodyStart < html.indexOf('id="loading"'), name + ' loading fuera del contenido');
  assert(html.indexOf('id="loading"') < html.indexOf('<footer class="author-footer"'), name);
}
console.log('Dialog footers and Contacts UI: ok');
