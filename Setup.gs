function inicializarCuaderno() {
  initializeCoverStructure_();
  initializeConfigStructure_();
  initializeMetaStructure_();
  finishStructureInitialization_();
}

function initializeCoverStructure_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  const coverSheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.COVER);
  moveSheetToFirstPosition_(spreadsheet, coverSheet);
  createOrRepairCover_(coverSheet);
}

function initializeConfigStructure_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.CONFIG);
  initializeConfigSheet_(configSheet);
}

function initializeMetaStructure_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const metaSheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.META);
  initializeMetaSheet_(metaSheet);
}

function finishStructureInitialization_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  hideTechnicalSheets_(spreadsheet);
  actualizarIndicePortada();

  spreadsheet.toast(
    'Estructura base inicializada o reparada.',
    CP.PROJECT_NAME,
    5
  );
}

function initializeMetaSheet_(sheet) {
  const theme = getActiveTheme_(sheet.getParent());
  sheet.clearFormats();
  sheet.clearContents();

  const values = [
    ['Clave', 'Valor'],
    ['proyecto', CP.PROJECT_NAME],
    ['version_cuaderno', String(CP.NOTEBOOK_VERSION)],
    ['version_esquema', String(CP.SCHEMA_VERSION)],
  ];

  sheet.getRange(2, 2, values.length - 1, 1).setNumberFormat('@');
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  sheet.getRange('A1:B1')
    .setBackground(theme.colors.primary)
    .setFontColor(theme.colors.onPrimary)
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, values[0].length);
}
