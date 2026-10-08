const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const kinds = ['PORTADA', 'CALENDARIO', 'HORARIO', 'STUDENTS', 'CONFIG',
  'TRACKING', 'EVALUATION', 'TECNICA', 'TRACKING_OLD', ''];
const installed = [];
const context = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheets: () => kinds.map(kind => ({ kind })) }) },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('Protections.gs', 'utf8'), context);
context.getManagedProtectionKind_ = sheet => sheet.kind;
context.installManagedSheetProtections_ = sheet => installed.push(sheet.kind);
context.installSelectedManagedProtections_({ cover: false, calendar: false,
  schedule: false, students: false, config: false, tracking: false, evaluation: true });
assert.strictEqual(JSON.stringify(installed), JSON.stringify(['EVALUATION', 'TECNICA', 'TRACKING_OLD']));
console.log('selective protections: ok');
