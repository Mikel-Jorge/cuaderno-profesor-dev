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
  installManagedSheetProtections_(sheet, 'PORTADA');
}

function renderPortada_(sheet) {
  createOrRepairCover_(sheet);
}

function actualizarIndicePortada() {
  if (typeof CP_REPAIR_SKIP_COVER !== 'undefined' && CP_REPAIR_SKIP_COVER) return;
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

  const columnWidths = [130, 90, 90, 90, 90, 32, 280];
  columnWidths.forEach(function(width, index) {
    sheet.setColumnWidth(index + 1, width);
  });

  sheet.setRowHeights(1, bounds.rows, 28);
  sheet.setRowHeights(1, 2, 34);
  sheet.setRowHeight(3, 30);
  sheet.setRowHeight(4, 46);
  sheet.setRowHeight(6, 34);
  sheet.setRowHeights(7, 7, 40);

  setMergedRangeValue_(sheet.getRange('A1:G2'), 'CUADERNO DEL PROFESOR')
    .setFontWeight('bold')
    .setFontSize(24)
    .setHorizontalAlignment('center');

  setMergedRangeValue_(sheet.getRange('A3:G4'), '')
    .setFontWeight('bold')
    .setFontSize(16)
    .setHorizontalAlignment('center');

  setMergedRangeValue_(sheet.getRange('A6:E6'), 'DATOS GENERALES')
    .setFontWeight('bold')
    .setHorizontalAlignment('left');
  sheet.getRange('G6').setValue('ÍNDICE DEL CUADERNO')
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
  sheet.getRange(7, 1, labels.length, 1).setValues(labels).setFontWeight('bold');

  for (let row = 7; row <= 13; row += 1) {
    sheet.getRange(row, 2, 1, 4).merge().setWrap(true);
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
  fields[CP.CONFIG_KEYS.TEACHER] = { range: 'B7:E7' };
  fields[CP.CONFIG_KEYS.TEACHER_EMAIL] = { range: 'B8:E8', linkType: 'mailto:' };
  fields[CP.CONFIG_KEYS.SCHOOL] = { range: 'B9:E9' };
  fields[CP.CONFIG_KEYS.SCHOOL_ADDRESS] = { range: 'B10:E10' };
  fields[CP.CONFIG_KEYS.SCHOOL_PHONE] = { range: 'B11:E11' };
  fields[CP.CONFIG_KEYS.SCHOOL_EMAIL] = { range: 'B12:E12', linkType: 'mailto:' };
  fields[CP.CONFIG_KEYS.SCHOOL_WEB] = { range: 'B13:E13', linkType: 'web' };

  keysToUpdate.forEach(function(key) {
    if (key === CP.CONFIG_KEYS.ACADEMIC_YEAR) {
      sheet.getRange('A3:G4').setValue(
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
  sheet.setTabColor(CP.TAB_COLORS.GENERAL);

  sheet.getRange('A1:G2')
    .setBackground(colors.primary)
    .setFontColor(colors.onPrimary);
  sheet.getRange('A3:G4')
    .setBackground(colors.secondary)
    .setFontColor(colors.onSecondary);
  sheet.getRange('A6:E6')
    .setBackground(colors.primary)
    .setFontColor(colors.onPrimary);
  sheet.getRange('G6')
    .setBackground(colors.accent)
    .setFontColor(colors.onAccent);
  sheet.getRange('A7:A13')
    .setBackground(colors.muted)
    .setFontColor(colors.text);
  sheet.getRange('B7:E13')
    .setBackground(colors.surface)
    .setFontColor(colors.text);

  for (let row = 7; row <= 13; row += 1) {
    sheet.getRange(row, 2, 1, 4).setBorder(
      true, true, true, true, false, false,
      colors.border,
      SpreadsheetApp.BorderStyle.SOLID
    );
  }
  sheet.getRange('B8:E8').setFontColor(colors.accent);
  sheet.getRange('B12:E13').setFontColor(colors.accent);

  applyCoverIndexTheme_(sheet, theme);
}

function applyCoverIndexTheme_(sheet, theme) {
  const colors = theme.colors;
  const bounds = getCoverLayoutBounds_(sheet.getParent());
  const visibleSheetCount = getVisibleNotebookSheets_(sheet.getParent()).length;
  sheet.getRange(7, 7, bounds.rows - 6, 1)
    .setBackground(colors.surface)
    .setFontColor(colors.text)
    .setFontWeight('normal');
  if (visibleSheetCount) {
    sheet.getRange(7, 7, visibleSheetCount, 1)
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
  coverSheet.getRange(7, 7, coverSheet.getMaxRows() - 6, 1).clearContent();

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

  coverSheet.getRange(7, 7, richTextValues.length, 1).setRichTextValues(richTextValues);
  coverSheet.getRange(7, 7, richTextValues.length, 1).setFontSize(11);
  coverSheet.setRowHeights(7, richTextValues.length, 32);
  applyCoverIndexTheme_(coverSheet, theme);
  trimSheetToBounds_(coverSheet, bounds.rows, bounds.columns);
}

function getCoverLayoutBounds_(spreadsheet) {
  return {
    rows: Math.max(13, 6 + getVisibleNotebookSheets_(spreadsheet).length),
    columns: 7,
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
