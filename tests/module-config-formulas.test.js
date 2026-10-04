const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const code = fs.readFileSync('ModuleConfig.gs', 'utf8');
const context = vm.createContext({});
vm.runInContext(code, context);
vm.runInContext(`
  getActiveTheme_ = () => ({ colors: { secondary: '', onSecondary: '', muted: '', text: '', surface: '', warning: '', mutedText: '' } });
  getEvaluationPeriodsForType_ = type => type.periods;
  buildRealModuleSessions_ = (_, type) => type.sessions;
  compareCalendarDates_ = (a, b) => a - b;
  installModuleConfigFormatRules_ = () => {};
`, context);

function sheetFor(capacities, locale) {
  const cells = new Map();
  const spreadsheet = { getSpreadsheetTimeZone: () => 'Europe/Madrid', getSpreadsheetLocale: () => locale };
  const sheet = {
    getParent: () => spreadsheet,
    getRange(row, column) {
      const cell = {
        merge: () => cell,
        setValue(value) { cells.set(`${row}:${column}`, value); return cell; },
        setFormula(value) { cells.set(`${row}:${column}`, value); return cell; },
        setFormulas(values) {
          values.forEach((value, index) => cells.set(`${row + index}:${column}`, value[0]));
          return cell;
        },
      };
      for (const method of ['setBackground', 'setFontColor', 'setFontWeight', 'setHorizontalAlignment', 'setNumberFormat', 'setWrap', 'setVerticalAlignment']) {
        cell[method] = () => cell;
      }
      return cell;
    },
  };
  const periods = capacities.map((_, index) => ({ id: `e${index}`, name: `Eval ${index + 1}`, startDate: index, endDate: index }));
  const sessions = capacities.flatMap((count, index) => Array.from({ length: count }, () => ({ date: index })));
  const type = { periods, sessions };
  const moduleContext = { type, evaluations: periods };
  context.renderModuleHoursSummary_(sheet, {}, moduleContext, 27);
  context.installModuleEvaluationFormulas_(sheet, {}, moduleContext);
  return { cells, sessions, periods };
}

function calculate(formula, hours, capacities) {
  const sum = range => {
    const match = range.match(/\$?([A-Z]+)\$?(\d+):\$?[A-Z]+\$?(\d+)/);
    assert.ok(match, range);
    if (match[1] === 'I') return hours.slice(Number(match[2]) - 28, Number(match[3]) - 27).reduce((a, b) => a + b, 0);
    if (match[1] === 'AJ') return capacities.slice(Number(match[2]) - 29, Number(match[3]) - 28).reduce((a, b) => a + b, 0);
    throw new Error(range);
  };
  const expression = formula.slice(1)
    .replace(/SUM\((\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)\)/g, (_, range) => String(sum(range)))
    .replace(/\bAJ(\d+)\b/g, (_, row) => String(Number(row) === 29 + capacities.length
      ? capacities.reduce((a, b) => a + b, 0) : capacities[Number(row) - 29]))
    .replace(/;/g, ',');
  return Function('MIN', 'MAX', 'IF', `return ${expression}`)(
    Math.min, Math.max, (condition, yes, no) => condition ? yes : no
  );
}

function check(name, capacities, hours, expectedEvaluations, expectedPending) {
  for (const locale of ['es_ES', 'en_US']) {
    const { cells, sessions } = sheetFor(capacities, locale);
    const pending = capacities.map((_, index) => calculate(cells.get(`${29 + index}:32`), hours, capacities));
    const total = calculate(cells.get(`${29 + capacities.length}:32`), hours, capacities);
    const evaluations = hours.map((_, index) => calculate(cells.get(`${28 + index}:16`), hours, capacities));
    const evaluationIds = hours.map((_, index) => calculate(cells.get(`${28 + index}:41`), hours, capacities));
    assert.deepEqual(pending, expectedPending, `${name} (${locale})`);
    assert.equal(total, expectedPending.reduce((a, b) => a + b, 0), `${name} total (${locale})`);
    assert.deepEqual(evaluations, expectedEvaluations, `${name} evaluations (${locale})`);
    assert.deepEqual(evaluationIds, expectedEvaluations.map(value => `e${Number(value.slice(5)) - 1}`),
      `${name} evaluation IDs (${locale})`);
    if (hours.reduce((a, b) => a + b, 0) <= sessions.length) {
      const units = hours.map((count, index) => ({ hours: count, index }));
      const assignments = context.assignModuleUnitsToSessions_(sessions, units);
      const actual = capacities.map((_, index) => assignments.filter(item => item.date === index).length);
      assert.deepEqual(actual, capacities.map((capacity, index) => capacity - pending[index]), `${name} backend (${locale})`);
    }
  }
}

check('A exact', [45, 37, 17], [10, 25, 20, 20, 24], ['Eval 1', 'Eval 1', 'Eval 2', 'Eval 2', 'Eval 3'], [0, 0, 0]);
check('B incomplete', [45, 37, 17], [35], ['Eval 1'], [10, 37, 17]);
check('C crossing', [45, 37, 17], [35, 20], ['Eval 1', 'Eval 2'], [0, 27, 17]);
check('D excess', [45, 37, 17], [104], ['Eval 3'], [0, 0, -5]);
check('E before edit', [45, 37, 17], [35, 5], ['Eval 1', 'Eval 1'], [5, 37, 17]);
check('E after edit', [45, 37, 17], [35, 20], ['Eval 1', 'Eval 2'], [0, 27, 17]);
check('two evaluations', [45, 37], [55], ['Eval 2'], [0, 27]);
check('one evaluation excess', [45], [50], ['Eval 1'], [-5]);
console.log('Module Config formula cases passed');
