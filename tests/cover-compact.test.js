const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const ranges = [];
const fluent = { breakApart() { return this; }, clear() { return this; },
  setFontFamily() { return this; }, setVerticalAlignment() { return this; },
  setFontWeight() { return this; }, setFontSize() { return this; },
  setHorizontalAlignment() { return this; }, setValue() { return this; },
  setValues() { return this; }, setWrap() { return this; }, merge() { return this; } };
const workbook = { getSheets: () => ['0 Portada', '1 Calendario', '2 Horario', '3 Alumnado']
  .map(name => ({ getName: () => name, isSheetHidden: () => false })) };
const sheet = { getParent: () => workbook, getMaxRows: () => 100, getMaxColumns: () => 20,
  getRange(...args) { ranges.push(args); return Object.create(fluent); },
  setHiddenGridlines() {}, setFrozenRows() {}, setFrozenColumns() {},
  setColumnWidth() {}, setRowHeights() {}, setRowHeight() {} };
const context = { ensureSheetSize_: () => {}, setMergedRangeValue_: range => range };
vm.createContext(context);
vm.runInContext(fs.readFileSync('Portada.gs', 'utf8'), context);
context.prepareCoverStructure_(sheet);
assert.strictEqual(context.getCoverLayoutBounds_(workbook).columns, 7);
assert.strictEqual(context.getCoverLayoutBounds_(workbook).rows, 13);
for (const coordinate of ['A1:G2', 'A3:G4', 'A6:E6', 'G6']) {
  assert(ranges.some(args => args[0] === coordinate), `${coordinate} debe existir`);
}
assert(ranges.some(args => args[0] === 7 && args[1] === 1 && args[2] === 7));
assert(!ranges.some(args => args[0] === 'B2:H3' || args[0] === 'H7'));
console.log('portada compacta desde A1 y datos bajo encabezados: ok');
