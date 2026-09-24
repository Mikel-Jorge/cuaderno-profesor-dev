function inicializarCuaderno() {
  initializeCoverStructure_();
  initializeConfigStructure_();
  initializeMetaStructure_();
  finishStructureInitialization_();
}

function initializeCoverStructure_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  const coverSheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.COVER);
  renderPortada_(coverSheet);
  moveSheetToFirstPosition_(spreadsheet, coverSheet);
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

  spreadsheet.toast(
    'Estructura base inicializada o reparada.',
    CP.PROJECT_NAME,
    5
  );
}

function initializeConfigSheet_(sheet) {
  sheet.clearFormats();

  const currentValues = getKeyValueMap_(sheet, 1, 2);
  const rows = [
    ['curso_academico', 'Curso academico editable desde la portada o futuros asistentes.'],
    ['profesor', 'Nombre y apellidos del docente.'],
    ['centro', 'Centro educativo.'],
  ];
  const values = [['Clave', 'Valor', 'Descripcion']].concat(rows.map(function(row) {
    const key = row[0];
    return [key, currentValues[key] || '', row[1]];
  }));

  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  sheet.getRange('A1:C1')
    .setBackground(CP_COLORS.DARK)
    .setFontColor(CP_COLORS.WHITE)
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, values[0].length);
}

function initializeMetaSheet_(sheet) {
  sheet.clearFormats();

  const values = [
    ['Clave', 'Valor'],
    ['proyecto', CP.PROJECT_NAME],
    ['version_cuaderno', CP.NOTEBOOK_VERSION],
    ['version_esquema', CP.SCHEMA_VERSION],
    ['entorno', CP.ENVIRONMENT],
  ];

  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  sheet.getRange('A1:B1')
    .setBackground(CP_COLORS.DARK)
    .setFontColor(CP_COLORS.WHITE)
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, values[0].length);
}
