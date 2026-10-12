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
console.log('Dialog footers and Contacts UI: ok');
