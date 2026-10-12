const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({ Object, Number, String, Array, Math, console,
  CP: { PROJECT_NAME: 'Cuaderno', TAB_COLORS: { EVALUATION: '#fff' } },
  columnToLetter_: column => String.fromCharCode(64 + column),
});
vm.runInContext(fs.readFileSync('Evaluation.gs', 'utf8'), context);
const blocks = [
  { name: '1ª', units: [], finalWeightRow: 29 },
  { name: '2ª', units: [], finalWeightRow: 30 },
];
const layout = context.getEvaluationLayout_(blocks);
const headers = context.getEvaluationHeaders_(layout);
// The actual layout has Media/Educa per evaluation and Media/Educa final.
const byId = {
  'id-a': { surname: 'Álvarez', name: 'Ana', id: 'id-a', reaca: false, measures: '' },
  'id-g': { surname: 'García', name: 'Luis', id: 'id-g', reaca: false, measures: '' },
  'id-z': { surname: 'Zabala', name: 'Zoe', id: 'id-z', reaca: false, measures: '' },
};
const cells = new Map();
const formats = new Map();
const validations = new Map();
const operations = [];
const key = (r, c) => `${r}:${c}`;
const put = (r, c, value) => cells.set(key(r, c), value);
headers.forEach((value, index) => put(2, index + 1, value));
const edu = layout.groups.map(group => group.educaColumn).concat(layout.finalEducaColumn);
const seed = [
  { row: 4, student: byId['id-z'], educa: ['8', '7', '1'] },
  { row: 5, student: byId['id-a'], educa: ['3', '10', 'MH'] },
];
for (const item of seed) {
  put(item.row, 1, item.student.surname);
  put(item.row, 2, item.student.name);
  put(item.row, layout.idColumn, item.student.id);
  edu.forEach((column, index) => put(item.row, column, item.educa[index]));
}
put(6, 1, 'MEDIA DEL GRUPO');

function range(row, col, height = 1, width = 1) {
  const each = callback => {
    for (let r = row; r < row + height; r++)
      for (let c = col; c < col + width; c++) callback(r, c);
  };
  const api = {
    getValues: () => Array.from({ length: height }, (_, ri) =>
      Array.from({ length: width }, (_, ci) => cells.get(key(row + ri, col + ci)) ?? '')),
    getDisplayValues: () => Array.from({ length: height }, (_, ri) =>
      Array.from({ length: width }, (_, ci) => {
        const value = cells.get(key(row + ri, col + ci)) ?? '';
        return edu.includes(col + ci) && /^\d+$/.test(String(value)) ? `${value},00` : String(value);
      })),
    getDisplayValue: () => String(cells.get(key(row, col)) ?? ''),
    getFormulas: () => Array.from({ length: height }, () => Array(width).fill('')),
    getNotes: () => Array.from({ length: height }, () => Array(width).fill('')),
    clearDataValidations: () => { each((r, c) => validations.delete(key(r, c))); operations.push('clear'); return api; },
    setNumberFormat: format => { each((r, c) => formats.set(key(r, c), format)); operations.push(`format:${col}:${format}`); return api; },
    setValues: matrix => {
      operations.push(`write:${col}`);
      matrix.forEach((line, ri) => line.forEach((value, ci) => {
        const r = row + ri, c = col + ci;
        // Sheets-style coercion reproduces the reported failure unless text is set first.
        put(r, c, edu.includes(c) && /^\d+$/.test(String(value)) && formats.get(key(r, c)) !== '@'
          ? Number(value) : value);
      }));
      return api;
    },
    setNotes: () => api,
    setDataValidation: validation => { each((r, c) => validations.set(key(r, c), validation)); return api; },
    setFormulas: () => api,
    setFormula: () => api,
    setValue: value => { put(row, col, value); return api; },
    breakApart: () => api, clearContent: () => { each((r, c) => cells.delete(key(r, c))); return api; },
    clearNote: () => api, merge: () => api, setBackground: () => api,
  };
  return api;
}
const sheet = {
  getParent: () => spreadsheet, getName: () => '6 Eval', getLastRow: () => 6,
  getRange: range, setFrozenRows() {}, setFrozenColumns() {}, setHiddenGridlines() {},
  setTabColor() {}, hideColumns() {},
};
const spreadsheet = { toast() {} };
context.getEvaluationConfig_ = () => blocks;
context.ensureStudentIdsForValidRows_ = () => {};
context.getStudentsForModuleActivity_ = () => Object.values(byId);
context.ensureSheetSize_ = () => {};
context.getModuleFormulaSeparator_ = () => ';';
context.styleEvaluationSheet_ = () => {};
context.trimSheetToBounds_ = () => {};
context.installManagedSheetProtections_ = () => {};
context.installEvaluationGroupAverages_ = (_sheet, currentLayout, _count, footerRow) => {
  edu.forEach(column => range(footerRow, column).setNumberFormat('0.00'));
};
context.SpreadsheetApp = { newDataValidation: () => ({
  requireValueInList(list) { this.list = list; return this; },
  requireFormulaSatisfied() { return this; }, setAllowInvalid() { return this; },
  build() { return { list: this.list }; },
}) };
context.repairEvaluationSheet_(sheet, { getName: () => '4 Config' }, {}, { group: 'DAM' });
const ids = [4, 5, 6].map(row => cells.get(key(row, layout.idColumn)));
assert.deepEqual(ids, ['id-a', 'id-g', 'id-z']);
for (const [row, values] of [[4, ['3', '10', 'MH']], [5, ['', '', '']], [6, ['8', '7', '1']]]) {
  edu.forEach((column, index) => {
    const value = cells.get(key(row, column)) ?? '';
    assert.equal(value, values[index]);
    assert.equal(formats.get(key(row, column)), '@');
    assert.deepEqual(Array.from(validations.get(key(row, column)).list),
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'MH']);
    assert.ok(value === '' || validations.get(key(row, column)).list.includes(value));
  });
}
assert.ok(operations.indexOf(`format:${edu[0]}:@`) < operations.lastIndexOf('write:1'));
assert.equal(formats.get(key(7, edu[0])), '0.00');
console.log('Educa repair retains 3, 10 and MH across alphabetical insertion');
