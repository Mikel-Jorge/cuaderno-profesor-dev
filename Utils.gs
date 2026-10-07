function getOrCreateSheet_(spreadsheet, sheetName) {
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function moveSheetToFirstPosition_(spreadsheet, sheet) {
  sheet.showSheet();
  spreadsheet.setActiveSheet(sheet);
  spreadsheet.moveActiveSheet(1);
}

function reorderManagedVisibleSheets_(spreadsheet) {
  const workbook = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = workbook.getActiveSheet();
  const activeSheetId = activeSheet && activeSheet.getSheetId();
  const fixedNames = [
    CP.SHEETS.COVER,
    CP.SHEETS.CALENDAR,
    CP.SHEETS.SCHEDULE,
    CP.SHEETS.STUDENTS,
  ];
  const sheets = workbook.getSheets();
  const ordered = [];
  const registeredFamilies = {};
  readModuleConfigRegistry_(workbook).forEach(function(record) {
    registeredFamilies[record.sheetId] = 0;
    if (record.trackingSheetId) registeredFamilies[record.trackingSheetId] = 1;
    if (record.evaluationSheetId) registeredFamilies[record.evaluationSheetId] = 2;
  });

  fixedNames.forEach(function(sheetName) {
    const sheet = workbook.getSheetByName(sheetName);
    if (sheet) {
      sheet.setTabColor(CP.TAB_COLORS.GENERAL);
      ordered.push(sheet);
    }
  });

  [0, 1, 2].forEach(function(familyIndex) {
    sheets.filter(function(sheet) {
      const family = registeredFamilies[sheet.getSheetId()];
      return family === familyIndex ||
        familyIndex === 1 && /^5 Seg\s+.+\s+OLD\s+\d{4}$/i.test(sheet.getName()) &&
        isRegisteredModuleTrackingSheet_(sheet);
    }).sort(function(first, second) {
      if (familyIndex === 1) {
        return compareTrackingSheetNames_(first.getName(), second.getName());
      }
      return first.getName().localeCompare(second.getName(), 'es', { sensitivity: 'base' });
    }).forEach(function(sheet) {
      sheet.setTabColor([
        CP.TAB_COLORS.CONFIG, CP.TAB_COLORS.TRACKING, CP.TAB_COLORS.EVALUATION,
      ][familyIndex]);
      ordered.push(sheet);
    });
  });

  ordered.forEach(function(sheet, index) {
    sheet.showSheet();
    workbook.setActiveSheet(sheet);
    workbook.moveActiveSheet(index + 1);
  });

  const previousActiveSheet = workbook.getSheets().find(function(sheet) {
    return sheet.getSheetId() === activeSheetId && !sheet.isSheetHidden();
  });
  if (previousActiveSheet) workbook.setActiveSheet(previousActiveSheet);
}

function compareTrackingSheetNames_(firstName, secondName) {
  const first = parseTrackingSheetNameForOrder_(firstName);
  const second = parseTrackingSheetNameForOrder_(secondName);
  return first.acronym.localeCompare(second.acronym, 'es', { sensitivity: 'base' }) ||
    Number(first.historical) - Number(second.historical) ||
    first.group.localeCompare(second.group, 'es', { sensitivity: 'base' }) ||
    second.academicYear.localeCompare(first.academicYear, 'es', { sensitivity: 'base' }) ||
    first.name.localeCompare(second.name, 'es', { sensitivity: 'base' });
}

function parseTrackingSheetNameForOrder_(sheetName) {
  const name = String(sheetName || '');
  let body = name.replace(/^5 Seg\s+/, '').trim();
  const historicalMatch = body.match(/\s+OLD\s+(\d{4})$/i);
  const academicYear = historicalMatch ? historicalMatch[1] : '';
  if (historicalMatch) {
    body = body.slice(0, historicalMatch.index).trim();
  }
  const separator = ' · ';
  const separatorIndex = body.indexOf(separator);
  return {
    name: name,
    acronym: (separatorIndex === -1 ? body : body.slice(0, separatorIndex)).trim(),
    group: separatorIndex === -1 ? '' : body.slice(separatorIndex + separator.length).trim(),
    historical: Boolean(historicalMatch),
    academicYear: academicYear,
  };
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
