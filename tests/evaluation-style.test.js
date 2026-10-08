const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const colors = { primary: '#111111', onPrimary: '#FFFFFF', secondary: '#222222',
  onSecondary: '#FFFFFF', accent: '#334455', onAccent: '#FFFFFF', surface: '#FFFFFF',
  text: '#000000', muted: '#EEEEEE', border: '#BBBBBB' };
const context = {
  getActiveTheme_: () => ({ colors }),
  SpreadsheetApp: { BorderStyle: { SOLID: 'SOLID', SOLID_MEDIUM: 'MEDIUM' } },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('Evaluation.gs', 'utf8'), context);
context.installEvaluationFormatting_ = () => {};
const writes = [];
const sheet = {
  getParent: () => ({}),
  setRowHeights: () => {},
  setColumnWidth: (column, width) => writes.push({ kind: 'width', column, width }),
  getRange(...range) {
    return new Proxy({}, { get(_target, method) {
      return (...args) => {
        writes.push({ kind: 'range', range, method, args });
        return sheet.getRange(...range);
      };
    } });
  },
};
const layout = { lastVisibleColumn: 6, finalStart: 5, finalMediaColumn: 5,
  finalEducaColumn: 6, groups: [] };
context.styleEvaluationSheet_(sheet, layout, 4, 8);
function has(range, method, value) {
  return writes.some(write => write.kind === 'range' &&
    JSON.stringify(write.range) === JSON.stringify(range) &&
    write.method === method && write.args[0] === value);
}
assert(has([4, 1, 4, 2], 'setHorizontalAlignment', 'left'));
assert(has([4, 3, 4, 1], 'setHorizontalAlignment', 'center'));
assert(has([1, 5, 1, 2], 'setBackground', colors.accent));
assert(has([2, 5, 2, 2], 'setBackground', colors.accent));
assert(writes.some(write => write.kind === 'width' && write.column === 5 && write.width === 82));
assert(writes.some(write => write.kind === 'width' && write.column === 6 && write.width === 68));
console.log('evaluation style: ok');
