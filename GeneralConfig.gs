function abrirDatosGenerales() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.CONFIG);
  initializeConfigSheet_(configSheet);
  configSheet.hideSheet();

  const template = HtmlService.createTemplateFromFile('UiDialogGeneralConfig');
  template.generalConfig = getGeneralConfigForUi_(spreadsheet);
  setCommonUiTemplateData_(template);

  const output = template.evaluate()
    .setWidth(CP.UI.GENERAL_CONFIG_DIALOG_WIDTH)
    .setHeight(CP.UI.GENERAL_CONFIG_DIALOG_HEIGHT);

  SpreadsheetApp.getUi().showModalDialog(output, CP.MENU.GENERAL_DATA);
}

function guardarDatosGenerales(input) {
  const values = normalizeGeneralConfigInput_(input);
  validateAcademicYear_(values[CP.CONFIG_KEYS.ACADEMIC_YEAR]);
  const fields = getGeneralConfigFields_();

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.CONFIG);
  initializeConfigSheet_(configSheet);

  const valueRows = fields.map(function(field) {
    return [values[field.key]];
  });
  configSheet.getRange(2, 2, valueRows.length, 1)
    .setNumberFormat('@')
    .setValues(valueRows);

  const coverSheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.COVER);
  moveSheetToFirstPosition_(spreadsheet, coverSheet);
  renderPortada_(coverSheet);
  hideTechnicalSheets_(spreadsheet);

  spreadsheet.toast('Datos generales guardados.', CP.PROJECT_NAME, 4);
  return {
    message: 'Los datos generales se han guardado y la portada se ha actualizado.',
  };
}

function initializeConfigSheet_(sheet) {
  const fields = getGeneralConfigFields_();
  const existingRows = getConfigRows_(sheet);
  const currentValues = existingRows.reduce(function(map, row) {
    map[row[0]] = row[1];
    return map;
  }, {});
  const knownKeys = fields.reduce(function(map, field) {
    map[field.key] = true;
    return map;
  }, {});
  const unknownRows = existingRows.filter(function(row) {
    return !knownKeys[row[0]];
  });

  const configuredRows = fields.map(function(field) {
    const hasValue = Object.prototype.hasOwnProperty.call(currentValues, field.key);
    return [field.key, hasValue ? currentValues[field.key] : '', field.description];
  });
  const values = [['Clave', 'Valor', 'Descripcion']].concat(configuredRows, unknownRows);
  const rowsToClear = Math.max(sheet.getLastRow(), values.length);

  sheet.clearFormats();
  sheet.getRange(1, 1, rowsToClear, values[0].length).clearContent();
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  sheet.getRange(2, 2, values.length - 1, 1).setNumberFormat('@');
  sheet.getRange('A1:C1')
    .setBackground(CP_COLORS.DARK)
    .setFontColor(CP_COLORS.WHITE)
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, values[0].length);
}

function getGeneralConfigForUi_(spreadsheet) {
  const values = getGeneralConfigValues_(spreadsheet);
  if (!values[CP.CONFIG_KEYS.ACADEMIC_YEAR]) {
    values[CP.CONFIG_KEYS.ACADEMIC_YEAR] = proponerCursoAcademico_(
      new Date(),
      spreadsheet.getSpreadsheetTimeZone()
    );
  }
  return values;
}

function getGeneralConfigValues_(spreadsheet) {
  const configSheet = spreadsheet.getSheetByName(CP.SHEETS.CONFIG);
  const storedValues = configSheet ? getKeyValueMap_(configSheet, 1, 2) : {};

  return getGeneralConfigFields_().reduce(function(values, field) {
    const value = storedValues[field.key];
    values[field.key] = value === null || value === undefined ? '' : String(value).trim();
    return values;
  }, {});
}

function proponerCursoAcademico_(date, timeZone) {
  const year = Number(Utilities.formatDate(date, timeZone, 'yyyy'));
  const month = Number(Utilities.formatDate(date, timeZone, 'M'));
  const startYear = month >= 8 ? year : year - 1;
  return startYear + '-' + (startYear + 1);
}

function normalizeGeneralConfigInput_(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('No se han recibido datos de configuraci\u00f3n v\u00e1lidos.');
  }

  return getGeneralConfigFields_().reduce(function(values, field) {
    const value = input[field.key];
    values[field.key] = value === null || value === undefined ? '' : String(value).trim();
    return values;
  }, {});
}

function validateAcademicYear_(academicYear) {
  const match = /^(\d{4})-(\d{4})$/.exec(academicYear);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) {
    throw new Error('El curso acad\u00e9mico debe tener el formato YYYY-YYYY, por ejemplo 2026-2027.');
  }
}

function getConfigRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  return sheet.getRange(2, 1, lastRow - 1, 3).getValues().filter(function(row) {
    return Boolean(row[0]);
  });
}

function getGeneralConfigFields_() {
  return [
    {
      key: CP.CONFIG_KEYS.ACADEMIC_YEAR,
      description: 'Curso acad\u00e9mico en formato YYYY-YYYY.',
    },
    {
      key: CP.CONFIG_KEYS.TEACHER,
      description: 'Nombre y apellidos del profesor.',
    },
    {
      key: CP.CONFIG_KEYS.SCHOOL,
      description: 'Nombre del centro educativo.',
    },
    {
      key: CP.CONFIG_KEYS.SCHOOL_ADDRESS,
      description: 'Direcci\u00f3n del centro educativo.',
    },
    {
      key: CP.CONFIG_KEYS.SCHOOL_PHONE,
      description: 'Tel\u00e9fono del centro educativo.',
    },
    {
      key: CP.CONFIG_KEYS.SCHOOL_EMAIL,
      description: 'Correo electr\u00f3nico del centro educativo.',
    },
    {
      key: CP.CONFIG_KEYS.SCHOOL_WEB,
      description: 'Sitio web del centro educativo.',
    },
  ];
}
