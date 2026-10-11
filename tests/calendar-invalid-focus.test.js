const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('UiDialogCalendarConfig.html', 'utf8');
assert.match(html, /id="calendar-form" novalidate/);
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const data = {
  academicYear: '2026-2027',
  types: ['1º', '2º', 'Online', 'Curso de Especialización'].map((name, index) => ({
    id: `T${index}`, name, active: true, startDate: '2026-09-01', endDate: '',
    configurePractices: false, configureReview: false,
    evaluations: [{ name: '1ª evaluación', endDate: '' }],
  })),
  events: [{ id: 'E1', startDate: '2026-10-01', endDate: '', isRange: false,
    category: 'FESTIVO', appliesToAll: false, typeIds: [], description: '' }],
  categories: [{ id: 'FESTIVO', label: 'Festivo' }],
};
const elements = new Map();
const focused = [];
let invalid;
function control(dataset) {
  return { dataset, willValidate: true, validity: { valid: false },
    scrollIntoView() {}, focus() { focused.push(dataset); }, reportValidity() { return false; },
    closest: () => ({ querySelector: () => ({ textContent: 'Fecha final' }) }),
  };
}
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    textContent: '', innerHTML: '', className: '', disabled: false,
    classList: { toggle() {} }, addEventListener() {},
    get elements() { return invalid ? [invalid] : []; },
    querySelector(selector) {
      const field = /\[data-field="([^"]+)"\]/.exec(selector);
      return control(Object.assign({}, invalid.dataset, field ? { field: field[1] } : {}));
    },
  });
  return elements.get(id);
}
const context = vm.createContext({ document: {
  getElementById: element,
  createElement: () => ({ textContent: '', get innerHTML() { return this.textContent; } }),
} });
vm.runInContext(script.replace('<?!= JSON.stringify(calendarConfig) ?>', JSON.stringify(data))
  .replace('<?!= JSON.stringify(wizardStep) ?>', '0'), context);

invalid = control({ kind: 'evaluation', typeIndex: '1', itemIndex: '0', field: 'endDate' });
assert.equal(vm.runInContext('revealFirstInvalidField()', context), false);
let state = vm.runInContext('({ types: Object.values(expandedTypes), eventsExpanded })', context);
assert.deepEqual(Array.from(state.types), [false, true, false, false]);
assert.equal(state.eventsExpanded, false);
assert.equal(focused.at(-1).field, 'endDate');
assert.match(element('form-result').textContent, /Fecha final de 2º/i);

invalid = control({ kind: 'event', itemIndex: '0', field: 'startDate' });
assert.equal(vm.runInContext('revealFirstInvalidField()', context), false);
state = vm.runInContext('({ types: Object.values(expandedTypes), eventsExpanded,' +
  ' individual: Object.values(expandedEvents) })', context);
assert.equal(state.types.some(Boolean), false);
assert.equal(state.eventsExpanded, true);
assert.deepEqual(Array.from(state.individual), [true]);
assert.equal(focused.at(-1).field, 'startDate');

assert.equal(vm.runInContext('validateEventScopes()', context), false);
assert.equal(focused.at(-1).field, 'appliesToAll');
assert.match(element('form-result').textContent, /Selecciona a qué enseñanzas/);
console.log('Calendar invalid fields and event scope reveal the exact editor and focus');
