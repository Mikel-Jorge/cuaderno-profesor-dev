function renderPortada_(sheet) {
  const spreadsheet = sheet.getParent();
  const config = getGeneralConfigValues_(spreadsheet);
  const academicYear = config[CP.CONFIG_KEYS.ACADEMIC_YEAR] || proponerCursoAcademico_(
    new Date(),
    spreadsheet.getSpreadsheetTimeZone()
  );

  prepareCoverCanvas_(sheet);
  renderCoverHeader_(sheet, academicYear);
  renderCoverGeneralData_(sheet, config);
  renderCoverIndex_(sheet);
}

function actualizarIndicePortada() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const coverSheet = spreadsheet.getSheetByName(CP.SHEETS.COVER);
  if (coverSheet) {
    renderCoverIndex_(coverSheet);
  }
}

function prepareCoverCanvas_(sheet) {
  const managedRows = 60;
  const managedColumns = 12;
  ensureSheetSize_(sheet, managedRows, managedColumns);

  const canvas = sheet.getRange(1, 1, managedRows, managedColumns);
  canvas.breakApart();
  canvas.clear();
  canvas
    .setBackground(CP_COLORS.WHITE)
    .setFontColor(CP_COLORS.DARK)
    .setFontFamily('Arial')
    .setVerticalAlignment('middle');

  sheet.setHiddenGridlines(true);
  sheet.setTabColor(CP_COLORS.PRIMARY);
  sheet.setFrozenRows(0);
  sheet.setFrozenColumns(0);

  const columnWidths = [24, 130, 90, 90, 90, 90, 32, 280, 20, 20, 20, 20];
  columnWidths.forEach(function(width, index) {
    sheet.setColumnWidth(index + 1, width);
  });

  sheet.setRowHeights(1, managedRows, 28);
  sheet.setRowHeights(2, 2, 34);
  sheet.setRowHeight(4, 30);
  sheet.setRowHeight(5, 46);
  sheet.setRowHeight(7, 34);
  sheet.setRowHeights(9, 6, 40);
}

function renderCoverHeader_(sheet, academicYear) {
  setMergedRangeValue_(sheet.getRange('B2:L3'), 'CUADERNO DEL PROFESOR')
    .setBackground(CP_COLORS.DARK)
    .setFontColor(CP_COLORS.WHITE)
    .setFontWeight('bold')
    .setFontSize(24)
    .setHorizontalAlignment('center');

  setMergedRangeValue_(
    sheet.getRange('B4:L5'),
    'CURSO ACAD\u00c9MICO  \u00b7  ' + academicYear
  )
    .setBackground(CP_COLORS.ACCENT)
    .setFontColor(CP_COLORS.WHITE)
    .setFontWeight('bold')
    .setFontSize(16)
    .setHorizontalAlignment('center');
}

function renderCoverGeneralData_(sheet, config) {
  setMergedRangeValue_(sheet.getRange('B7:F7'), 'DATOS GENERALES')
    .setBackground(CP_COLORS.PRIMARY)
    .setFontColor(CP_COLORS.WHITE)
    .setFontWeight('bold')
    .setHorizontalAlignment('left');

  const rows = [
    ['Profesor', config[CP.CONFIG_KEYS.TEACHER]],
    ['Centro', config[CP.CONFIG_KEYS.SCHOOL]],
    ['Direcci\u00f3n', config[CP.CONFIG_KEYS.SCHOOL_ADDRESS]],
    ['Tel\u00e9fono', config[CP.CONFIG_KEYS.SCHOOL_PHONE]],
    ['Correo', config[CP.CONFIG_KEYS.SCHOOL_EMAIL]],
    ['Web', config[CP.CONFIG_KEYS.SCHOOL_WEB]],
  ];

  sheet.getRange(9, 2, rows.length, 1).setValues(rows.map(function(row) {
    return [row[0]];
  }));
  sheet.getRange(9, 2, rows.length, 1)
    .setBackground(CP_COLORS.PRIMARY_LIGHT)
    .setFontWeight('bold')
    .setFontColor(CP_COLORS.DARK);

  rows.forEach(function(row, index) {
    const valueRange = sheet.getRange(9 + index, 3, 1, 4);
    valueRange.merge();
    valueRange
      .setValue(row[1] || '')
      .setBackground(CP_COLORS.WHITE)
      .setBorder(true, true, true, true, false, false, CP_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID)
      .setWrap(true);
  });

  setCoverLink_(sheet.getRange('C13:F13'), config[CP.CONFIG_KEYS.SCHOOL_EMAIL], 'mailto:');
  setCoverLink_(sheet.getRange('C14:F14'), config[CP.CONFIG_KEYS.SCHOOL_WEB], 'web');
}

function renderCoverIndex_(coverSheet) {
  const spreadsheet = coverSheet.getParent();
  const visibleSheets = spreadsheet.getSheets().filter(function(sheet) {
    return !sheet.isSheetHidden() && sheet.getName().charAt(0) !== '_';
  });

  setMergedRangeValue_(coverSheet.getRange('H7:L7'), '\u00cdNDICE DEL CUADERNO')
    .setBackground(CP_COLORS.ACCENT)
    .setFontColor(CP_COLORS.WHITE)
    .setFontWeight('bold')
    .setHorizontalAlignment('left');

  const clearRowCount = Math.min(52, coverSheet.getMaxRows() - 8);
  coverSheet.getRange(9, 8, clearRowCount, 5)
    .clearContent()
    .setBackground(CP_COLORS.WHITE)
    .setFontColor(CP_COLORS.DARK)
    .setFontWeight('normal');

  if (!visibleSheets.length) {
    return;
  }

  const spreadsheetUrl = spreadsheet.getUrl();
  const richTextValues = visibleSheets.map(function(sheet) {
    const label = formatCoverIndexLabel_(sheet.getName());
    const richText = SpreadsheetApp.newRichTextValue()
      .setText(label)
      .setLinkUrl(spreadsheetUrl + '#gid=' + sheet.getSheetId())
      .build();
    return [richText];
  });

  coverSheet.getRange(9, 8, richTextValues.length, 1).setRichTextValues(richTextValues);
  coverSheet.getRange(9, 8, richTextValues.length, 5)
    .setBackground(CP_COLORS.MUTED)
    .setBorder(false, false, true, false, false, false, CP_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID)
    .setFontSize(11);
  coverSheet.setRowHeights(9, richTextValues.length, 32);
}

function formatCoverIndexLabel_(sheetName) {
  const match = /^(\d+)\s+(.+)$/.exec(sheetName);
  return match ? match[1] + ' \u00b7 ' + match[2] : sheetName;
}

function setCoverLink_(range, value, linkType) {
  const text = value || '';
  if (!text) {
    return;
  }

  let url = text;
  if (linkType === 'mailto:') {
    url = 'mailto:' + text;
  } else if (!/^https?:\/\//i.test(text)) {
    url = 'https://' + text;
  }

  const richText = SpreadsheetApp.newRichTextValue()
    .setText(text)
    .setLinkUrl(url)
    .build();
  range.setRichTextValue(richText);
}

function ensureSheetSize_(sheet, minimumRows, minimumColumns) {
  if (sheet.getMaxRows() < minimumRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), minimumRows - sheet.getMaxRows());
  }
  if (sheet.getMaxColumns() < minimumColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), minimumColumns - sheet.getMaxColumns());
  }
}
