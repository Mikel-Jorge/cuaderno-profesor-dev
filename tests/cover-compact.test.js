const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const ranges = [];
const written = [];
const fluent = { breakApart() { return this; }, clear() { return this; },
  setFontFamily() { return this; }, setVerticalAlignment() { return this; },
  setFontWeight() { return this; }, setFontSize() { return this; },
  setHorizontalAlignment() { return this; }, setValue(value) { written.push([this.coords, value]); return this; },
  setValues() { return this; }, setWrap() { return this; }, merge() { return this; } };
const workbook = { getSheets: () => ['0 Portada', '1 Calendario', '2 Horario', '3 Alumnado']
  .map(name => ({ getName: () => name, isSheetHidden: () => false })) };
const sheet = { getParent: () => workbook, getMaxRows: () => 100, getMaxColumns: () => 20,
  getRange(...args) { ranges.push(args); return Object.assign(Object.create(fluent), { coords: args[0] }); },
  setHiddenGridlines() {}, setFrozenRows() {}, setFrozenColumns() {},
  setColumnWidth() {}, setRowHeights() {}, setRowHeight() {} };
const context = { ensureSheetSize_: () => {}, setMergedRangeValue_: range => range,
  getGeneralConfigValues_: () => ({ es_tutor: 'false' }),
  isTutorEnabled_: value => value === 'true', CP: { CONFIG_KEYS: {
    IS_TUTOR: 'es_tutor', TUTOR_GROUP: 'grupo_tutoria' } } };
vm.createContext(context);
vm.runInContext(fs.readFileSync('Portada.gs', 'utf8'), context);
context.prepareCoverStructure_(sheet, { es_tutor: 'false' });
assert.strictEqual(context.getCoverLayoutBounds_(workbook).columns, 7);
assert.strictEqual(context.getCoverLayoutBounds_(workbook).rows, 13);
for (const coordinate of ['A1:G2', 'A3:G4', 'A6:E6', 'G6']) {
  assert(ranges.some(args => args[0] === coordinate), `${coordinate} debe existir`);
}
assert(ranges.some(args => args[0] === 7 && args[1] === 1 && args[2] === 7));
assert(!ranges.some(args => args[0] === 'B2:H3' || args[0] === 'H7'));
context.getGeneralConfigValues_ = () => ({ es_tutor: 'true' });
ranges.length = 0;
context.prepareCoverStructure_(sheet, { es_tutor: 'true' });
assert.strictEqual(context.getCoverLayoutBounds_(workbook).rows, 14);
assert(ranges.some(args => args[0] === 7 && args[1] === 1 && args[2] === 8));
assert(ranges.some(args => args[0] === 14 && args[1] === 2));
context.getActiveTheme_ = () => ({ colors: { accent: '#123456' } });
context.updateCoverData_(sheet, { es_tutor: 'true', grupo_tutoria: 'DAM 2A' }, ['grupo_tutoria']);
assert(written.some(([coords, value]) => coords === 'B14:E14' && value === 'DAM 2A'));
console.log('portada compacta desde A1 y datos bajo encabezados: ok');
