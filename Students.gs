const CP_STUDENT_HEADERS = Object.freeze([
  'Apellidos',
  'Nombre',
  'Grupo',
  'Email',
  'REACA',
  'Información / Medidas',
  'alumno_id',
]);

const CP_STUDENTS_MIN_DATA_ROWS = 200;

function normalizeStudentReacaValue_(value) {
  if (value === true || String(value).trim().toUpperCase() === 'TRUE') return true;
  if (value === false || value === '' || value === null ||
      String(value).trim().toUpperCase() === 'FALSE') return false;
  return null;
}

function createOrRepairStudentsSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.STUDENTS);
  const requiredRows = Math.max(CP_STUDENTS_MIN_DATA_ROWS + 1, sheet.getLastRow());

  sheet.showSheet();
  ensureSheetSize_(sheet, requiredRows, CP_STUDENT_HEADERS.length);
  sheet.getRange(1, 1, 1, CP_STUDENT_HEADERS.length).setValues([CP_STUDENT_HEADERS]);
  const dataRows = Math.max(0, sheet.getLastRow() - 1);
  const reacaValues = dataRows
    ? sheet.getRange(2, 5, dataRows, 1).getValues().map(function(row) { return row[0]; }) : [];
  if (dataRows) {
    const values = sheet.getRange(2, 1, dataRows, CP_STUDENT_HEADERS.length).getValues();
    let changed = false;
    values.forEach(function(row) {
      if (row.slice(0, 3).every(function(value) { return String(value).trim(); }) && !row[6]) {
        row[6] = Utilities.getUuid();
        changed = true;
      }
    });
    if (changed) sheet.getRange(2, 7, dataRows, 1).setValues(values.map(function(row) { return [row[6]]; }));
  }

  applyStudentsSheetTheme_(sheet, getActiveTheme_(spreadsheet), requiredRows);
  syncStudentGroupValidation_(spreadsheet);
  const checkboxRange = sheet.getRange(2, 5, requiredRows - 1, 1);
  checkboxRange.setNumberFormat('General').insertCheckboxes();
  if (reacaValues.length) {
    let unknown = 0;
    const restored = reacaValues.map(function(value) {
      const normalized = normalizeStudentReacaValue_(value);
      if (normalized === null) unknown += 1;
      return [normalized === null ? value : normalized];
    });
    sheet.getRange(2, 5, restored.length, 1).setValues(restored);
    if (unknown) console.warn('REACA: ' + unknown +
      ' valores no reconocidos conservados para revisión manual.');
  }
  trimSheetToBounds_(sheet, requiredRows, CP_STUDENT_HEADERS.length);
  installManagedSheetProtections_(sheet);
  return sheet;
}

function ensureStudentIdsForValidRows_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(CP.SHEETS.STUDENTS);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
  let added = 0;
  rows.forEach(function(row, index) {
    if (row.slice(0, 3).every(function(value) { return String(value).trim(); }) &&
        !String(row[6] || '').trim()) {
      sheet.getRange(index + 2, 7).setValue(Utilities.getUuid());
      added += 1;
    }
  });
  return added;
}

function syncStudentGroupValidation_(spreadsheet) {
  const book = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  const sheet = book.getSheetByName(CP.SHEETS.STUDENTS);
  if (!sheet || sheet.getMaxRows() < 2) return;
  const activities = book.getSheetByName(CP.SHEETS.SCHEDULE_ACTIVITIES);
  const groups = activities && activities.getLastRow() > 1
    ? activities.getRange(2, 2, activities.getLastRow() - 1, 5).getValues()
      .filter(function(row) { return normalizeScheduleActivityCategory_(row[0]) === 'MODULO'; })
      .map(function(row) { return normalizeScheduleText_(row[4]).replace(/\s+/g, ' '); })
      .filter(Boolean) : [];
  const unique = Array.from(new Set(groups)).sort(function(a, b) {
    return a.localeCompare(b, 'es', { sensitivity: 'base' });
  });
  const range = sheet.getRange(2, 3, sheet.getMaxRows() - 1, 1);
  if (unique.length) {
    range.setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(unique, true).setAllowInvalid(true).build());
  } else {
    range.clearDataValidations();
  }
}

function applyStudentsSheetTheme_(sheet, theme, rowCount) {
  const colors = theme.colors;
  const columnWidths = [190, 150, 120, 250, 75, 280, 180];

  sheet.setHiddenGridlines(false);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(0);
  sheet.setTabColor(CP.TAB_COLORS.GENERAL);
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
  sheet.getRange(2, 5, Math.max(1, rowCount - 1), 1).setHorizontalAlignment('center');
  sheet.getRange(2, 6, Math.max(1, rowCount - 1), 1).setWrap(true);
  sheet.hideColumns(7);
}

function clearStudentsForNewCourse_() {
  const sheet = createOrRepairStudentsSheet_();
  const dataRowCount = Math.max(0, sheet.getLastRow() - 1);
  if (dataRowCount) {
    sheet.getRange(2, 1, dataRowCount, CP_STUDENT_HEADERS.length).clearContent();
    sheet.getRange(2, 5, dataRowCount, 1).insertCheckboxes();
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
