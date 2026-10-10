const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = vm.createContext({});
['Config.gs', 'Theme.gs', 'GeneralConfig.gs'].forEach(file => {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
});
const evaluate = source => JSON.parse(vm.runInContext(`JSON.stringify(${source})`, context));
const expected = [
  ['verde-profesional', 'Verde profesional', '#2F6B4F', '#355C6D', '#D07A32'],
  ['bosque-sereno', 'Bosque sereno', '#3F6B45', '#68705C', '#C59A45'],
  ['atlantico', 'Atlántico', '#1F6E8C', '#355070', '#A65B7C'],
  ['petroleo-coral', 'Petróleo coral', '#0F6674', '#3F556B', '#A85D46'],
  ['indigo-ambar', 'Índigo ámbar', '#4454A6', '#56657A', '#C98732'],
  ['burdeos-piedra', 'Burdeos piedra', '#8A3D52', '#5F6878', '#D0A64A'],
  ['terracota-salvia', 'Terracota salvia', '#A6553D', '#496D6A', '#3A8276'],
  ['ciruela-arena', 'Ciruela arena', '#6E477B', '#596579', '#C57E42'],
  ['azul-profesional', 'Azul profesional', '#2D5F9A', '#4D647A', '#2F7E7A'],
  ['grafito-esmeralda', 'Grafito esmeralda', '#475569', '#2F7464', '#B9832F'],
];
assert.strictEqual(evaluate('CP_DEFAULT_THEME_PRESET'), expected[0][0]);
assert.strictEqual(evaluate('CP.NOTEBOOK_VERSION'), '1.8.5');
assert.strictEqual(evaluate('CP.SCHEMA_VERSION'), '11');
const presets = evaluate('getThemeConfigForUi_(null, {}).presets');
assert.strictEqual(presets.length, 10);
presets.forEach((preset, index) => {
  const [id, label, primary, secondary, accent] = expected[index];
  assert.strictEqual(preset.id, id);
  assert.strictEqual(preset.label, label);
  assert.deepStrictEqual([preset.colors.primary, preset.colors.secondary, preset.colors.accent],
    [primary, secondary, accent]);
  for (const [key, onKey] of [['primary', 'onPrimary'], ['secondary', 'onSecondary'], ['accent', 'onAccent']]) {
    const ratio = evaluate(`getContrastRatio_('${preset.colors[key]}', '${preset.colors[onKey]}')`);
    assert(ratio >= 4.5, `${id} ${key}: ${ratio}`);
  }
});

const keys = ['tema_primary', 'tema_secondary', 'tema_accent'];
const legacy = [
  ['oceano', 'atlantico', ['#004E64', '#006E8A', '#167D70']],
  ['turquesa-naranja', 'petroleo-coral', ['#0A656A', '#087987', '#B85D02']],
  ['verde-natural', 'verde-profesional', ['#507255', '#3F773F', '#C5E063']],
  ['coral-menta', 'terracota-salvia', ['#B94F46', '#377771', '#4CE0B3']],
  ['burdeos-lavanda', 'burdeos-piedra', ['#A30B37', '#734649', '#BBB6DF']],
  ['azul-clasico', 'azul-profesional', ['#1D4ED8', '#075985', '#0F766E']],
];
for (const [oldId, newId, oldColors] of legacy) {
  const values = { tema_preset: oldId };
  keys.forEach((key, index) => { values[key] = oldColors[index]; });
  context.storedValues = values;
  context.getStoredConfigMap_ = () => context.storedValues;
  let theme = evaluate('getActiveTheme_({}, getStoredConfigMap_({}))');
  assert.strictEqual(theme.id, newId);
  const newPreset = presets.find(preset => preset.id === newId);
  assert.deepStrictEqual(keys.map((_, index) => theme.colors[['primary', 'secondary', 'accent'][index]]),
    keys.map((_, index) => newPreset.colors[['primary', 'secondary', 'accent'][index]]));
  assert.deepStrictEqual(keys.map(key => context.storedValues[key]), oldColors, 'opening is read only');
  const config = evaluate('getGeneralConfigValues_({})');
  assert.strictEqual(config.tema_preset, newId);
  assert.deepStrictEqual(keys.map(key => config[key]),
    [newPreset.colors.primary, newPreset.colors.secondary, newPreset.colors.accent]);
  keys.forEach((key, index) => { values[key] = ['#123456', '#654321', '#ABCDEF'][index]; });
  theme = evaluate('getActiveTheme_({}, getStoredConfigMap_({}))');
  assert.strictEqual(theme.id, newId);
  assert.deepStrictEqual([theme.colors.primary, theme.colors.secondary, theme.colors.accent],
    ['#123456', '#654321', '#ABCDEF']);
  assert.deepStrictEqual(keys.map(key => evaluate(`getGeneralConfigValues_({})['${key}']`)),
    ['#123456', '#654321', '#ABCDEF']);
}
for (const [oldId, newId] of [['claro-azul', 'azul-profesional'], ['oscuro-azul', 'azul-profesional'],
  ['claro-verde', 'verde-profesional'], ['oscuro-verde', 'verde-profesional']]) {
  context.storedValues = { tema_preset: oldId, tema_primary: '#123456',
    tema_secondary: '#654321', tema_accent: '#ABCDEF' };
  const theme = evaluate('getActiveTheme_({}, getStoredConfigMap_({}))');
  assert.strictEqual(theme.id, newId);
  assert.deepStrictEqual([theme.colors.primary, theme.colors.secondary, theme.colors.accent],
    ['#123456', '#654321', '#ABCDEF']);
}
context.storedValues = { tema_preset: 'verde-natural', tema_primary: '#123456',
  tema_secondary: '#654321', tema_accent: '#ABCDEF' };
context.getConfigRows_ = () => Object.entries(context.storedValues).map(entry => entry);
let repairedRows;
const range = { clearContent() { return this; }, setValues(rows) { repairedRows = rows; return this; },
  setNumberFormat() { return this; }, setBackground() { return this; }, setFontColor() { return this; },
  setFontWeight() { return this; } };
const sheet = { getParent: () => ({}), getLastRow: () => 5, getLastColumn: () => 2,
  clearFormats() {}, getRange: () => range, setFrozenRows() {}, autoResizeColumns() {} };
context.repairSheet = sheet;
vm.runInContext('initializeConfigSheet_(repairSheet)', context);
const repaired = Object.fromEntries(repairedRows.slice(1));
assert.strictEqual(repaired.tema_preset, 'verde-profesional');
assert.deepStrictEqual(keys.map(key => repaired[key]), ['#123456', '#654321', '#ABCDEF']);
context.storedValues = { tema_preset: 'verde-natural', tema_primary: '#507255',
  tema_secondary: '#3F773F', tema_accent: '#C5E063' };
vm.runInContext('initializeConfigSheet_(repairSheet)', context);
const migrated = Object.fromEntries(repairedRows.slice(1));
assert.strictEqual(migrated.tema_preset, 'verde-profesional');
assert.deepStrictEqual(keys.map(key => migrated[key]), ['#2F6B4F', '#355C6D', '#D07A32']);

assert(fs.readFileSync('UiDialogGeneralConfig.html', 'utf8').includes('THEME_CONFIG.presets.forEach'));
assert(fs.readFileSync('UiDialogNewCourse.html', 'utf8').includes('THEME.presets.forEach'));
console.log('ten theme presets, contrast, migration and custom colors: ok');
