function getOrCreateSheet_(spreadsheet, sheetName) {
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function moveSheetToFirstPosition_(spreadsheet, sheet) {
  sheet.showSheet();
  spreadsheet.setActiveSheet(sheet);
  spreadsheet.moveActiveSheet(1);
}

function hideTechnicalSheets_(spreadsheet) {
  [CP.SHEETS.CONFIG, CP.SHEETS.META].forEach(function(sheetName) {
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
