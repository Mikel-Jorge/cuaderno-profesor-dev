const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('UiDialogScheduleConfig.html', 'utf8');
const start = source.indexOf('function handleAction(event) {');
const end = source.indexOf('function removeSlot(id)', start);
assert(start >= 0 && end > start);
const context = vm.createContext({
  expandedActivities: { A: true, B: false, C: false },
  isBlocked: false, isSaving: false,
  renderActivities() {}, updateSaveButton() {},
});
vm.runInContext(source.slice(start, end), context);
function toggle(id) {
  const button = { dataset: { action: 'toggle-activity', id } };
  context.handleAction({ target: { closest: () => button } });
}
toggle('B');
assert.deepStrictEqual(Object.values(context.expandedActivities), [false, true, false]);
toggle('C');
assert.deepStrictEqual(Object.values(context.expandedActivities), [false, false, true]);
toggle('C');
assert.deepStrictEqual(Object.values(context.expandedActivities), [false, false, false]);
assert(source.includes('expandedActivities[activity.id] = true; openOnlySection'));
assert(source.includes('placeholder="Docente de apoyo"'));
assert(source.includes('aria-label="Docente de apoyo"'));
console.log('exclusive activity accordion and support label: ok');
