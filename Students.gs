const CP_STUDENT_HEADERS = Object.freeze([
  'Apellidos',
  'Nombre',
  'Grupo',
  'Email',
]);

const CP_STUDENTS_MIN_DATA_ROWS = 200;

function createOrRepairStudentsSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.STUDENTS);
  const requiredRows = Math.max(CP_STUDENTS_MIN_DATA_ROWS + 1, sheet.getLastRow());

  sheet.showSheet();
  ensureSheetSize_(sheet, requiredRows, CP_STUDENT_HEADERS.length);
  sheet.getRange(1, 1, 1, CP_STUDENT_HEADERS.length).setValues([CP_STUDENT_HEADERS]);

  applyStudentsSheetTheme_(sheet, getActiveTheme_(spreadsheet), requiredRows);
  trimSheetToBounds_(sheet, requiredRows, CP_STUDENT_HEADERS.length);
  return sheet;
}

function applyStudentsSheetTheme_(sheet, theme, rowCount) {
  const colors = theme.colors;
  const columnWidths = [190, 150, 120, 250];

  sheet.setHiddenGridlines(false);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(0);
  sheet.setTabColor(colors.accent);
  sheet.setRowHeight(1, 34);
  sheet.setRowHeights(2, Math.max(1, rowCount - 1), 28);
  columnWidths.forEach(function(width, index) {
    sheet.setColumnWidth(index + 1, width);
  });

  sheet.getRange(1, 1, rowCount, CP_STUDENT_HEADERS.length)
    .setFontFamily('Arial')
    .setVerticalAlignment('middle');
  sheet.getRange(1, 1, 1, CP_STUDENT_HEADERS.length)
    .setBackground(colors.primary)
    .setFontColor(colors.onPrimary)
    .setFontWeight('bold')
    .setHorizontalAlignment('left');
  sheet.getRange(2, 1, Math.max(1, rowCount - 1), CP_STUDENT_HEADERS.length)
    .setBackground(colors.surface)
    .setFontColor(colors.text)
    .setFontWeight('normal');
  sheet.getRange(2, 4, Math.max(1, rowCount - 1), 1).setNumberFormat('@');
}

function clearStudentsForNewCourse_() {
  const sheet = createOrRepairStudentsSheet_();
  const dataRowCount = Math.max(0, sheet.getLastRow() - 1);
  if (dataRowCount) {
    sheet.getRange(2, 1, dataRowCount, CP_STUDENT_HEADERS.length).clearContent();
  }
  return 'Estructura de Alumnado conservada y datos del curso anterior eliminados.';
}

function isStudentsConfiguredForSidebar_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(CP.SHEETS.STUDENTS);
  if (!sheet || sheet.getLastRow() < 2) return false;

  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 3)
    .getDisplayValues()
    .some(function(row) {
      return row.every(function(value) {
        return Boolean(String(value).trim());
      });
    });
}
