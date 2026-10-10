const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('UiDialogNewCourse.html', 'utf8');
const source = html.slice(html.indexOf('function renderSummary(data){'),
  html.indexOf('async function applyFinalViews()'));
class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.events = {}; this.textContent = ''; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, handler) { this.events[type] = handler; }
}
const box = new Node('div');
const visited = [];
const context = vm.createContext({
  document: { getElementById: id => id === 'course-summary' ? box : null,
    createElement: tag => new Node(tag) },
  showStep: step => visited.push(step),
});
vm.runInContext(source, context);
const steps = Array.from({ length: 7 }, () => ({ reviewed: false, complete: false, reason: '' }));
steps[1] = { reviewed: true, complete: false, reason: 'Falta el centro.' };
steps[2] = { reviewed: true, complete: false, reason: 'No hay tipos activos.' };
steps[3] = { reviewed: true, complete: true, reason: '' };
steps[4] = { reviewed: true, complete: true, reason: '' };
steps[5] = { reviewed: true, complete: false, reason: 'No hay sesiones asignadas.' };
context.renderSummary({ academicYear: '2027-2028', calendar: false, slots: 8,
  activities: 4, sessions: 0, steps });
assert.strictEqual(box.children.length, 4, 'introducción, card superior, grid y callout único');
const [intro, course, grid, callout] = box.children;
assert.strictEqual(intro.tag, 'p');
assert.strictEqual(course.tag, 'button');
assert.strictEqual(grid.children.length, 4);
assert.strictEqual(grid.children[1].children[1].textContent, '✓ 8 tramos');
assert.strictEqual(grid.children[2].children[1].textContent, '✓ 4 actividades');
assert.strictEqual(grid.children[3].children[2].textContent, 'No hay sesiones asignadas.');
assert.strictEqual(callout.children.length, 2, 'instrucción y siguiente paso comparten bloque');
course.events.click(); grid.children[0].events.click(); grid.children[3].events.click();
assert.deepStrictEqual(visited, [1, 2, 5]);

assert(html.includes('.course-wizard{height:100%;display:flex;flex-direction:column;min-width:0;overflow:hidden}'));
assert(html.includes('.course-body{flex:1 1 auto;min-height:0;overflow-y:auto'));
assert(html.includes('.course-footer{flex:0 0 auto'));
assert(html.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
assert(html.includes('.course-summary-grid{grid-template-columns:1fr}'));
console.log('summary states, navigation and responsive scroll structure: ok');
