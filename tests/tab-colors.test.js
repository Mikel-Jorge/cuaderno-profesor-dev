const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const colors = {
  GENERAL: '#546E7A', CONFIG: '#2E7D32', TRACKING: '#1565C0',
  EVALUATION: '#E65100',
};
const context = vm.createContext({
  CP: { TAB_COLORS: colors, SHEETS: {
    COVER: '0 Portada', CALENDAR: '1 Calendario',
    SCHEDULE: '2 Horario', STUDENTS: '3 Alumnado',
  } },
});
vm.runInContext(fs.readFileSync('Utils.gs', 'utf8'), context);
const sheets = [
  [1, '0 Portada'], [2, '1 Calendario'], [3, '2 Horario'], [4, '3 Alumnado'],
  [40, '4 Config módulo'], [50, '5 Seg módulo'], [60, '6 Eval módulo'],
  [51, '5 Seg antiguo OLD 2526'], [90, '4 Config personal'],
].map(([id, name]) => ({
  getSheetId: () => id, getName: () => name, isSheetHidden: () => false,
  setTabColor(value) { this.tabColor = value; }, showSheet() {},
}));
let active = sheets[0];
const workbook = {
  getSheets: () => sheets,
  getSheetByName: name => sheets.find(sheet => sheet.getName() === name),
  getActiveSheet: () => active,
  setActiveSheet: sheet => { active = sheet; },
  moveActiveSheet() {},
};
context.readModuleConfigRegistry_ = () => [{
  sheetId: 40, trackingSheetId: 50, evaluationSheetId: 60,
}];
context.isRegisteredModuleTrackingSheet_ = sheet => sheet.getSheetId() === 51;
context.reorderManagedVisibleSheets_(workbook);
assert.deepEqual(sheets.map(sheet => sheet.tabColor), [
  colors.GENERAL, colors.GENERAL, colors.GENERAL, colors.GENERAL,
  colors.CONFIG, colors.TRACKING, colors.EVALUATION, colors.TRACKING, undefined,
]);
console.log('Managed tab colors and user sheet preservation passed');
