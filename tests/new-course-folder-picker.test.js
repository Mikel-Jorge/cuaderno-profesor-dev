const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('UiDialogNewCourse.html', 'utf8');
const script = html.slice(html.indexOf('function openFolderPicker(){'), html.indexOf('</script>'));

class Node {
  constructor(tag = 'div') {
    this.tag = tag; this.children = []; this.events = {}; this.attributes = {};
    this.dataset = {}; this.hidden = false; this.disabled = false; this.textContent = '';
    this.className = ''; this.scrollTop = 0;
    this.classList = { toggle: (name, enabled) => {
      const names = new Set(this.className.split(' ').filter(Boolean));
      if (enabled) names.add(name); else names.delete(name);
      this.className = [...names].join(' ');
    } };
  }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, handler) { this.events[name] = handler; }
  trigger(name) { this.events[name](); }
  querySelector(selector) {
    return this.children.find(child => child.className === selector.slice(1));
  }
}

const ids = ['folder-picker', 'folder-loading', 'folder-list', 'folder-empty',
  'folder-error-state', 'folder-error', 'folder-select', 'folder-back',
  'folder-path', 'folder-selected', 'folder-list-region', 'destination-folder'];
const nodes = Object.fromEntries(ids.map(id => [id, new Node()]));
const document = {
  getElementById: id => nodes[id], createElement: tag => new Node(tag),
  querySelectorAll(selector) {
    if (selector === '#folder-list button') return nodes['folder-list'].children;
    if (selector === '#folder-path button') return nodes['folder-path'].children.filter(node => node.tag === 'button');
    throw new Error(selector);
  },
};
const views = {
  root: { id: 'root', name: 'Mi unidad', parentId: '', path: [{ id: 'root', name: 'Mi unidad' }],
    folders: [{ id: 'A', name: 'A' }] },
  A: { id: 'A', name: 'A', parentId: 'root', path: [{ id: 'root', name: 'Mi unidad' },
    { id: 'A', name: 'A' }], folders: [{ id: 'B', name: 'B' }] },
  B: { id: 'B', name: 'B', parentId: 'A', path: [{ id: 'root', name: 'Mi unidad' },
    { id: 'A', name: 'A' }, { id: 'B', name: 'B' }], folders: [{ id: 'C', name: 'C' }] },
  C: { id: 'C', name: 'C', parentId: 'B', path: [{ id: 'root', name: 'Mi unidad' },
    { id: 'A', name: 'A' }, { id: 'B', name: 'B' }, { id: 'C', name: 'C' }], folders: [] },
};
const calls = [];
const context = vm.createContext({ document, pickerFolder: null, pickerSelectedFolder: null,
  requestedFolderId: null, folderLoadToken: 0,
  selectedFolder: { id: 'original', name: 'Original' },
  callServer: (method, id) => { calls.push([method, id]); return Promise.resolve(views[id || 'root']); },
  errorText: error => error.message || String(error), String,
});
vm.runInContext(script, context);
const flush = () => new Promise(resolve => setImmediate(resolve));

(async () => {
  context.openFolderPicker();
  assert.strictEqual(nodes['folder-loading'].hidden, false);
  assert.strictEqual(nodes['folder-select'].disabled, true);
  await flush();
  assert.strictEqual(nodes['folder-back'].hidden, true);
  assert.strictEqual(nodes['folder-path'].children.length, 1);
  assert.strictEqual(nodes['folder-path'].children[0].textContent, 'Mi unidad');
  assert.strictEqual(nodes['folder-selected'].textContent, 'Se usará: Mi unidad');

  let row = nodes['folder-list'].children[0];
  row.trigger('click');
  assert.strictEqual(calls.length, 1, 'un clic no hace una llamada remota');
  assert.strictEqual(row.attributes['aria-pressed'], 'true');
  assert(row.className.includes('is-selected'));
  assert.strictEqual(nodes['folder-selected'].textContent, 'Seleccionada: A');
  context.confirmFolderSelection();
  assert.strictEqual(context.selectedFolder.id, 'A', 'se puede elegir la hija sin abrirla');

  context.openFolderPicker(); await flush();
  row = nodes['folder-list'].children[0];
  row.trigger('click'); row.trigger('dblclick');
  assert.strictEqual(calls.at(-1)[1], 'A', 'solo el doble clic abre la carpeta');
  assert.strictEqual(nodes['folder-loading'].hidden, false);
  assert.strictEqual(nodes['folder-list'].hidden, true);
  await flush();
  assert.strictEqual(context.pickerSelectedFolder, null);
  assert.strictEqual(nodes['folder-back'].hidden, false);
  assert.strictEqual(nodes['folder-path'].children[0].tag, 'button');
  for (const id of ['B', 'C']) {
    row = nodes['folder-list'].children[0]; row.trigger('click'); row.trigger('dblclick'); await flush();
    assert.strictEqual(context.pickerFolder.id, id);
  }
  assert.strictEqual(nodes['folder-path'].children.length, 7);
  assert.strictEqual(nodes['folder-empty'].hidden, false);
  assert.strictEqual(nodes['folder-selected'].textContent, 'Se usará: C');
  assert.strictEqual(nodes['folder-select'].disabled, false);
  context.loadFolder(context.pickerFolder.parentId); await flush();
  assert.strictEqual(context.pickerFolder.id, 'B', 'Atrás sube un nivel');
  nodes['folder-path'].children[2].trigger('click'); await flush();
  assert.strictEqual(context.pickerFolder.id, 'A', 'breadcrumb salta al ancestro');
  context.closeFolderPicker();
  assert.strictEqual(context.selectedFolder.id, 'A', 'cancelar no cambia la carpeta confirmada');

  assert(html.includes('html,body{height:100%;overflow:hidden}'));
  assert(html.includes('overflow-y:auto;border:1px solid var(--border)'));
  assert(html.includes('class="folder-rows"'));
  assert(!html.includes('class="folder-list"'));
  assert(html.includes('.course-body{flex:1 1 auto;min-height:0;overflow-y:auto'));
  assert(html.includes('.course-footer{flex:0 0 auto'));
  console.log('folder picker click, double click, breadcrumb, back and scroll structure: ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
