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
    { code: 'UT1', name: 'Juegos 2D', sourceRow: 28, weight: 40 },
    { code: 'UT2', name: 'Juegos 3D', sourceRow: 29, weight: 60 },
  ], finalWeightRow: 29 },
  { name: 'Segunda evaluación', units: [], finalWeightRow: 30 },
];
const layout = context.getEvaluationLayout_(blocks);
assert.strictEqual(JSON.stringify(context.getEvaluationHeaders_(layout)), JSON.stringify([
  'Apellidos', 'Nombre', 'REACA', 'UT1', 'UT2', 'Media 1ª', 'Educa 1ª',
  'Media 2ª', 'Educa 2ª', 'Media final', 'Educa final', 'alumno_id',
]));
assert.strictEqual(layout.idColumn, 12);
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
console.log('Evaluation layout, direct formulas, weights and student identity passed');
