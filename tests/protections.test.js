const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const context = {
  SpreadsheetApp: { ProtectionType: { SHEET: 'SHEET' } },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('Protections.gs', 'utf8'), context);

let removed = 0;
function protection(description) {
  return {
    description,
    getDescription() { return this.description; },
    setDescription(value) { this.description = value; return this; },
    setWarningOnly(value) { this.warning = value; return this; },
    setUnprotectedRanges(value) { this.ranges = value; return this; },
    remove() { removed++; const index = protections.indexOf(this);
      if (index !== -1) protections.splice(index, 1); },
  };
}
const manual = protection('Profesor: rango personal');
const owned = protection('CUADERNO:STUDENTS');
const stale = protection('CUADERNO:ANTIGUA');
const protections = [manual, owned, stale];
const sheet = {
  getMaxRows: () => 201,
  getProtections: () => protections,
  protect: () => { const item = protection(''); protections.push(item); return item; },
  getRange: (...parts) => parts,
};
context.installManagedSheetProtections_(sheet, 'STUDENTS');
assert.strictEqual(owned.warning, true);
assert.strictEqual(JSON.stringify(owned.ranges), JSON.stringify([[2, 1, 200, 6]]));
assert.strictEqual(removed, 1);

const configSheet = {
  getMaxRows: () => 45,
  getRange: (row, column, height, width) => row === 29 && column === 23
    ? { getDisplayValues: () => [['Primera'], ['Segunda'], ['TOTAL']] }
    : [row, column, height, width],
};
assert.strictEqual(JSON.stringify(context.getManagedProtectionRanges_(configSheet, 'CONFIG')),
  JSON.stringify([[28, 1, 15, 18], [29, 34, 2, 2]]));
context.getTrackingDataRowNumbers_ = () => [2, 3, 5];
const trackingSheet = { getRange: (...parts) => parts };
assert.strictEqual(JSON.stringify(context.getManagedProtectionRanges_(trackingSheet, 'TRACKING')),
  JSON.stringify([[2, 2, 2, 4], [2, 8, 2, 1], [5, 2, 1, 4], [5, 8, 1, 1]]));
const evaluationSheet = {
  getLastColumn: () => 8,
  getLastRow: () => 7,
  getRange: (row, column, height, width) => row === 2
    ? { getDisplayValues: () => [[
      'Apellidos', 'Nombre', 'Medidas', 'UT1', 'Media 1ª', 'Educa 1ª',
      'Media final', 'alumno_id',
    ]] } : [row, column, height, width],
};
assert.strictEqual(JSON.stringify(context.getManagedProtectionRanges_(evaluationSheet, 'EVALUATION')),
  JSON.stringify([[4, 4, 3, 1], [4, 6, 3, 1]]));
assert.strictEqual(context.getManagedProtectionRanges_(sheet, 'TRACKING_OLD').length, 0);
assert.strictEqual(manual.description, 'Profesor: rango personal');
context.installManagedSheetProtections_(sheet, 'STUDENTS');
assert.strictEqual(owned.warning, true);
assert.strictEqual(manual.description, 'Profesor: rango personal');
assert.strictEqual(removed, 1);

const groups = context.groupConsecutiveRows_([2, 3, 5, 7, 8]);
assert.strictEqual(JSON.stringify(groups), JSON.stringify([
  { start: 2, count: 2 }, { start: 5, count: 1 }, { start: 7, count: 2 },
]));
console.log('Warning-only ownership, editable ranges and idempotence passed');
