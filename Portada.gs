function createOrRepairCover_(sheet) {
  const spreadsheet = sheet.getParent();
  const config = getGeneralConfigValues_(spreadsheet);
  if (!config[CP.CONFIG_KEYS.ACADEMIC_YEAR]) {
    config[CP.CONFIG_KEYS.ACADEMIC_YEAR] = proponerCursoAcademico_(
      new Date(),
      spreadsheet.getSpreadsheetTimeZone()
    );
  }

  prepareCoverStructure_(sheet);
  updateCoverData_(sheet, config);
  applyCoverTheme_(sheet, getActiveTheme_(spreadsheet, config));
  renderCoverIndex_(sheet);
}

function renderPortada_(sheet) {
  createOrRepairCover_(sheet);
}

function actualizarIndicePortada() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const coverSheet = spreadsheet.getSheetByName(CP.SHEETS.COVER);
  if (coverSheet) {
    renderCoverIndex_(coverSheet);
  }
}

function prepareCoverStructure_(sheet) {
  const bounds = getCoverLayoutBounds_(sheet.getParent());
  ensureSheetSize_(sheet, bounds.rows, bounds.columns);

  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  const canvas = sheet.getRange(1, 1, bounds.rows, bounds.columns);
  canvas.clear();
  canvas
    .setFontFamily('Arial')
    .setVerticalAlignment('middle');

  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(0);
  sheet.setFrozenColumns(0);

  const columnWidths = [24, 130, 90, 90, 90, 90, 32, 280];
  columnWidths.forEach(function(width, index) {
    sheet.setColumnWidth(index + 1, width);
  });

  sheet.setRowHeights(1, bounds.rows, 28);
  sheet.setRowHeights(2, 2, 34);
  sheet.setRowHeight(4, 30);
  sheet.setRowHeight(5, 46);
  sheet.setRowHeight(7, 34);
  sheet.setRowHeights(9, 7, 40);

  setMergedRangeValue_(sheet.getRange('B2:H3'), 'CUADERNO DEL PROFESOR')
    .setFontWeight('bold')
    .setFontSize(24)
    .setHorizontalAlignment('center');

  setMergedRangeValue_(sheet.getRange('B4:H5'), '')
    .setFontWeight('bold')
    .setFontSize(16)
    .setHorizontalAlignment('center');

  setMergedRangeValue_(sheet.getRange('B7:F7'), 'DATOS GENERALES')
    .setFontWeight('bold')
    .setHorizontalAlignment('left');
  sheet.getRange('H7').setValue('ÍNDICE DEL CUADERNO')
    .setFontWeight('bold')
    .setHorizontalAlignment('left');

  const labels = [
    ['Profesor'],
    ['Correo del profesor'],
    ['Centro'],
    ['Dirección'],
    ['Teléfono'],
    ['Correo del centro'],
    ['Web del centro'],
  ];
  sheet.getRange(9, 2, labels.length, 1).setValues(labels).setFontWeight('bold');

  for (let row = 9; row <= 15; row += 1) {
    sheet.getRange(row, 3, 1, 4).merge().setWrap(true);
  }
}

function updateCoverData_(sheet, config, changedKeys) {
  const keysToUpdate = changedKeys || [
    CP.CONFIG_KEYS.ACADEMIC_YEAR,
    CP.CONFIG_KEYS.TEACHER,
    CP.CONFIG_KEYS.TEACHER_EMAIL,
    CP.CONFIG_KEYS.SCHOOL,
    CP.CONFIG_KEYS.SCHOOL_ADDRESS,
    CP.CONFIG_KEYS.SCHOOL_PHONE,
    CP.CONFIG_KEYS.SCHOOL_EMAIL,
    CP.CONFIG_KEYS.SCHOOL_WEB,
  ];
  const theme = getActiveTheme_(sheet.getParent(), config);
  const fields = {};
  fields[CP.CONFIG_KEYS.TEACHER] = { range: 'C9:F9' };
  fields[CP.CONFIG_KEYS.TEACHER_EMAIL] = { range: 'C10:F10', linkType: 'mailto:' };
  fields[CP.CONFIG_KEYS.SCHOOL] = { range: 'C11:F11' };
  fields[CP.CONFIG_KEYS.SCHOOL_ADDRESS] = { range: 'C12:F12' };
  fields[CP.CONFIG_KEYS.SCHOOL_PHONE] = { range: 'C13:F13' };
  fields[CP.CONFIG_KEYS.SCHOOL_EMAIL] = { range: 'C14:F14', linkType: 'mailto:' };
  fields[CP.CONFIG_KEYS.SCHOOL_WEB] = { range: 'C15:F15', linkType: 'web' };

  keysToUpdate.forEach(function(key) {
    if (key === CP.CONFIG_KEYS.ACADEMIC_YEAR) {
      sheet.getRange('B4:H5').setValue(
        'CURSO ACADÉMICO  ·  ' + (config[key] || '')
      );
      return;
    }

    const field = fields[key];
    if (!field) {
      return;
    }
    const range = sheet.getRange(field.range);
    if (field.linkType) {
      setCoverLink_(range, config[key], field.linkType, theme.colors.accent);
    } else {
      range.setValue(config[key] || '');
    }
  });
}

function applyCoverTheme_(sheet, theme) {
  const colors = theme.colors;
  const bounds = getCoverLayoutBounds_(sheet.getParent());
  ensureSheetSize_(sheet, bounds.rows, bounds.columns);
  sheet.getRange(1, 1, bounds.rows, bounds.columns)
    .setBackground(colors.background)
    .setFontColor(colors.text);
  sheet.setTabColor(colors.primary);

  sheet.getRange('B2:H3')
    .setBackground(colors.primary)
    .setFontColor(colors.onPrimary);
  sheet.getRange('B4:H5')
    .setBackground(colors.secondary)
    .setFontColor(colors.onSecondary);
  sheet.getRange('B7:F7')
    .setBackground(colors.primary)
    .setFontColor(colors.onPrimary);
  sheet.getRange('H7')
    .setBackground(colors.accent)
    .setFontColor(colors.onAccent);
  sheet.getRange('B9:B15')
    .setBackground(colors.muted)
    .setFontColor(colors.text);
  sheet.getRange('C9:F15')
    .setBackground(colors.surface)
    .setFontColor(colors.text);

  for (let row = 9; row <= 15; row += 1) {
    sheet.getRange(row, 3, 1, 4).setBorder(
      true, true, true, true, false, false,
      colors.border,
      SpreadsheetApp.BorderStyle.SOLID
    );
  }
  sheet.getRange('C10:F10').setFontColor(colors.accent);
  sheet.getRange('C14:F15').setFontColor(colors.accent);

  applyCoverIndexTheme_(sheet, theme);
}

function applyCoverIndexTheme_(sheet, theme) {
  const colors = theme.colors;
  const bounds = getCoverLayoutBounds_(sheet.getParent());
  const visibleSheetCount = getVisibleNotebookSheets_(sheet.getParent()).length;
  sheet.getRange(9, 8, bounds.rows - 8, 1)
    .setBackground(colors.surface)
    .setFontColor(colors.text)
    .setFontWeight('normal');
  if (visibleSheetCount) {
    sheet.getRange(9, 8, visibleSheetCount, 1)
      .setBackground(colors.muted)
      .setFontColor(colors.accent)
      .setBorder(false, false, true, false, false, false, colors.border, SpreadsheetApp.BorderStyle.SOLID);
  }
}

function renderCoverIndex_(coverSheet) {
  const spreadsheet = coverSheet.getParent();
  const visibleSheets = getVisibleNotebookSheets_(spreadsheet);
  const theme = getActiveTheme_(spreadsheet);
  const bounds = getCoverLayoutBounds_(spreadsheet);
  ensureSheetSize_(coverSheet, bounds.rows, bounds.columns);
  coverSheet.getRange(9, 8, coverSheet.getMaxRows() - 8, 1).clearContent();

  if (!visibleSheets.length) {
    applyCoverIndexTheme_(coverSheet, theme);
    trimSheetToBounds_(coverSheet, bounds.rows, bounds.columns);
    return;
  }

  const spreadsheetUrl = spreadsheet.getUrl();
  const linkStyle = SpreadsheetApp.newTextStyle()
    .setForegroundColor(theme.colors.accent)
    .setUnderline(true)
    .build();
  const richTextValues = visibleSheets.map(function(sheet) {
    const label = formatCoverIndexLabel_(sheet.getName());
    return [SpreadsheetApp.newRichTextValue()
      .setText(label)
      .setLinkUrl(spreadsheetUrl + '#gid=' + sheet.getSheetId())
      .setTextStyle(linkStyle)
      .build()];
  });

  coverSheet.getRange(9, 8, richTextValues.length, 1).setRichTextValues(richTextValues);
  coverSheet.getRange(9, 8, richTextValues.length, 1).setFontSize(11);
  coverSheet.setRowHeights(9, richTextValues.length, 32);
  applyCoverIndexTheme_(coverSheet, theme);
  trimSheetToBounds_(coverSheet, bounds.rows, bounds.columns);
}

function getCoverLayoutBounds_(spreadsheet) {
  return {
    rows: Math.max(15, 8 + getVisibleNotebookSheets_(spreadsheet).length),
    columns: 8,
  };
}

function getVisibleNotebookSheets_(spreadsheet) {
  return spreadsheet.getSheets().filter(function(sheet) {
    return !sheet.isSheetHidden() && sheet.getName().charAt(0) !== '_';
  });
}

function formatCoverIndexLabel_(sheetName) {
  const match = /^(\d+)\s+(.+)$/.exec(sheetName);
  return match ? match[1] + ' \u00b7 ' + match[2] : sheetName;
}

function setCoverLink_(range, value, linkType, color) {
  const text = value || '';
  if (!text) {
    range.clearContent();
    return;
  }

  let url = text;
  if (linkType === 'mailto:') {
    url = 'mailto:' + text;
  } else if (!/^https?:\/\//i.test(text)) {
    url = 'https://' + text;
  }

  const textStyle = SpreadsheetApp.newTextStyle()
    .setForegroundColor(color)
    .setUnderline(true)
    .build();
  range.setRichTextValue(SpreadsheetApp.newRichTextValue()
    .setText(text)
    .setLinkUrl(url)
    .setTextStyle(textStyle)
    .build());
}
