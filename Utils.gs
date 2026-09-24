function getOrCreateSheet_(spreadsheet, sheetName) {
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function moveSheetToFirstPosition_(spreadsheet, sheet) {
  sheet.showSheet();
  spreadsheet.setActiveSheet(sheet);
  spreadsheet.moveActiveSheet(1);
}

function hideTechnicalSheets_(spreadsheet) {
  Object.keys(CP.SHEETS).map(function(key) {
    return CP.SHEETS[key];
  }).filter(function(sheetName) {
    return sheetName.charAt(0) === '_';
  }).forEach(function(sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (sheet) {
      sheet.hideSheet();
    }
  });
}

function getKeyValueMap_(sheet, keyColumn, valueColumn) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return {};
  }

  const width = Math.max(keyColumn, valueColumn);
  const values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  return values.reduce(function(map, row) {
    const key = row[keyColumn - 1];
    if (key) {
      map[key] = row[valueColumn - 1];
    }
    return map;
  }, {});
}

function setMergedRangeValue_(range, value) {
  if (!range.isPartOfMerge()) {
    range.merge();
  }
  return range.setValue(value);
}

function ensureSheetSize_(sheet, requiredRows, requiredColumns) {
  validateSheetBounds_(requiredRows, requiredColumns);
  const currentRows = sheet.getMaxRows();
  const currentColumns = sheet.getMaxColumns();

  if (currentRows < requiredRows) {
    sheet.insertRowsAfter(currentRows, requiredRows - currentRows);
  }
  if (currentColumns < requiredColumns) {
    sheet.insertColumnsAfter(currentColumns, requiredColumns - currentColumns);
  }
}

function trimSheetToBounds_(sheet, maxRows, maxColumns) {
  validateSheetBounds_(maxRows, maxColumns);
  const currentRows = sheet.getMaxRows();
  const currentColumns = sheet.getMaxColumns();

  if (currentRows > maxRows) {
    sheet.deleteRows(maxRows + 1, currentRows - maxRows);
  }
  if (currentColumns > maxColumns) {
    sheet.deleteColumns(maxColumns + 1, currentColumns - maxColumns);
  }
}

function validateSheetBounds_(rows, columns) {
  if (!Number.isInteger(rows) || rows < 1 || !Number.isInteger(columns) || columns < 1) {
    throw new Error('Las dimensiones de la hoja deben ser enteros positivos.');
  }
}
