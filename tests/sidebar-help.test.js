const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync('Sidebar.gs', 'utf8'), context);
vm.runInContext(fs.readFileSync('Config.gs', 'utf8'), context);
const feedbackUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSeGNIgzDp0hLj8vymzhPSuRBqkS1RNe5l2pRughEmRmwNjNBw/viewform?usp=publish-editor';
assert.strictEqual(vm.runInContext('CP.FEEDBACK_FORM_URL', context), feedbackUrl);
context.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getActiveSheet: () => ({ getName: () => '0 Portada' }) }) };
context.getGeneralConfigValues_ = () => ({});
context.getSidebarStateItems_ = () => [];
context.getModuleConfigActivityIdForSheet_ = () => '';
context.getManagedProtectionKind_ = () => '';
context.getModuleConsumerActivityIdForSheet_ = () => '';
context.getActiveTheme_ = () => ({});
context.createUiThemeCss_ = () => '';
assert.strictEqual(context.getSidebarData_().feedbackFormUrl, feedbackUrl);
const sections = context.getSidebarHelpSections_('evaluation');
const importHelp = sections.find(item => item.id === 'educa-import');
const enrollmentHelp = sections.find(item => item.id === 'module-enrollments');
assert(importHelp && enrollmentHelp);
const helpSearch = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
['EDUCA', 'importar', 'alumnado', 'Excel', 'XLS', 'Centro', 'correo', 'email'].forEach(term => {
  assert(helpSearch([importHelp.title, importHelp.text, importHelp.keywords,
    importHelp.bullets.join(' ')].join(' ')).includes(helpSearch(term)), term);
});
['matrícula', 'módulo'].forEach(term => {
  assert(helpSearch([enrollmentHelp.title, enrollmentHelp.text, enrollmentHelp.keywords]
    .join(' ')).includes(helpSearch(term)), term);
});
assert.strictEqual(sections[0].id, 'evaluation');
assert.strictEqual(sections.filter(item => item.open).length, 1);
assert(sections.every(item => item.icon && item.subtitle && item.keywords));
const faq = sections.find(item => item.id === 'troubleshooting').faqs;
const questions = faq.map(item => item[0]).join(' ');
['FEOE', 'MH', 'OLD', 'REACA', 'Peso'].forEach(term => {
  assert(questions.includes(term) || sections.some(item => item.text.includes(term)));
});
const html = fs.readFileSync('UiSidebar.html', 'utf8');
assert(/<a[^>]*id="feedback-link"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*>Enviar error o propuesta ↗<\/a>/.test(html));
assert(html.indexOf('id="sections"') < html.indexOf('id="feedback-card"'));
assert(html.indexOf('id="feedback-card"') < html.indexOf('class="help-footer"'));
assert(!html.includes(feedbackUrl));
const feedbackCard = html.match(/<section class="feedback-card"[\s\S]*?<\/section>/)[0];
const feedbackText = feedbackCard.replace(/<[^>]+>/g, ' ');
const feedbackContext = vm.createContext({ document: { getElementById: () => ({ textContent: feedbackText }) } });
vm.runInContext(html.slice(html.indexOf('function normalize('), html.indexOf('function element(')), feedbackContext);
['error', 'problema', 'mejora', 'sugerencia', 'feedback', 'duda', 'comentario'].forEach(term => {
  assert.strictEqual(feedbackContext.feedbackMatches(term), true, term);
});
assert.strictEqual(feedbackContext.feedbackMatches('calendario'), false);
assert(!fs.readFileSync('appsscript.json', 'utf8').includes('oauthScopes'));
assert(!fs.readdirSync('.').filter(name => /\.(gs|html)$/.test(name)).some(name => fs.readFileSync(name, 'utf8').includes('FormApp')));
assert(html.includes("normalize('NFD')"));
assert(html.includes("items.filter(function(item){return item.status==='complete'}).length"));
assert(html.includes('status-detail'));
assert(html.includes('faq-item'));
assert(!html.includes('Estás en'));
assert(html.includes("document.getElementById('status-card').hidden=Boolean(query)"));
assert(html.includes('toggle.hidden=!ok'));
assert(html.includes("if(item.status==='complete')detail.appendChild(row);else pending.appendChild(row)"));
assert(!html.includes('setInterval('));
class Node {
  constructor() { this.children = []; this.style = {}; this.hidden = false; this.attributes = {}; }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attributes[key] = value; }
  get childElementCount() { return this.children.length; }
}
const nodes = Object.fromEntries(['status-count', 'status-pending', 'status-detail',
  'status-toggle', 'status-progress', 'status-fill'].map(id => [id, new Node()]));
const statusContext = vm.createContext({
  data: { stateItems: [{ label: 'Calendario', status: 'pending', statusLabel: 'Pendiente' }] },
  document: { getElementById: id => nodes[id] },
  element: (tag, cls, text) => { const node = new Node(); node.textContent = text; return node; },
});
vm.runInContext(html.slice(html.indexOf('function renderStatus()'),
  html.indexOf('function renderHelpSections()')), statusContext);
statusContext.renderStatus();
assert.strictEqual(nodes['status-toggle'].hidden, true);
assert.strictEqual(nodes['status-pending'].childElementCount, 1);
statusContext.data.stateItems.push({ label: 'Horario', status: 'complete', statusLabel: 'Configurado' });
statusContext.renderStatus();
assert.strictEqual(nodes['status-toggle'].hidden, false);
assert.strictEqual(nodes['status-toggle'].textContent, 'Ver 1 completados');
assert.strictEqual(nodes['status-detail'].childElementCount, 1);
assert.strictEqual(nodes['status-pending'].childElementCount, 1);
statusContext.data.stateItems.shift();
statusContext.renderStatus();
assert.strictEqual(nodes['status-toggle'].textContent, 'Ver 1 completados');
assert.strictEqual(nodes['status-pending'].children[0].textContent, '✓ Todo correcto');
assert.strictEqual(nodes['status-detail'].childElementCount, 1);
console.log('sidebar help model and client search/status: ok');
