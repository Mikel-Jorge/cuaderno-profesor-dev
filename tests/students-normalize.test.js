const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const records = Array.from({ length: 201 }, () => Array(7).fill(''));
records[0] = ['Apellidos', 'Nombre', 'Grupo', 'Email', 'REACA', 'Información / Medidas', 'alumno_id'];
records[1] = ['Zubiri', 'Zoe', 'DAM 2A', 'z@example.test', true, 'Apoyo', 'id-z'];
records[2] = ['Pérez', 'Paz', 'DAM 2B', '', false, '', 'id-p'];
records[3] = ['López', 'Luis', 'ASIR - VIRTUAL', '', false, '', 'id-l'];
records[4] = ['Alonso', 'Beatriz', 'DAM 2A', '', false, '', 'id-b'];
records[5] = ['Alonso', 'Ana', 'DAM 2A', '', false, '', 'id-a'];
records[6] = ['', '', '', '', false, '', ''];
records[7] = ['', '', '', '', false, 'Fila incompleta', ''];
for (let row = 8; row < records.length; row++) records[row][4] = false;
const borders = [];
const separators = new Set([4, 150]);
const sheet = {
  getLastRow: () => records.length,
  getMaxRows: () => records.length,
  showSheet() {},
  getRange(row, col, height = 1, width = 1) {
    return {
      getValues: () => Array.from({ length: height }, (_, i) =>
        records[row - 1 + i].slice(col - 1, col - 1 + width)),
      setValues(matrix) { matrix.forEach((values, i) => values.forEach((value, j) => {
        records[row - 1 + i][col - 1 + j] = value;
      })); return this; },
      clearContent() { for (let i = 0; i < height; i++) for (let j = 0; j < width; j++)
        records[row - 1 + i][col - 1 + j] = ''; return this; },
      setBorder(...args) {
        borders.push({ row, col, height, width, args });
        if (args[5] === false) for (let boundary = row + 1; boundary < row + height; boundary++)
          separators.delete(boundary);
        if (args[0] === true) separators.add(row);
        return this;
      },
      setNumberFormat() { return this; },
      insertCheckboxes() { return this; },
    };
  },
};
const book = { getSheetByName: () => sheet };
const context = vm.createContext({
  CP: { SHEETS: { STUDENTS: '3 Alumnado' } },
  SpreadsheetApp: { BorderStyle: { SOLID_THICK: 'SOLID_THICK' } },
  Utilities: { getUuid: () => 'new-id' },
});
vm.runInContext(fs.readFileSync('Students.gs', 'utf8'), context);
const repairStudents = context.createOrRepairStudentsSheet_;
context.createOrRepairStudentsSheet_ = () => {};
const summary = context.normalizeStudentsAfterManagedImport_(book);
assert.equal(summary.students, 5);
assert.equal(summary.anomalous, 1);
assert.deepEqual(records.slice(1, 6).map(row => row[6]), ['id-l', 'id-a', 'id-b', 'id-z', 'id-p']);
assert.deepEqual(records[4].slice(0, 7), ['Zubiri', 'Zoe', 'DAM 2A', 'z@example.test', true, 'Apoyo', 'id-z']);
assert.equal(records[6][5], 'Fila incompleta');
assert(records.slice(7).every(row => row.every(value => value === '')));
context.applyStudentGroupSeparators_(sheet);
assert.deepEqual(borders.filter(border => border.args[7] === 'SOLID_THICK').map(border => border.row), [3, 6]);
assert.deepEqual([...separators], [3, 6]);
assert.equal(borders[0].args[5], false, 'el sexto argumento limpia los bordes horizontales');
borders.length = 0;
context.applyStudentGroupSeparators_(sheet);
assert.deepEqual(borders.filter(border => border.args[7] === 'SOLID_THICK').map(border => border.row), [3, 6]);
assert.deepEqual([...separators], [3, 6]);
records[149] = ['Alonso', 'Luis', 'DAM 2A', '', false, '', 'id-u'];
separators.add(150);
context.normalizeStudentsAfterManagedImport_(book);
context.applyStudentGroupSeparators_(sheet);
assert.deepEqual([...separators], [3, 7], 'la segunda importación elimina líneas internas y lejanas');
assert.equal(records[4][6], 'id-u');
separators.add(4);
separators.add(150);
context.createOrRepairStudentsSheet_ = repairStudents;
context.SpreadsheetApp.getActiveSpreadsheet = () => book;
context.getOrCreateSheet_ = () => sheet;
context.ensureSheetSize_ = () => {};
context.applyStudentsSheetTheme_ = () => {};
context.getActiveTheme_ = () => ({ colors: {} });
context.syncStudentGroupValidation_ = () => {};
context.trimSheetToBounds_ = () => {};
context.installManagedSheetProtections_ = () => {};
const orderBeforeRepair = records.slice(1, 7).map(row => row[6]);
context.createOrRepairStudentsSheet_();
assert.deepEqual([...separators], [3, 7], 'Repair elimina líneas antiguas dentro del grupo y en fila 150');
assert.deepEqual(records.slice(1, 7).map(row => row[6]), orderBeforeRepair);
context.createOrRepairStudentsSheet_();
assert.deepEqual([...separators], [3, 7], 'Repair es idempotente');
console.log('Alumnado: orden, bordes históricos, segunda importación y Repair idempotente: ok');
