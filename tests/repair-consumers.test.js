const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function run(records, options, available) {
  const calls = [];
  const sheets = new Map(Object.entries(available || {}).map(([id, value]) => [Number(id), value]));
  const spreadsheet = {
    getSheetByName: () => ({ registry: true }),
    insertSheet: name => {
      const sheet = { id: 100, name, getSheetId() { return this.id; } };
      calls.push('insert'); sheets.set(sheet.id, sheet); return sheet;
    },
    deleteSheet: () => calls.push('delete'),
  };
  const context = {
    CP: { SHEETS: { MODULE_CONFIG: '_MOD_CONFIG' } },
    CP_MODULE_CONFIG_HEADERS: [],
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    readModuleConfigRegistry_: () => { calls.push('read'); return records; },
    getSheetById_: (_, id) => sheets.get(id),
    isRegisteredModuleTrackingSheet_: sheet => Boolean(sheet && sheet.tracking),
    formatAndRepairTrackingSheet_: () => calls.push('tracking'),
    getModuleActivityById_: () => ({ name: 'Módulo' }),
    buildManagedModuleSheetName_: () => '6 Eval',
    validateModuleConfigPrerequisites_: () => ({}),
    repairEvaluationSheet_: () => calls.push('evaluation'),
    writeModuleTable_: () => calls.push('write'),
    moduleConfigRecordToRow_: record => record,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('Tracking.gs', 'utf8'), context);
  context.isRegisteredModuleTrackingSheet_ = sheet => Boolean(sheet && sheet.tracking);
  context.formatAndRepairTrackingSheet_ = () => calls.push('tracking');
  context.buildManagedModuleSheetName_ = () => '6 Eval';
  return { result: context.repairManagedModuleConsumerSheets_(options), calls, records };
}

const empty = run([], { tracking: true, evaluation: true });
assert.deepStrictEqual(JSON.parse(JSON.stringify(empty.result)), {
  trackingRepaired: 0, evaluationsRepaired: 0, evaluationsRecreated: 0,
});
assert.deepStrictEqual(empty.calls, ['read']);

const pair = run([{ activityId: 'A', sheetId: 1, trackingSheetId: 2, evaluationSheetId: 3 }],
  { tracking: true, evaluation: true }, { 1: {}, 2: { tracking: true }, 3: {} });
assert.deepStrictEqual(pair.calls, ['read', 'tracking', 'evaluation']);
assert.deepStrictEqual(JSON.parse(JSON.stringify(pair.result)), {
  trackingRepaired: 1, evaluationsRepaired: 1, evaluationsRecreated: 0,
});

const missing = run([{ activityId: 'A', sheetId: 1, trackingSheetId: 2,
  evaluationSheetId: 0 }], { tracking: true, evaluation: true },
{ 1: {}, 2: { tracking: true } });
assert.deepStrictEqual(missing.calls, ['read', 'tracking', 'insert', 'evaluation', 'write']);
assert.strictEqual(missing.records[0].evaluationSheetId, 100);
assert.strictEqual(missing.result.evaluationsRecreated, 1);

const onlyTracking = run([{ activityId: 'A', sheetId: 1, trackingSheetId: 2,
  evaluationSheetId: 0 }], { tracking: true, evaluation: false },
{ 1: {}, 2: { tracking: true } });
assert.deepStrictEqual(onlyTracking.calls, ['read', 'tracking']);
console.log('single consumer traversal and conditional registry write: ok');
