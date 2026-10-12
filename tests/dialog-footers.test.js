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
  const bodyClass = ({
    'UiDialogMatriculas.html': 'enrollment-body', 'UiDialogEducaImport.html': 'educa-body',
    'UiDialogContacts.html': 'contacts-body', 'UiDialogTutorImport.html': 'tutor-body',
  }[name]);
  const loadingClass = bodyClass.replace('-body', '-loading');
  assert(html.includes('.' + bodyClass + '{position:relative'), name + ' sin contenedor relativo');
  assert(html.includes('.' + loadingClass + '{position:absolute;inset:0') ||
    html.includes('.' + loadingClass + '{display:grid'), name + ' sin loading dentro del contenido');
  const markup = html.slice(0, html.indexOf('<script>')).replace(/<style>[\s\S]*?<\/style>/g, '');
  const stack = [], parents = {};
  for (const match of markup.matchAll(/<(\/)?([a-z][\w-]*)([^>]*)>/gi)) {
    if (match[1]) { stack.pop(); continue; }
    const id = match[3].match(/\bid="([^"]+)"/);
    const classes = match[3].match(/\bclass="([^"]+)"/);
    if (id) parents[id[1]] = stack.map(item => item.classes).join(' ');
    if (!/^(base|meta|img|input|br|hr|link)$/i.test(match[2]) && !/\/\s*$/.test(match[3])) {
      stack.push({ classes: classes ? classes[1] : '' });
    }
  }
  assert(parents.loading.includes(bodyClass), name + ' loading fuera del contenido');
  assert(!parents.close?.includes(bodyClass), name + ' botón cubierto por contenido');
}
console.log('Dialog footers and Contacts UI: ok');
