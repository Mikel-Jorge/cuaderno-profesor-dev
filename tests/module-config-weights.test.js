const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const formatRules = [];
const context = vm.createContext({ SpreadsheetApp: {
  BorderStyle: { SOLID: 'SOLID' },
  newDataValidation: () => chain(),
  newConditionalFormatRule: () => formatRule(),
} });
function chain() {
  const object = { build: () => ({}) };
  for (const method of ['requireNumberBetween', 'requireNumberGreaterThanOrEqualTo',
    'requireValueInList', 'setAllowInvalid', 'whenTextEqualTo', 'whenNumberGreaterThan',
    'whenNumberLessThan', 'whenNumberEqualTo', 'whenFormulaSatisfied', 'whenTextContains',
    'setBackground', 'setFontColor', 'setBold', 'setRanges']) object[method] = () => object;
  return object;
}
function formatRule() {
  const object = chain();
  object.whenFormulaSatisfied = formula => { object.formula = formula; return object; };
  object.whenTextContains = value => { object.text = value; return object; };
  object.setRanges = ranges => { object.range = ranges[0].position; return object; };
  object.build = () => ({ formula: object.formula, text: object.text, range: object.range });
  return object;
}
vm.runInContext(fs.readFileSync('ModuleConfig.gs', 'utf8'), context);
vm.runInContext(`
  getActiveTheme_ = () => ({ colors: { secondary: '', onSecondary: '', muted: '', text: '',
    surface: '', warning: '', mutedText: '', danger: '', success: '', border: '' } });
  getAccessibleTextColor_ = () => '';
  getEvaluationPeriodsForType_ = type => type.periods;
  buildRealModuleSessions_ = (_, type) => type.sessions;
  compareCalendarDates_ = (a, b) => a - b;
  ensureSheetSize_ = () => {};
`, context);

const values = new Map();
const formulas = new Map();
const merges = [];
const validations = [];
const notes = new Map();
const alignments = new Map();
const wraps = new Map();
const spreadsheet = { getSpreadsheetTimeZone: () => 'Europe/Madrid',
  getSpreadsheetLocale: () => 'es_ES', getSheets: () => [sheet] };
const sheet = {
  getParent: () => spreadsheet,
  getSheetId: () => 123,
  getName: () => '4 Config renombrada',
  getMaxRows: () => 44,
  setRowHeight: () => sheet,
  setRowHeights: () => sheet,
  setConditionalFormatRules: rules => { formatRules.splice(0, formatRules.length, ...rules); return sheet; },
  getRange(row, column, height = 1, width = 1) {
    const range = {
      position: [row, column, height, width],
      merge() { merges.push([row, column, height, width]); return range; },
      setValue(value) { values.set(`${row}:${column}`, value); return range; },
      setFormula(value) { formulas.set(`${row}:${column}`, value); return range; },
      setFormulas(items) { items.forEach((item, index) => formulas.set(`${row + index}:${column}`, item[0])); return range; },
      setDataValidation() { validations.push([row, column]); return range; },
      setNote(value) { notes.set(`${row}:${column}`, value); return range; },
      setHorizontalAlignment(value) {
        for (let r = row; r < row + height; r += 1) {
          for (let c = column; c < column + width; c += 1) alignments.set(`${r}:${c}`, value);
        }
        return range;
      },
      setWrap(value) { wraps.set(`${row}:${column}`, value); return range; },
      getValues() { return Array.from({ length: height }, (_, index) =>
        Array.from({ length: width }, (_, offset) => values.get(`${row + index}:${column + offset}`) ?? '')); },
      getDisplayValue() { return values.get(`${row}:${column}`) ?? ''; },
      getValue() { return values.get(`${row}:${column}`) ?? ''; },
      isPartOfMerge() { return row === 27 && column === 3; },
      clearContent() {
        for (let r = row; r < row + height; r += 1) {
          for (let c = column; c < column + width; c += 1) {
            values.delete(`${r}:${c}`);
            formulas.delete(`${r}:${c}`);
          }
        }
        return range;
      },
    };
    for (const method of ['setBackground', 'setFontColor', 'setFontWeight',
      'setNumberFormat', 'setFontSize', 'setVerticalAlignment',
      'setBorder', 'setFontStyle', 'clearDataValidations', 'breakApart',
      'clearFormat']) range[method] = () => range;
    return range;
  },
};
const periods = [0, 1, 2].map(index => ({ id: `e${index}`, name: `Eval ${index + 1}`,
  startDate: index, endDate: index }));
const type = { periods, sessions: [0, 1, 2].flatMap(index =>
  Array.from({ length: [45, 37, 17][index] }, () => ({ date: index }))) };

// Existing Peso final values survive summary regeneration.
values.set('29:34', 30);
values.set('30:34', 30);
values.set('31:34', 40);
context.refreshModuleConfigUtSupport_(sheet, {}, { type, evaluations: periods });
assert.deepEqual([29, 30, 31].map(row => values.get(`${row}:34`)), [30, 30, 40]);
assert.equal(formulas.get('32:34'), '=SUM(AH29:AH31)');
assert.match(formulas.get('29:32'), /SUMIFS\(\$M\$28:\$M\$42;\$AO\$28:\$AO\$42;"e0"/);
assert.match(formulas.get('29:36'), /COUNTIFS\(/);
assert.match(formulas.get('29:36'), /Sin UT/);
assert.match(formulas.get('32:36'), /Ponderaciones completas/);
assert.ok(validations.some(([row, column]) => row === 29 && column === 34));
assert.deepEqual(merges.filter(([row]) => row === 28).map(([, column,, width]) => [column, width]),
  [[23, 5], [28, 2], [30, 2], [32, 2], [34, 2], [36, 4]]);
assert.equal(values.get('27:23'), 'RESUMEN DE HORAS Y PONDERACIONES');
for (const column of [23, 28, 30, 32, 34, 36]) {
  assert.equal(alignments.get(`28:${column}`), 'left');
  assert.equal(wraps.get(`28:${column}`), false);
  assert.equal(alignments.get(`29:${column}`), 'left');
}
assert.equal(formatRules.filter(rule => rule.range[1] === 13 && rule.formula).length, 3);
assert.equal(formatRules.filter(rule => rule.range[0] === 29 && rule.range[1] === 34 && rule.formula).length, 3);
assert.equal(formatRules.filter(rule => rule.range[0] === 32 && rule.range[1] === 34 && rule.formula).length, 3);
assert.ok(formatRules.some(rule => rule.range[1] === 13 && rule.formula.includes('$M28=""')));
assert.ok(formatRules.some(rule => rule.range[1] === 13 &&
  rule.formula.includes('$C28<>"";$K28>0')));
assert.ok(formatRules.some(rule => rule.range[1] === 34 && rule.formula.includes('COUNTBLANK')));
assert.deepEqual(formatRules.filter(rule => rule.range[1] === 36).map(rule => rule.text), ['✓', '⚠', '❌']);
for (const formula of formulas.values()) {
  let depth = 0;
  let quoted = false;
  for (let index = 0; index < formula.length; index += 1) {
    if (formula[index] === '"') {
      if (quoted && formula[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && formula[index] === '(') depth += 1;
    else if (!quoted && formula[index] === ')') depth -= 1;
    assert.ok(depth >= 0, formula);
  }
  assert.equal(depth, 0, formula);
  assert.equal(quoted, false, formula);
}

function evaluateWeightFormulas(units, finals) {
  const outputs = new Map();
  const rangeValues = ref => {
    const match = ref.match(/\$?([A-Z]+)\$?(\d+):\$?[A-Z]+\$?(\d+)/);
    assert.ok(match, ref);
    return Array.from({ length: Number(match[3]) - Number(match[2]) + 1 }, (_, index) => {
      const row = Number(match[2]) + index;
      if (match[1] === 'AH') return finals[row - 29] ?? '';
      if (match[1] === 'AJ') return outputs.get(`AJ${row}`) ?? '';
      const unit = units[row - 28] || {};
      return { M: unit.weight ?? '', AO: unit.evaluationId ?? '',
        C: unit.name ?? '', K: unit.hours ?? '' }[match[1]];
    });
  };
  const matches = (value, criterion) => {
    if (criterion === '<>') return value !== '' && value !== null && value !== undefined;
    if (criterion === '>0') return Number(value) > 0;
    if (criterion === '') return value === '' || value === null || value === undefined;
    if (criterion.endsWith('*')) return String(value).startsWith(criterion.slice(0, -1));
    return value === criterion;
  };
  const evaluate = formula => {
    let expression = formula.slice(1);
    expression = expression.replace(/(SUMIFS|COUNTIFS|COUNTIF|COUNTBLANK|SUM)\(([^()]*)\)/g,
      (_, name, argumentsText) => {
        const args = argumentsText.split(';').map(value => value.trim());
        if (name === 'SUM') return String(rangeValues(args[0]).reduce((a, b) => a + (Number(b) || 0), 0));
        if (name === 'COUNTBLANK') return String(rangeValues(args[0]).filter(value => matches(value, '')).length);
        if (name === 'COUNTIF') {
          const criterion = args[1].slice(1, -1);
          return String(rangeValues(args[0]).filter(value => matches(value, criterion)).length);
        }
        const rows = rangeValues(args[0]);
        const criteria = [];
        for (let index = name === 'SUMIFS' ? 1 : 0; index < args.length; index += 2) {
          criteria.push([rangeValues(args[index]), args[index + 1].slice(1, -1)]);
        }
        return String(rows.reduce((total, value, index) =>
          total + (criteria.every(([range, criterion]) => matches(range[index], criterion))
            ? name === 'COUNTIFS' ? 1 : Number(value) || 0 : 0), 0));
      });
    expression = expression.replace(/\bAH(\d+)\b/g, (_, row) => String(Number(row) === 32
      ? finals.reduce((a, b) => a + (Number(b) || 0), 0)
      : JSON.stringify(finals[Number(row) - 29] ?? '')));
    expression = expression.replace(/<>/g, '!==')
      .replace(/(?<![<>!=])=(?!=)/g, '===')
      .replace(/&/g, '+').replace(/;/g, ',');
    return Function('IF', `return ${expression}`)((condition, yes, no) => condition ? yes : no);
  };
  for (let row = 29; row <= 31; row += 1) {
    outputs.set(`AF${row}`, evaluate(formulas.get(`${row}:32`)));
    outputs.set(`AJ${row}`, evaluate(formulas.get(`${row}:36`)));
  }
  outputs.set('AJ32', evaluate(formulas.get('32:36')));
  return outputs;
}

const weightedUnits = [
  { name: 'UT1', hours: 10, weight: 20, evaluationId: 'e0' },
  { name: 'UT2', hours: 10, weight: 30, evaluationId: 'e0' },
  { name: 'UT3', hours: 10, weight: 50, evaluationId: 'e0' },
];
let result = evaluateWeightFormulas(weightedUnits, [30, 30, 40]);
assert.equal(result.get('AF29'), 100);
assert.equal(result.get('AJ29'), '✓ Correcto');
assert.equal(result.get('AJ30'), 'Sin UT');
assert.equal(result.get('AJ32'), '✓ Ponderaciones completas');
weightedUnits[2].weight = undefined;
result = evaluateWeightFormulas(weightedUnits, [30, 30, 40]);
assert.equal(result.get('AF29'), 50);
assert.equal(result.get('AJ29'), '⚠ Falta peso UT');
assert.equal(result.get('AJ32'), '⚠ Ponderaciones pendientes');
weightedUnits[2].weight = 40;
result = evaluateWeightFormulas(weightedUnits, [30, 30, 40]);
assert.equal(result.get('AF29'), 90);
assert.equal(result.get('AJ29'), '⚠ Faltan 10 % UT');
weightedUnits[0].weight = 50;
weightedUnits[1].weight = 40;
weightedUnits[2].weight = 30;
result = evaluateWeightFormulas(weightedUnits, [30, 30, 40]);
assert.equal(result.get('AF29'), 120);
assert.equal(result.get('AJ29'), '❌ Sobran 20 % UT');
assert.equal(result.get('AJ32'), '❌ Revisar ponderaciones');
weightedUnits[0].weight = 20;
weightedUnits[1].weight = 30;
weightedUnits[2].weight = 50;
assert.equal(evaluateWeightFormulas(weightedUnits, [30, 30, '']).get('AJ32'),
  '⚠ Ponderaciones pendientes');
assert.equal(evaluateWeightFormulas(weightedUnits, [40, 40, 30]).get('AJ32'),
  '❌ Revisar ponderaciones');
assert.equal(evaluateWeightFormulas(weightedUnits, [20, 30, 40]).get('AJ32'),
  '❌ Revisar ponderaciones');

// Migrating the 1.4.9 layout keeps all UT data and creates editable weight cells.
values.set('28:1', 'UT1');
values.set('28:3', 'Nombre');
values.set('28:9', 10);
values.set('28:11', '#BFDBFE');
values.set('28:16', 'Eval 1');
context.migrateModuleUtLayout_(sheet);
assert.deepEqual([1, 3, 11, 13, 15, 19].map(column => values.get(`28:${column}`)),
  ['UT1', 'Nombre', 10, '', '#BFDBFE', 'Eval 1']);
assert.deepEqual(merges.filter(([row, column]) => row === 27 && column <= 21)
  .map(([, column,, width]) => [column, width]),
  [[1, 2], [3, 8], [11, 2], [13, 2], [15, 4], [19, 3]]);
assert.match(notes.get('27:13'), /100 %/);

// Recalcular writes planning fields but never writes the two editable weight ranges.
const writesBefore = new Map(values);
context.writeNormalizedModuleUnits_(sheet, [{ sourceRow: 28, code: 'UT1', hours: 10,
  color: '#BFDBFE', id: 'ut1', evaluationId: 'e0' }]);
assert.equal(values.get('28:13'), writesBefore.get('28:13'));
assert.deepEqual([29, 30, 31].map(row => values.get(`${row}:34`)), [30, 30, 40]);
const signature = context.buildModuleRowSignatureFormula_(28, [1, 3, 11, 13, 15, 19]);
assert.ok(signature.includes('K28') && signature.includes('O28') && signature.includes('S28'));
assert.ok(!signature.includes('M28') && !signature.includes('AH'));

// A changed evaluation ID immediately moves the same weight to the other SUMIFS.
const unitRows = [
  { name: 'UT1', hours: 35, weight: 30, evaluationId: 'e0' },
  { name: 'UT2', hours: 5, weight: 70, evaluationId: 'e0' },
];
result = evaluateWeightFormulas(unitRows, [30, 30, 40]);
assert.deepEqual([result.get('AF29'), result.get('AF30')], [100, '—']);
unitRows[1].hours = 20;
unitRows[1].evaluationId = 'e1';
result = evaluateWeightFormulas(unitRows, [30, 30, 40]);
assert.deepEqual([result.get('AF29'), result.get('AF30')], [30, 70]);
assert.equal(unitRows[1].weight, 70);

// Reparar migrates a registered 1.5.0 sheet in place, without replacing applied signatures.
values.delete('27:19');
values.set('27:18', 'Evaluación');
values.set('27:13', 'Peso (%)');
values.set('1:1', 'CONFIGURACIÓN DEL MÓDULO');
values.set('25:1', 'UNIDADES DE TRABAJO');
values.set('28:1', 'UT1');
values.set('28:3', 'Nombre');
values.set('28:11', 10);
values.set('28:13', 25);
values.set('28:15', '#BFDBFE');
values.set('28:18', 'Eval 1');
values.delete('28:19');
values.set('28:43', 'firma aplicada');
notes.clear();
const plan = [{ unit: 'ut1', date: '2026-10-01' }];
context.SpreadsheetApp.getActiveSpreadsheet = () => spreadsheet;
vm.runInContext(`
  readModuleConfigRegistry_ = () => [{ sheetId: 123, activityId: 'activity' }];
  getModuleActivityById_ = () => ({ id: 'activity' });
  validateModuleConfigPrerequisites_ = () => ({ type: repairType, evaluations: repairPeriods });
`, Object.assign(context, { repairType: type, repairPeriods: periods }));
context.repairExistingModuleConfigSheets_();
assert.deepEqual([1, 3, 11, 13, 15, 19].map(column => values.get(`28:${column}`)),
  ['UT1', 'Nombre', 10, 25, '#BFDBFE', 'Eval 1']);
assert.deepEqual([29, 30, 31].map(row => values.get(`${row}:34`)), [30, 30, 40]);
assert.equal(values.get('28:43'), 'firma aplicada');
assert.match(formulas.get('28:42'), /S28/);
assert.equal(values.get('27:23'), 'RESUMEN DE HORAS Y PONDERACIONES');
assert.match(notes.get('27:13'), /100 %/);
const repairedValues = new Map(values);
const repairedFormulas = new Map(formulas);
const repairedNotes = new Map(notes);
const ruleCount = formatRules.length;
context.repairExistingModuleConfigSheets_();
assert.deepEqual(values, repairedValues);
assert.deepEqual(formulas, repairedFormulas);
assert.deepEqual(notes, repairedNotes);
assert.equal(formatRules.length, ruleCount);
assert.deepEqual(plan, [{ unit: 'ut1', date: '2026-10-01' }]);
console.log('Module Config weight layout and preservation cases passed');
