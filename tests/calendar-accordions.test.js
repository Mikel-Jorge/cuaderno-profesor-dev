const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('UiDialogCalendarConfig.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const initialData = {
  academicYear: '2026-2027',
  types: ['1º', '2º', 'Online', 'Curso de Especialización'].map((name, index) => ({
    id: `T${index}`, name, active: false, startDate: '', endDate: '',
    configurePractices: false, configureReview: false, evaluations: [],
  })),
  events: ['A', 'B'].map((description, index) => ({
    id: `E${index}`, startDate: '2026-10-01', endDate: '2026-10-01',
    isRange: false, category: 'FESTIVO', appliesToAll: true,
    typeIds: [], description,
  })),
  categories: [{ id: 'FESTIVO', label: 'Festivo' }],
};
const elements = new Map();
const handlers = {};
function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      textContent: '', innerHTML: '', disabled: false,
      addEventListener(name, handler) { handlers[`${id}:${name}`] = handler; },
    });
  }
  return elements.get(id);
}
const context = vm.createContext({
  document: {
    getElementById: element,
    createElement: () => ({ textContent: '', get innerHTML() { return this.textContent; } }),
  },
});
vm.runInContext(script.replace('<?!= JSON.stringify(calendarConfig) ?>',
  JSON.stringify(initialData)).replace('<?!= JSON.stringify(wizardStep) ?>', '0'), context);
const click = (action, typeIndex, itemIndex) => {
  const dataset = { action };
  if (typeIndex !== undefined) dataset.typeIndex = String(typeIndex);
  if (itemIndex !== undefined) dataset.itemIndex = String(itemIndex);
  handlers['calendar-form:click']({ target: { closest: () => ({ dataset }) } });
};
const state = () => vm.runInContext('({ types: Object.values(expandedTypes), eventsExpanded,' +
  ' individual: Object.values(expandedEvents) })', context);

assert.equal(state().eventsExpanded, false);
click('toggle-type', 0);
assert.deepEqual(Array.from(state().types), [true, false, false, false]);
for (const index of [1, 2, 3]) {
  click('toggle-type', index);
  assert.equal(state().types.filter(Boolean).length, 1);
  assert.equal(state().types[index], true);
}
click('toggle-events');
assert.equal(state().types.filter(Boolean).length, 0);
assert.equal(state().eventsExpanded, true);
click('toggle-event', undefined, 0);
click('toggle-event', undefined, 1);
assert.equal(state().individual.filter(Boolean).length, 1);
click('toggle-type', 0);
assert.equal(state().eventsExpanded, false);
assert.equal(state().individual.length, 0);
click('toggle-events');
assert.equal(state().eventsExpanded, true);
assert.equal(state().individual.length, 0);
console.log('Calendar main and nested accordion exclusivity passed');
