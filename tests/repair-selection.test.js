const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const calls = [];
const keys = ['cover', 'calendar', 'schedule', 'students', 'config', 'tracking', 'evaluation'];
const context = {
  CP_REPAIR_SKIP_COVER: false,
  CP: { UI: { INIT_PROCESS_ID: 'initialize-notebook', NEW_COURSE_PROCESS_ID: 'prepare-new-course' },
    MENU: { INIT: 'Reparar estructura' } },
};
[
  'initializeConfigStructure_', 'initializeCalendarStructure_',
  'ensureScheduleTechnicalStructure_', 'ensureModuleConfigTechnicalStructure_',
  'cleanupOrphanModuleConfigsWithLock_', 'initializeCoverStructure_',
  'createOrRepairCalendarSheet_', 'createOrRepairScheduleSheet_',
  'createOrRepairStudentsSheet_', 'repairExistingModuleConfigSheets_',
  'initializeMetaStructure_',
  'finishSelectiveRepair_',
].forEach(name => { context[name] = () => { calls.push(name); }; });
context.repairManagedModuleConsumerSheets_ = options => { calls.push('repairManagedModuleConsumerSheets_'); calls.push(JSON.stringify(options)); return { trackingRepaired: options.tracking ? 2 : 0, evaluationsRepaired: options.evaluation ? 1 : 0, evaluationsRecreated: 0 }; };
vm.createContext(context);
vm.runInContext(fs.readFileSync('Ui.gs', 'utf8'), context);

const all = Object.fromEntries(keys.map(key => [key, true]));
const none = Object.fromEntries(keys.map(key => [key, false]));
const selected = { ...none, students: true, evaluation: true };
const process = context.getUiProcessDefinition_('initialize-notebook', selected);
assert.strictEqual(process.steps.length, 5);
assert.strictEqual(JSON.stringify(process.steps.map(step => step.completedMessage)), JSON.stringify([
  'Estructura técnica comprobada.', 'Alumnado reparado.',
  'Reparación de Seguimiento y Evaluación finalizada.', 'Metadatos actualizados.',
  'Mantenimiento finalizado.',
]));
process.steps.forEach(step => step.run(selected));
assert(calls.includes('repairManagedModuleConsumerSheets_'));
assert(calls.includes(JSON.stringify({ tracking: false, evaluation: true })));
assert.strictEqual(context.formatRepairConsumerResult_({ trackingRepaired: 0, evaluationsRepaired: 0, evaluationsRecreated: 0 }, all), 'No hay Seguimientos ni Evaluaciones que reparar.');
assert.strictEqual(context.formatRepairConsumerResult_({ trackingRepaired: 0, evaluationsRepaired: 0, evaluationsRecreated: 1 }, all), '1 Evaluación recreada.');
assert(!calls.includes('initializeCoverStructure_'));
assert.strictEqual(context.getUiProcessDefinition_('initialize-notebook', none).steps.length, 3);
assert.strictEqual(context.getUiProcessDefinition_('initialize-notebook', all).steps.length, 9);
const visibleRunners = {
  cover: 'initializeCoverStructure_', calendar: 'createOrRepairCalendarSheet_',
  schedule: 'createOrRepairScheduleSheet_', students: 'createOrRepairStudentsSheet_',
  config: 'repairExistingModuleConfigSheets_', tracking: 'repairManagedModuleConsumerSheets_',
  evaluation: 'repairManagedModuleConsumerSheets_',
};
keys.forEach(key => {
  calls.length = 0;
  const choice = { ...none, [key]: true };
  context.getUiProcessDefinition_('initialize-notebook', choice).steps.forEach(step => step.run(choice));
  assert.strictEqual(JSON.stringify(calls.filter(name => Object.values(visibleRunners).includes(name))),
    JSON.stringify([visibleRunners[key]]));
});
for (const pair of [['config', 'evaluation'], ['students', 'evaluation']]) {
  const choice = { ...none, [pair[0]]: true, [pair[1]]: true };
  const count = context.getUiProcessDefinition_('initialize-notebook', choice).steps.length;
  assert.strictEqual(count, 5);
}
calls.length = 0;
const both = context.getUiProcessDefinition_('initialize-notebook', all);
both.steps.forEach(step => step.run(all));
assert.strictEqual(calls.filter(name => name === 'repairManagedModuleConsumerSheets_').length, 1);
assert(calls.includes(JSON.stringify({ tracking: true, evaluation: true })));
assert.throws(() => context.normalizeRepairSelection_({ cover: true }), /no válida/);
assert.throws(() => context.normalizeRepairSelection_(null), /Selecciona/);

calls.length = 0;
context.ejecutarPasoProcesoUi('initialize-notebook', 0, none);
assert.strictEqual(context.CP_REPAIR_SKIP_COVER, false);
assert(calls.includes('cleanupOrphanModuleConfigsWithLock_'));
console.log('repair selection: ok');
