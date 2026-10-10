const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync('Calendar.gs', 'utf8'), context);
context.parseCalendarDate_ = value => value;
const base = { id: 'event', category: 'REUNION', startDate: '2027-01-10',
  endDate: '2027-01-10', description: '', appliesToAll: false };
let event = context.normalizeCalendarEvent_(
  { ...base, typeIds: ['FP1', 'CE'] }, 'Europe/Madrid', ['FP1', 'FP2']);
assert.deepStrictEqual(Array.from(event.typeIds), ['FP1']);
event = context.normalizeCalendarEvent_(
  { ...base, typeIds: ['FP1', 'FP2', 'CE'] }, 'Europe/Madrid', ['FP1', 'FP2']);
assert.deepStrictEqual(Array.from(event.typeIds), []);
const model = { activeTypes: [{ id: 'FP1', name: '1º' }, { id: 'FP2', name: '2º' }],
  activeTypeIds: ['FP1', 'FP2'], events: [{ category: 'REUNION',
    description: '', typeIds: ['FP1'] }], timeZone: 'Europe/Madrid' };
context.getCalendarEventsForTypeIdsFromList_ = () => model.events;
context.getEvaluationEndNotesForDate_ = () => [];
context.getPracticeMilestonesForDate_ = () => [];
assert.strictEqual(context.buildCalendarDayNote_('2027-01-10', model), 'Aplica a: 1º');
model.events[0].typeIds = [];
model.events[0].description = 'Reunión de evaluación';
assert.strictEqual(context.buildCalendarDayNote_('2027-01-10', model),
  'Reunión de evaluación\nAplica a: 1º, 2º');
console.log('calendar active scopes and event notes: ok');
