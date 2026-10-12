const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({ CP_PROTECTION_PREFIX: 'CUADERNO:',
  SpreadsheetApp: { ProtectionType: { RANGE: 'RANGE' },
    newConditionalFormatRule: () => ({
      whenFormulaSatisfied(formula) { this.formula = formula; return this; },
      setBackground(color) { this.background = color; return this; },
      setFontColor(color) { this.text = color; return this; },
      setRanges(ranges) { this.ranges = ranges; return this; },
      build() { return this; },
    }) },
});
vm.runInContext(fs.readFileSync('Evaluation.gs', 'utf8'), context);

const validations = new Set(['4:4', '4:6', '4:8']);
const protections = [];
let backgrounds = [], textColors = [], rules = [];
const sheet = {
  getProtections: () => protections,
  getConditionalFormatRules: () => rules,
  setConditionalFormatRules(next) { rules = next; },
  getRange(row, column, height = 1, width = 1) {
    const range = { row, column, height, width,
      setBackground(color) { backgrounds.push({ row, color }); return range; },
      setFontColor(color) { textColors.push({ row, color }); return range; },
      clearDataValidations() { validations.delete(row + ':' + column); return range; },
      protect() {
        const protection = {
          getDescription() { return this.description; },
          setDescription(value) { this.description = value; return this; },
          setWarningOnly(value) { this.warningOnly = value; return this; },
          remove() { protections.splice(protections.indexOf(this), 1); },
        };
        protections.push(protection);
        return protection;
      },
    };
    return range;
  },
};
const layout = { lastVisibleColumn: 8, finalEducaColumn: 8,
  groups: [{ units: [{ column: 4 }], educaColumn: 6 }] };
const inactive = [{ id: 'ID-A', inactive: true }];
context.syncInactiveEvaluationRows_(sheet, layout, inactive);
assert.deepEqual([...validations], []);
assert.equal(protections.length, 1);
assert.equal(protections[0].getDescription(), 'CUADERNO:EVAL_INACTIVO:ID-A');
assert.equal(protections[0].warningOnly, true);
assert.equal(backgrounds.at(-1).color, '#4B5563');
assert.equal(textColors.at(-1).color, '#FFFFFF');
assert.equal(rules[0].formula, '=TRUE');
assert.equal(rules[0].background, '#4B5563');
assert.equal(rules[0].text, '#FFFFFF');
context.syncInactiveEvaluationRows_(sheet, layout, inactive);
assert.equal(protections.length, 1); // Repair repetido no duplica protección.
// En repairEvaluationSheet_ se reinstalan validaciones y estilo antes de aplicar el estado.
const source = fs.readFileSync('Evaluation.gs', 'utf8');
assert(source.indexOf('installEvaluationRows_(sheet, configSheet, layout, rows.items.length)') <
  source.indexOf('syncInactiveEvaluationRows_(sheet, layout, rows.items)'));
validations.add('4:4'); validations.add('4:6'); validations.add('4:8');
rules = []; backgrounds = []; textColors = [];
context.syncInactiveEvaluationRows_(sheet, layout, [{ id: 'ID-A', inactive: false }]);
assert.equal(protections.length, 0);
assert.deepEqual([...validations].sort(), ['4:4', '4:6', '4:8']);
assert.equal(rules.length, 0);
console.log('inactive Eval keeps values, removes inputs, and restores protections idempotently: ok');
