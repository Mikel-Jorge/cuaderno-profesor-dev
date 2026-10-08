const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = {
  Object, Number, String, Array, Math,
  CP: { SHEETS: { STUDENTS: '3 Alumnado' } },
  normalizeScheduleText_: value => String(value == null ? '' : value).trim(),
  columnToLetter_: column => {
    let result = '';
    while (column) { column--; result = String.fromCharCode(65 + column % 26) + result;
      column = Math.floor(column / 26); }
    return result;
  },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('Evaluation.gs', 'utf8'), context);

const blocks = [
  { name: 'Primera evaluación', units: [
    { code: 'UT1', name: 'Juegos 2D', sourceRow: 28, weight: 40, color: '#AABBCC' },
    { code: 'UT2', name: 'Juegos 3D', sourceRow: 29, weight: 60, color: '#DDEEFF' },
  ], finalWeightRow: 29 },
  { name: 'Segunda evaluación', units: [], finalWeightRow: 30 },
];
const layout = context.getEvaluationLayout_(blocks);
assert.strictEqual(JSON.stringify(context.getEvaluationHeaders_(layout)), JSON.stringify([
  'Apellidos', 'Nombre', 'Medidas', 'UT1', 'UT2', 'Media 1ª', 'Educa 1ª',
  'Media 2ª', 'Educa 2ª', 'Media final', 'Educa final', 'alumno_id',
]));
assert.strictEqual(layout.idColumn, 12);
assert.strictEqual(context.buildEvaluationWeightFormula_(blocks[0].units[0], '4 Config', ';'),
  '=IF(\'4 Config\'!$M$28="";"";\'4 Config\'!$M$28)');
assert.strictEqual(context.buildEvaluationMediaFormula_(3, layout.groups[0],
  "4 Config O'Brien", ';'),
  "=ROUND(N(D3)*'4 Config O''Brien'!$M$28/100+N(E3)*'4 Config O''Brien'!$M$29/100;2)");
assert.strictEqual(context.buildEvaluationMediaFormula_(3, layout.groups[1],
  '4 Config', ';'), '=ROUND(0;2)');
assert.strictEqual(context.buildEvaluationFinalFormula_(3, layout, '4 Config', ';'),
  "=ROUND(F3*'4 Config'!$AH$29/100+H3*'4 Config'!$AH$30/100;2)");

context.readAndNormalizeModuleUnits_ = () => [
  { code: 'UT1', hours: 10, evaluationId: 'E1', sourceRow: 28 },
  { code: 'UT2', hours: 10, evaluationId: 'E1', sourceRow: 29 },
];
const config = { getRange(row) {
  return { getValues: () => row === 28 ? [[40], [60]] : [[100]] };
} };
const evaluationContext = { evaluations: [{ id: 'E1', name: 'Primera' }] };
assert.strictEqual(context.isEvaluationConfigComplete_(config, evaluationContext), true);
const incomplete = { getRange(row) {
  return { getValues: () => row === 28 ? [[40], ['']] : [[100]] };
} };
assert.strictEqual(context.isEvaluationConfigComplete_(incomplete, evaluationContext), false);

const studentRows = [
  ['García', 'Ana', ' dam  2a ', '', true, 'Tiempo extra', 'id-1'],
  ['Sanz', 'Luis', 'DAM 2B', '', false, '', 'id-2'],
  ['', '', '', '', '', '', ''],
];
const spreadsheet = { getSheetByName: () => ({
  getLastRow: () => 4, getRange: () => ({ getValues: () => studentRows }),
}) };
const selected = context.getEvaluationStudents_(spreadsheet, 'DAM 2A');
assert.strictEqual(selected.length, 1);
assert.strictEqual(selected[0].id, 'id-1');
assert.strictEqual(selected[0].measures, 'Tiempo extra');
assert.strictEqual(context.getEvaluationMeasuresDisplay_(selected[0]), 'REACA');
assert.strictEqual(context.getEvaluationMeasuresDisplay_({ reaca: false }), '');

const oldRows = [
  ['Zabala', 'Zoe', '', 8, 6, 7, 8, 0, 'MH', 7, 'MH', 'id-z'],
  ['Álvarez', 'Ana', '', 9, '', 3, 4, 0, '', 3, '', 'id-a'],
];
const emptyFormulas = oldRows.map(row => row.map(() => ''));
const oldNotes = oldRows.map(row => row.map(() => ''));
const ordered = context.buildEvaluationStudentRows_(oldRows, emptyFormulas, oldNotes,
  [{ surname: 'García', name: 'Luis', reaca: true, measures: 'Tiempo', id: 'id-g' }], 12);
assert.strictEqual(ordered.additions, 1);
assert.strictEqual(JSON.stringify(ordered.items.map(item => item.id)),
  JSON.stringify(['id-a', 'id-g', 'id-z']));
assert.strictEqual(ordered.items[0].values[3], 9);
assert.strictEqual(ordered.items[2].values[3], 8);
assert.strictEqual(ordered.items[2].values[8], 'MH');
assert.strictEqual(ordered.items[1].values[2], 'REACA');
assert.strictEqual(ordered.items[1].notes[2], 'Tiempo');
const repairedAgain = context.buildEvaluationStudentRows_(
  ordered.items.map(item => item.values),
  ordered.items.map(item => item.values.map(() => '')),
  ordered.items.map(item => item.notes),
  [{ surname: 'García', name: 'Luis', reaca: false, measures: '', id: 'id-g' }], 12);
assert.strictEqual(repairedAgain.additions, 0);
assert.strictEqual(JSON.stringify(repairedAgain.items.map(item => item.id)),
  JSON.stringify(['id-a', 'id-g', 'id-z']));
assert.strictEqual(repairedAgain.items[1].values[2], '');
assert.strictEqual(repairedAgain.items[1].notes[2], '');
assert.strictEqual(repairedAgain.items[2].values[8], 'MH');
assert.strictEqual(context.buildEvaluationGroupFormula_(4, 3, 'UT', ';'),
  '=ROUND(SUM(D4:D6)/3;2)');
assert.strictEqual(context.buildEvaluationGroupFormula_(7, 3, 'EDUCA', ';'),
  '=IF(COUNTA(G4:G6)=0;"";ROUND((SUMPRODUCT(IFERROR(G4:G6*1;0))+10*COUNTIF(G4:G6;"MH"))/COUNTA(G4:G6);2))');
assert.strictEqual(context.buildEvaluationGroupFormula_(7, 0, 'EDUCA', ';'), '');

const styled = {};
context.getActiveTheme_ = () => ({ colors: {
  primary: '#123456', onPrimary: '#FFFFFF', secondary: '#654321',
  onSecondary: '#FFFFFF', accent: '#123123', onAccent: '#FFFFFF',
  surface: '#FFFFFF', text: '#111111', muted: '#EEEEEE', border: '#CCCCCC',
} });
context.getAccessibleTextColor_ = () => '#111111';
context.SpreadsheetApp = { BorderStyle: { SOLID: 'SOLID', SOLID_MEDIUM: 'SOLID_MEDIUM' } };
context.installEvaluationFormatting_ = () => {};
const styledSheet = {
  getParent: () => ({}),
  getRange(row, column, height = 1, width = 1) {
    const key = [row, column, height, width].join(':');
    const range = {};
    for (const method of ['setBackground', 'setFontColor', 'setFontWeight',
      'setVerticalAlignment', 'setHorizontalAlignment', 'setNote', 'setBorder']) {
      range[method] = value => { styled[key + ':' + method] = value; return range; };
    }
    return range;
  },
  setRowHeights() {}, setColumnWidth() {},
};
context.styleEvaluationSheet_(styledSheet, layout, 1, 5);
assert.strictEqual(styled['1:1:1:11:setBackground'], '#123456');
assert.strictEqual(styled['1:10:1:2:setBackground'], '#123123');
assert.strictEqual(styled['2:4:1:1:setBackground'], blocks[0].units[0].color);
assert.strictEqual(styled['4:7:1:1:setBackground'], '#FFF8E1');
assert.strictEqual(styled['4:7:1:1:setFontWeight'], 'bold');
console.log('Evaluation layout, live weights, row identity and group formulas passed');
