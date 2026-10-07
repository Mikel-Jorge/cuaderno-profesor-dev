const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = {
  console,
  Object,
  Date,
  Math,
  String,
  Number,
  Boolean,
  Array,
  RegExp,
  normalizeScheduleText_: value => value == null ? '' : String(value).trim(),
  normalizeCalendarText_: value => value == null ? '' : String(value).trim(),
  normalizeThemeColor_: value => /^#[0-9A-F]{6}$/i.test(String(value || ''))
    ? String(value).toUpperCase() : '',
  parseCalendarDate_: value => new Date(String(value) + 'T00:00:00Z'),
  compareCalendarDates_: (first, second) => first.getTime() - second.getTime(),
  Utilities: { formatDate: date => date.toISOString().slice(0, 10) },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('Tracking.gs', 'utf8'), context);

const units = [
  { id: 'U1', code: 'UT1' },
  { id: 'U2', code: 'UT2' },
];
const plan = [
  ['p1', 'A', '2026-2027', '2026-09-14', 'T1', 'U1'],
  ['p2', 'A', '2026-2027', '2026-09-14', 'T2', 'U1'],
  ['p3', 'A', '2026-2027', '2026-09-15', 'T1', 'U1'],
  ['p4', 'A', '2026-2027', '2026-09-16', 'T1', 'U1'],
  ['p5', 'A', '2026-2027', '2026-09-16', 'T2', 'U2'],
];
const grouped = context.buildTrackingDataRows_(plan, units, 'Europe/Madrid');
assert.strictEqual(
  JSON.stringify(grouped.map(row => [row.dateKey, row.unitCode, row.actual])),
  JSON.stringify([
    ['2026-09-14', 'UT1', 2],
    ['2026-09-15', 'UT1', 1],
    ['2026-09-16', 'UT1', 1],
    ['2026-09-16', 'UT2', 1],
  ])
);

const accumulated = context.buildTrackingAccumulatedFormula_(7, ';');
assert.strictEqual(accumulated, '=IF($B7="";"";SUMIF($B$2:$B7;$B7;$E$2:$E7))');
assert.ok(accumulated.includes('$B$2:$B7'));
assert.ok(accumulated.includes('$E$2:$E7'));

const total = context.buildTrackingTotalFormula_(7, 5, ';');
assert.strictEqual(total, '=IFERROR(VLOOKUP($B7;$J$2:$K$5;2;FALSE);"")');
assert.ok(!total.includes('4 Config'));

context.getEvaluationPeriodsForType_ = () => [
  { name: '1ª evaluación', startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date('2026-12-20T00:00:00Z') },
  { name: '2ª EVALUACIÓN', startDate: new Date('2026-12-21T00:00:00Z'),
    endDate: new Date('2027-03-31T00:00:00Z') },
];
context.getAllCalendarEvents_ = () => [
  { description: 'Vacaciones de Navidad', startDate: new Date('2026-12-24T00:00:00Z'),
    typeIds: [] },
  { description: 'Semana Santa', startDate: new Date('2027-03-25T00:00:00Z'),
    typeIds: ['FP2'] },
];
const timeline = context.buildTrackingTimeline_(
  { getSpreadsheetTimeZone: () => 'Europe/Madrid' },
  {
    type: { id: 'FP2', startDate: new Date('2026-09-01T00:00:00Z'),
      practicesStart: new Date('2027-03-30T00:00:00Z') },
    evaluations: [{ endDate: new Date('2026-12-20T00:00:00Z') },
      { endDate: new Date('2027-03-31T00:00:00Z') }],
  },
  [
    { kind: 'data', dateKey: '2026-09-14', date: new Date('2026-09-14T00:00:00Z'), firstIndex: 0 },
    { kind: 'data', dateKey: '2027-01-11', date: new Date('2027-01-11T00:00:00Z'), firstIndex: 1 },
  ]
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(timeline.filter(item => item.kind === 'separator').map(item => item.label))),
  ['1ª EVALUACIÓN', 'NAVIDAD', '2ª EVALUACIÓN', 'SEMANA SANTA', 'FEOE']
);

assert.strictEqual(
  context.buildTrackingArchiveName_('5 Seg PMDM · DAM2A', '2025-2026'),
  '5 Seg PMDM · DAM2A OLD 2526'
);

assert.strictEqual(context.buildTrackingUtColorFormula_('UT1'),
  '=INDIRECT("B"&ROW())="UT1"');
assert.strictEqual(context.buildTrackingUtColorFormula_('UT"2'),
  '=INDIRECT("B"&ROW())="UT""2"');
assert.strictEqual(context.buildTrackingUtOverageFormula_('UT1', ';'),
  '=AND(INDIRECT("B"&ROW())="UT1";ISNUMBER(INDIRECT("F"&ROW()));' +
  'ISNUMBER(INDIRECT("G"&ROW()));INDIRECT("F"&ROW())>INDIRECT("G"&ROW()))');
assert.ok(context.buildTrackingUtOverageFormula_('UT2', ',').includes('="UT2",ISNUMBER'));

const borders = [];
let installedRules = [];
context.getModuleFormulaSeparator_ = () => ';';
context.getAccessibleTextColor_ = () => '#172033';
context.SpreadsheetApp = {
  BorderStyle: { SOLID: 'SOLID' },
  newConditionalFormatRule: () => {
    const rule = { formula: '', ranges: [] };
    rule.setBackground = value => { rule.background = value; return rule; };
    rule.setFontColor = value => { rule.fontColor = value; return rule; };
    rule.setBold = value => { rule.bold = value; return rule; };
    rule.whenFormulaSatisfied = formula => { rule.formula = formula; return rule; };
    rule.setRanges = ranges => { rule.ranges = ranges.map(range => range.position); return rule; };
    rule.build = () => ({ formula: rule.formula, ranges: rule.ranges,
      background: rule.background, fontColor: rule.fontColor, bold: rule.bold });
    return rule;
  },
};
const styledSheet = {
  getParent: () => ({}),
  getRange(row, column, height = 1, width = 1) {
    const range = { position: [row, column, height, width] };
    for (const method of ['setFontWeight', 'setBackground', 'setFontColor',
      'setHorizontalAlignment']) range[method] = () => range;
    range.setBorder = (...args) => { borders.push({ position: range.position, args }); return range; };
    range.getDisplayValue = () => row === 4 ? 'NAVIDAD' : '';
    return range;
  },
  setConditionalFormatRules: rules => { installedRules = rules; },
};
context.styleTrackingRows_(styledSheet, [2, 3, 5], 5, [
  { code: 'UT1', color: '#BBF7D0' }, { code: 'UT2', color: '#BFDBFE' },
]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(installedRules[2].ranges)),
  [[2, 1, 2, 7], [5, 1, 1, 7]]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(installedRules[0].ranges)),
  [[2, 6, 2, 1], [5, 6, 1, 1]]);
assert.strictEqual(installedRules[0].background, '#BBF7D0');
assert.strictEqual(installedRules[1].background, '#BFDBFE');
assert.strictEqual(installedRules[0].fontColor, '#DC2626');
assert.strictEqual(installedRules[0].bold, true);
assert.ok(installedRules[0].formula.includes('="UT1";ISNUMBER'));
assert.ok(installedRules[1].formula.includes('="UT2";ISNUMBER'));
assert.deepStrictEqual(borders.filter(border => border.args[6] === '#B0B0B0')
  .map(border => border.position), [[2, 1, 2, 8], [5, 1, 1, 8]]);
assert.ok(borders.filter(border => border.args[6] === '#B0B0B0')
  .every(border => border.args[2] === true && border.args[4] === false &&
    border.args[5] === true));
assert.ok(!borders.some(border => border.position[1] === 3 && border.args[3] === true));
const firstRules = JSON.stringify(installedRules);
context.styleTrackingRows_(styledSheet, [2, 3, 5], 5, [
  { code: 'UT1', color: '#BBF7D0' }, { code: 'UT2', color: '#BFDBFE' },
]);
assert.strictEqual(JSON.stringify(installedRules), firstRules);

const source = fs.readFileSync('Tracking.gs', 'utf8');
assert.ok(source.includes("buildManagedModuleSheetName_(spreadsheet, '5 Seg'"));
assert.ok(source.includes("buildManagedModuleSheetName_(spreadsheet, '6 Eval'"));
assert.ok(source.includes('createdSheets.reverse().forEach'));
assert.ok(source.includes('formatAndRepairTrackingSheet_(trackingSheet)'));
assert.ok(source.includes('materializeTrackingForArchive_(operation.trackingSheet)'));

console.log('Tracking grouping, formulas, joint creation, repair and OLD cases passed');
