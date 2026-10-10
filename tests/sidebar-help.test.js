const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync('Sidebar.gs', 'utf8'), context);
const sections = context.getSidebarHelpSections_('evaluation');
assert.strictEqual(sections[0].id, 'evaluation');
assert.strictEqual(sections.filter(item => item.open).length, 1);
assert(sections.every(item => item.icon && item.subtitle && item.keywords));
const faq = sections.find(item => item.id === 'troubleshooting').faqs;
const questions = faq.map(item => item[0]).join(' ');
['FEOE', 'MH', 'OLD', 'REACA', 'Peso'].forEach(term => {
  assert(questions.includes(term) || sections.some(item => item.text.includes(term)));
});
const html = fs.readFileSync('UiSidebar.html', 'utf8');
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
