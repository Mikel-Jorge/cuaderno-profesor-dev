function abrirDatosGenerales() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.CONFIG);
  initializeConfigSheet_(configSheet);
  configSheet.hideSheet();

  const values = getGeneralConfigForUi_(spreadsheet);
  const template = HtmlService.createTemplateFromFile('UiDialogGeneralConfig');
  template.generalConfig = values;
  template.themeConfig = getThemeConfigForUi_(spreadsheet, values);
  setCommonUiTemplateData_(template);

  const output = template.evaluate()
    .setWidth(CP.UI.GENERAL_CONFIG_DIALOG_WIDTH)
    .setHeight(CP.UI.GENERAL_CONFIG_DIALOG_HEIGHT);

  SpreadsheetApp.getUi().showModalDialog(output, CP.MENU.GENERAL_DATA);
}

function guardarDatosGenerales(input) {
  const values = normalizeGeneralConfigInput_(input);
  validateAcademicYear_(values[CP.CONFIG_KEYS.ACADEMIC_YEAR]);
  validateThemeConfig_(values);

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.CONFIG);
  initializeConfigSheet_(configSheet);

  const previousValues = getStoredConfigMap_(spreadsheet);
  const changedKeys = getConfigFields_().map(function(field) {
    return field.key;
  }).filter(function(key) {
    return normalizeConfigValue_(previousValues[key]) !== values[key];
  });

  updateConfigValues_(configSheet, values, changedKeys);

  const coverSheet = spreadsheet.getSheetByName(CP.SHEETS.COVER);
  if (coverSheet) {
    const changedGeneralKeys = changedKeys.filter(isGeneralDataConfigKey_);
    if (changedGeneralKeys.length) {
      updateCoverData_(coverSheet, values, changedGeneralKeys);
    }
    if (changedKeys.some(isThemeConfigKey_)) {
      applyCoverTheme_(coverSheet, getActiveTheme_(spreadsheet, values));
    }
  }

  configSheet.hideSheet();
  spreadsheet.toast('Configuración guardada.', CP.PROJECT_NAME, 4);
  return {
    message: changedKeys.length
      ? 'La configuración se ha guardado y la portada se ha actualizado.'
      : 'No había cambios pendientes.',
    values: values,
    theme: getThemeConfigForUi_(spreadsheet, values),
  };
}

function initializeConfigSheet_(sheet) {
  const fields = getConfigFields_();
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
  }).map(function(row) {
    return [row[0], row[1]];
  });

  const configuredRows = fields.map(function(field) {
    const hasValue = Object.prototype.hasOwnProperty.call(currentValues, field.key);
    return [field.key, hasValue ? currentValues[field.key] : field.defaultValue || ''];
  });
  const values = [['Clave', 'Valor']].concat(configuredRows, unknownRows);
  const rowsToClear = Math.max(sheet.getLastRow(), values.length);
  const columnsToClear = Math.max(sheet.getLastColumn(), 3);
  const theme = getActiveTheme_(sheet.getParent(), currentValues);

  sheet.clearFormats();
  sheet.getRange(1, 1, rowsToClear, columnsToClear).clearContent();
  sheet.getRange(1, 1, values.length, 2).setValues(values);
  sheet.getRange(2, 2, values.length - 1, 1).setNumberFormat('@');
  sheet.getRange('A1:B1')
    .setBackground(theme.colors.primary)
    .setFontColor(theme.colors.onPrimary)
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
}

function updateConfigValues_(sheet, values, changedKeys) {
  const rowByKey = getConfigFields_().reduce(function(map, field, index) {
    map[field.key] = index + 2;
    return map;
  }, {});

  changedKeys.forEach(function(key) {
    sheet.getRange(rowByKey[key], 2)
      .setNumberFormat('@')
      .setValue(values[key]);
  });
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
  const storedValues = getStoredConfigMap_(spreadsheet);

  return getConfigFields_().reduce(function(values, field) {
    const storedValue = storedValues[field.key];
    values[field.key] = storedValue === null || storedValue === undefined
      ? field.defaultValue || ''
      : normalizeConfigValue_(storedValue);
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
    throw new Error('No se han recibido datos de configuración válidos.');
  }

  return getConfigFields_().reduce(function(values, field) {
    values[field.key] = normalizeConfigValue_(input[field.key] || field.defaultValue || '');
    return values;
  }, {});
}

function normalizeConfigValue_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function validateAcademicYear_(academicYear) {
  const match = /^(\d{4})-(\d{4})$/.exec(academicYear);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) {
    throw new Error('El curso académico debe tener el formato YYYY-YYYY, por ejemplo 2026-2027.');
  }
}

function getConfigRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  return sheet.getRange(2, 1, lastRow - 1, 2).getValues().filter(function(row) {
    return Boolean(row[0]);
  });
}

function getConfigFields_() {
  return [
    { key: CP.CONFIG_KEYS.ACADEMIC_YEAR },
    { key: CP.CONFIG_KEYS.TEACHER },
    { key: CP.CONFIG_KEYS.TEACHER_EMAIL },
    { key: CP.CONFIG_KEYS.SCHOOL },
    { key: CP.CONFIG_KEYS.SCHOOL_ADDRESS },
    { key: CP.CONFIG_KEYS.SCHOOL_PHONE },
    { key: CP.CONFIG_KEYS.SCHOOL_EMAIL },
    { key: CP.CONFIG_KEYS.SCHOOL_WEB },
    { key: CP.CONFIG_KEYS.THEME_PRESET, defaultValue: CP_DEFAULT_THEME_PRESET },
    { key: CP.CONFIG_KEYS.THEME_PRIMARY, defaultValue: CP_THEME_PRESETS[CP_DEFAULT_THEME_PRESET].colors.primary },
    { key: CP.CONFIG_KEYS.THEME_SECONDARY, defaultValue: CP_THEME_PRESETS[CP_DEFAULT_THEME_PRESET].colors.secondary },
    { key: CP.CONFIG_KEYS.THEME_ACCENT, defaultValue: CP_THEME_PRESETS[CP_DEFAULT_THEME_PRESET].colors.accent },
  ];
}

function isGeneralDataConfigKey_(key) {
  return [
    CP.CONFIG_KEYS.ACADEMIC_YEAR,
    CP.CONFIG_KEYS.TEACHER,
    CP.CONFIG_KEYS.TEACHER_EMAIL,
    CP.CONFIG_KEYS.SCHOOL,
    CP.CONFIG_KEYS.SCHOOL_ADDRESS,
    CP.CONFIG_KEYS.SCHOOL_PHONE,
    CP.CONFIG_KEYS.SCHOOL_EMAIL,
    CP.CONFIG_KEYS.SCHOOL_WEB,
  ].indexOf(key) !== -1;
}

function isThemeConfigKey_(key) {
  return [
    CP.CONFIG_KEYS.THEME_PRESET,
    CP.CONFIG_KEYS.THEME_PRIMARY,
    CP.CONFIG_KEYS.THEME_SECONDARY,
    CP.CONFIG_KEYS.THEME_ACCENT,
  ].indexOf(key) !== -1;
}
