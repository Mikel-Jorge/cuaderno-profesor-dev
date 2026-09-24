const CP_CALENDAR_TYPE_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 'FP1', name: '1º' }),
  Object.freeze({ id: 'FP2', name: '2º' }),
  Object.freeze({ id: 'ONLINE', name: 'Online' }),
  Object.freeze({ id: 'CE', name: 'Curso de Especialización' }),
]);

const CP_CALENDAR_CATEGORIES = Object.freeze({
  FESTIVO: Object.freeze({ label: 'Festivo', priority: 10, nonTeaching: true }),
  VACACIONES: Object.freeze({ label: 'Vacaciones', priority: 20, nonTeaching: true }),
  NO_LECTIVO: Object.freeze({ label: 'No lectivo', priority: 30, nonTeaching: true }),
  REUNION: Object.freeze({ label: 'Reunión', priority: 40, nonTeaching: false }),
  DESTACADO: Object.freeze({ label: 'Destacado', priority: 50, nonTeaching: false }),
});

const CP_CALENDAR_HEADERS = Object.freeze({
  TYPES: Object.freeze([
    'tipo_id', 'nombre', 'activo', 'fecha_inicio', 'fecha_fin',
    'practicas_inicio', 'practicas_fin', 'repaso_inicio', 'repaso_fin',
  ]),
  EVALUATIONS: Object.freeze([
    'evaluacion_id', 'tipo_id', 'orden', 'nombre', 'fecha_fin',
  ]),
  DATES: Object.freeze([
    'fecha_id', 'fecha_inicio', 'fecha_fin', 'categoria',
    'tipo_id', 'descripcion', 'prioridad',
  ]),
});

function initializeCalendarStructure_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const typesSheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.CALENDAR_TYPES);
  const evaluationsSheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.CALENDAR_EVALUATIONS);
  const datesSheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.CALENDAR_DATES);

  initializeCalendarTypesSheet_(typesSheet);
  initializeCalendarTableSheet_(evaluationsSheet, CP_CALENDAR_HEADERS.EVALUATIONS, [5]);
  initializeCalendarTableSheet_(datesSheet, CP_CALENDAR_HEADERS.DATES, [2, 3]);

  typesSheet.hideSheet();
  evaluationsSheet.hideSheet();
  datesSheet.hideSheet();
}

function initializeCalendarTypesSheet_(sheet) {
  initializeCalendarTableSheet_(sheet, CP_CALENDAR_HEADERS.TYPES, [4, 5, 6, 7, 8, 9]);
  const existingRows = readCalendarTableRows_(sheet, CP_CALENDAR_HEADERS.TYPES.length);
  const rowById = {};
  const uniqueRows = [];

  existingRows.forEach(function(row) {
    const typeId = normalizeCalendarText_(row[0]);
    if (typeId && !rowById[typeId]) {
      rowById[typeId] = row;
      uniqueRows.push(row);
    }
  });

  CP_CALENDAR_TYPE_DEFINITIONS.forEach(function(definition) {
    if (!rowById[definition.id]) {
      const row = [definition.id, definition.name, false, '', '', '', '', '', ''];
      rowById[definition.id] = row;
      uniqueRows.push(row);
    }
  });

  const orderedRows = CP_CALENDAR_TYPE_DEFINITIONS.map(function(definition) {
    const row = rowById[definition.id].slice(0, CP_CALENDAR_HEADERS.TYPES.length);
    row[0] = definition.id;
    row[1] = definition.name;
    row[2] = normalizeCalendarBoolean_(row[2]);
    return row;
  }).concat(uniqueRows.filter(function(row) {
    return !isSupportedCalendarTypeId_(normalizeCalendarText_(row[0]));
  }));

  writeCalendarTable_(sheet, CP_CALENDAR_HEADERS.TYPES, orderedRows, [4, 5, 6, 7, 8, 9]);
}

function initializeCalendarTableSheet_(sheet, headers, dateColumns) {
  ensureSheetSize_(sheet, 2, headers.length);
  const theme = getActiveTheme_(sheet.getParent());
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground(theme.colors.primary)
    .setFontColor(theme.colors.onPrimary)
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  dateColumns.forEach(function(column) {
    sheet.getRange(2, column, Math.max(1, sheet.getMaxRows() - 1), 1)
      .setNumberFormat('dd/MM/yyyy');
  });
  sheet.autoResizeColumns(1, headers.length);
}

function abrirConfiguracionCalendario() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  initializeCalendarStructure_();
  let calendarConfig;
  try {
    calendarConfig = getCalendarConfigForUi_(spreadsheet);
  } catch (error) {
    calendarConfig = {
      academicYear: '',
      blockingError: error && error.message
        ? error.message
        : 'Configura primero el curso académico en Datos generales.',
      types: CP_CALENDAR_TYPE_DEFINITIONS.map(function(definition) {
        return {
          id: definition.id,
          name: definition.name,
          active: false,
          startDate: '',
          endDate: '',
          practicesStart: '',
          practicesEnd: '',
          reviewStart: '',
          reviewEnd: '',
          evaluations: [],
        };
      }),
      events: [],
      categories: getCalendarCategoriesForUi_(),
    };
  }
  const template = HtmlService.createTemplateFromFile('UiDialogCalendarConfig');
  template.calendarConfig = calendarConfig;
  setCommonUiTemplateData_(template);

  const output = template.evaluate()
    .setWidth(CP.UI.CALENDAR_CONFIG_DIALOG_WIDTH)
    .setHeight(CP.UI.CALENDAR_CONFIG_DIALOG_HEIGHT);
  SpreadsheetApp.getUi().showModalDialog(output, CP.MENU.CALENDAR_CONFIG);
}

function guardarConfiguracionCalendario(input) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const normalized = normalizeAndValidateCalendarConfig_(input, spreadsheet);
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) {
    throw new Error('No se ha podido bloquear el cuaderno para guardar. Inténtalo de nuevo.');
  }

  try {
    initializeCalendarStructure_();
    const snapshots = captureCalendarTableSnapshots_(spreadsheet);
    try {
      persistCalendarConfig_(spreadsheet, normalized);
    } catch (error) {
      try {
        restoreCalendarTableSnapshots_(spreadsheet, snapshots);
      } catch (rollbackError) {
        throw new Error(
          'No se ha podido guardar el calendario ni restaurar completamente el estado anterior. ' +
          'Revisa las hojas técnicas antes de continuar.'
        );
      }
      throw error;
    }
  } finally {
    lock.releaseLock();
  }

  spreadsheet.toast('Configuración del calendario guardada.', CP.PROJECT_NAME, 4);
  return {
    message: 'La configuración del calendario se ha guardado.',
    data: getCalendarConfigForUi_(spreadsheet),
  };
}

function getCalendarConfigForUi_(spreadsheet) {
  const academicYear = getConfiguredAcademicYear_(spreadsheet);
  const timeZone = spreadsheet.getSpreadsheetTimeZone();
  const typeRows = readCalendarTableRows_(
    spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_TYPES),
    CP_CALENDAR_HEADERS.TYPES.length
  );
  const evaluationRows = readCalendarTableRows_(
    spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_EVALUATIONS),
    CP_CALENDAR_HEADERS.EVALUATIONS.length
  );
  const eventRows = readCalendarTableRows_(
    spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_DATES),
    CP_CALENDAR_HEADERS.DATES.length
  );

  return {
    academicYear: academicYear,
    types: CP_CALENDAR_TYPE_DEFINITIONS.map(function(definition) {
      const row = typeRows.find(function(item) {
        return normalizeCalendarText_(item[0]) === definition.id;
      }) || [];
      return {
        id: definition.id,
        name: definition.name,
        active: normalizeCalendarBoolean_(row[2]),
        startDate: formatCalendarDateForUi_(row[3], timeZone),
        endDate: formatCalendarDateForUi_(row[4], timeZone),
        practicesStart: formatCalendarDateForUi_(row[5], timeZone),
        practicesEnd: formatCalendarDateForUi_(row[6], timeZone),
        reviewStart: formatCalendarDateForUi_(row[7], timeZone),
        reviewEnd: formatCalendarDateForUi_(row[8], timeZone),
        evaluations: evaluationRows.filter(function(item) {
          return normalizeCalendarText_(item[1]) === definition.id;
        }).sort(function(first, second) {
          return Number(first[2]) - Number(second[2]);
        }).map(function(item) {
          return {
            id: normalizeCalendarText_(item[0]),
            name: normalizeCalendarText_(item[3]),
            endDate: formatCalendarDateForUi_(item[4], timeZone),
          };
        }),
      };
    }),
    events: eventRows.filter(function(row) {
      const typeId = normalizeCalendarText_(row[4]);
      return isSupportedCalendarCategory_(row[3]) && (!typeId || isSupportedCalendarTypeId_(typeId));
    }).map(function(row) {
      return {
        id: normalizeCalendarText_(row[0]),
        startDate: formatCalendarDateForUi_(row[1], timeZone),
        endDate: formatCalendarDateForUi_(row[2], timeZone),
        category: normalizeCalendarText_(row[3]),
        typeId: normalizeCalendarText_(row[4]),
        description: normalizeCalendarText_(row[5]),
      };
    }),
    categories: getCalendarCategoriesForUi_(),
  };
}

function getCalendarCategoriesForUi_() {
  return Object.keys(CP_CALENDAR_CATEGORIES).map(function(categoryId) {
    return { id: categoryId, label: CP_CALENDAR_CATEGORIES[categoryId].label };
  });
}

function normalizeAndValidateCalendarConfig_(input, spreadsheet) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.types) || !Array.isArray(input.events)) {
    throw new Error('No se han recibido datos de calendario válidos.');
  }
  const academicYear = getConfiguredAcademicYear_(spreadsheet);
  const timeZone = spreadsheet.getSpreadsheetTimeZone();
  const academicBounds = getAcademicYearBounds_(academicYear, timeZone);
  const inputTypeById = input.types.reduce(function(map, type) {
    if (type && isSupportedCalendarTypeId_(type.id)) {
      map[type.id] = type;
    }
    return map;
  }, {});

  const types = CP_CALENDAR_TYPE_DEFINITIONS.map(function(definition) {
    return normalizeCalendarType_(inputTypeById[definition.id] || {}, definition, timeZone);
  });
  types.forEach(function(type) {
    validateCalendarType_(type, academicBounds, timeZone);
  });

  const seenEventIds = {};
  const events = input.events.map(function(event) {
    return normalizeCalendarEvent_(event, timeZone);
  });
  events.forEach(function(event) {
    if (seenEventIds[event.id]) {
      throw new Error('Se ha recibido una fecha especial duplicada.');
    }
    seenEventIds[event.id] = true;
    validateDateWithinRange_(event.startDate, academicBounds.start, academicBounds.end,
      'La fecha especial debe estar dentro del curso académico.', timeZone);
    validateDateWithinRange_(event.endDate, event.startDate, academicBounds.end,
      'El final de la fecha especial no puede ser anterior al inicio ni quedar fuera del curso.', timeZone);
  });

  return { types: types, events: events };
}

function normalizeCalendarType_(input, definition, timeZone) {
  const evaluations = Array.isArray(input.evaluations) ? input.evaluations : [];
  const seenEvaluationIds = {};
  return {
    id: definition.id,
    name: definition.name,
    active: input.active === true,
    startDate: parseCalendarDate_(input.startDate, timeZone, 'la fecha de inicio', false),
    endDate: parseCalendarDate_(input.endDate, timeZone, 'la fecha de fin', false),
    practicesStart: parseCalendarDate_(input.practicesStart, timeZone, 'el inicio de prácticas', false),
    practicesEnd: parseCalendarDate_(input.practicesEnd, timeZone, 'el fin de prácticas', false),
    reviewStart: parseCalendarDate_(input.reviewStart, timeZone, 'el inicio de repaso', false),
    reviewEnd: parseCalendarDate_(input.reviewEnd, timeZone, 'el fin de repaso', false),
    evaluations: evaluations.map(function(evaluation, index) {
      const evaluationId = normalizeCalendarText_(evaluation && evaluation.id) ||
        createCalendarRecordId_('EV_' + definition.id);
      if (seenEvaluationIds[evaluationId]) {
        throw new Error('Hay evaluaciones duplicadas en ' + definition.name + '.');
      }
      seenEvaluationIds[evaluationId] = true;
      return {
        id: evaluationId,
        typeId: definition.id,
        order: index + 1,
        name: normalizeCalendarText_(evaluation && evaluation.name),
        endDate: parseCalendarDate_(
          evaluation && evaluation.endDate,
          timeZone,
          'la fecha final de evaluación',
          true
        ),
      };
    }),
  };
}

function validateCalendarType_(type, academicBounds, timeZone) {
  if (!type.active) {
    return;
  }
  if (!type.startDate || !type.endDate) {
    throw new Error('Indica las fechas de inicio y fin para ' + type.name + '.');
  }
  validateDateWithinRange_(type.startDate, academicBounds.start, academicBounds.end,
    'El inicio de ' + type.name + ' queda fuera del curso académico.', timeZone);
  validateDateWithinRange_(type.endDate, type.startDate, academicBounds.end,
    'El periodo de ' + type.name + ' no es válido.', timeZone);
  validateOptionalCalendarRange_(type.practicesStart, type.practicesEnd, type, 'prácticas', timeZone);
  validateOptionalCalendarRange_(type.reviewStart, type.reviewEnd, type, 'repaso', timeZone);

  let previousEnd = null;
  type.evaluations.forEach(function(evaluation) {
    if (!evaluation.name) {
      throw new Error('Todas las evaluaciones de ' + type.name + ' deben tener nombre.');
    }
    validateDateWithinRange_(evaluation.endDate, type.startDate, type.endDate,
      'Las evaluaciones de ' + type.name + ' deben quedar dentro de su periodo lectivo.', timeZone);
    if (previousEnd && compareCalendarDates_(evaluation.endDate, previousEnd, timeZone) <= 0) {
      throw new Error('Las evaluaciones de ' + type.name + ' deben tener fechas estrictamente ascendentes.');
    }
    previousEnd = evaluation.endDate;
  });
}

function validateOptionalCalendarRange_(startDate, endDate, type, label, timeZone) {
  if (!startDate && !endDate) {
    return;
  }
  if (!startDate || !endDate) {
    throw new Error('Completa las dos fechas del periodo de ' + label + ' de ' + type.name + '.');
  }
  validateDateWithinRange_(startDate, type.startDate, type.endDate,
    'El inicio de ' + label + ' de ' + type.name + ' queda fuera de su periodo.', timeZone);
  validateDateWithinRange_(endDate, startDate, type.endDate,
    'El periodo de ' + label + ' de ' + type.name + ' no es válido.', timeZone);
}

function normalizeCalendarEvent_(input, timeZone) {
  if (!input || typeof input !== 'object') {
    throw new Error('Hay una fecha especial incompleta.');
  }
  const category = normalizeCalendarText_(input.category);
  if (!isSupportedCalendarCategory_(category)) {
    throw new Error('La categoría de una fecha especial no es válida.');
  }
  const typeId = normalizeCalendarText_(input.typeId);
  if (typeId && !isSupportedCalendarTypeId_(typeId)) {
    throw new Error('El tipo de enseñanza de una fecha especial no es válido.');
  }
  const startDate = parseCalendarDate_(input.startDate, timeZone, 'la fecha especial', true);
  const endDate = parseCalendarDate_(input.endDate || input.startDate, timeZone, 'el fin de la fecha especial', true);
  return {
    id: normalizeCalendarText_(input.id) || createCalendarRecordId_('FECHA'),
    startDate: startDate,
    endDate: endDate,
    category: category,
    typeId: typeId,
    description: normalizeCalendarText_(input.description),
    priority: CP_CALENDAR_CATEGORIES[category].priority,
  };
}

function persistCalendarConfig_(spreadsheet, config) {
  const supportedTypeIds = CP_CALENDAR_TYPE_DEFINITIONS.map(function(item) { return item.id; });
  const typesSheet = spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_TYPES);
  const evaluationsSheet = spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_EVALUATIONS);
  const datesSheet = spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_DATES);
  const unknownTypeRows = readCalendarTableRows_(typesSheet, CP_CALENDAR_HEADERS.TYPES.length)
    .filter(function(row) { return supportedTypeIds.indexOf(normalizeCalendarText_(row[0])) === -1; });
  const unknownEvaluationRows = readCalendarTableRows_(evaluationsSheet, CP_CALENDAR_HEADERS.EVALUATIONS.length)
    .filter(function(row) { return supportedTypeIds.indexOf(normalizeCalendarText_(row[1])) === -1; });
  const unknownEventRows = readCalendarTableRows_(datesSheet, CP_CALENDAR_HEADERS.DATES.length)
    .filter(function(row) {
      const typeId = normalizeCalendarText_(row[4]);
      return !isSupportedCalendarCategory_(row[3]) || (typeId && !isSupportedCalendarTypeId_(typeId));
    });

  const typeRows = config.types.map(function(type) {
    return [
      type.id, type.name, type.active, type.startDate || '', type.endDate || '',
      type.practicesStart || '', type.practicesEnd || '', type.reviewStart || '', type.reviewEnd || '',
    ];
  }).concat(unknownTypeRows);
  const evaluationRows = config.types.reduce(function(rows, type) {
    return rows.concat(type.evaluations.map(function(evaluation) {
      return [evaluation.id, type.id, evaluation.order, evaluation.name, evaluation.endDate];
    }));
  }, []).concat(unknownEvaluationRows);
  const eventRows = config.events.map(function(event) {
    return [
      event.id, event.startDate, event.endDate, event.category,
      event.typeId, event.description, event.priority,
    ];
  }).concat(unknownEventRows);

  writeCalendarTable_(typesSheet, CP_CALENDAR_HEADERS.TYPES, typeRows, [4, 5, 6, 7, 8, 9]);
  writeCalendarTable_(evaluationsSheet, CP_CALENDAR_HEADERS.EVALUATIONS, evaluationRows, [5]);
  writeCalendarTable_(datesSheet, CP_CALENDAR_HEADERS.DATES, eventRows, [2, 3]);
  hideTechnicalSheets_(spreadsheet);
}

function captureCalendarTableSnapshots_(spreadsheet) {
  return [
    [CP.SHEETS.CALENDAR_TYPES, CP_CALENDAR_HEADERS.TYPES.length],
    [CP.SHEETS.CALENDAR_EVALUATIONS, CP_CALENDAR_HEADERS.EVALUATIONS.length],
    [CP.SHEETS.CALENDAR_DATES, CP_CALENDAR_HEADERS.DATES.length],
  ].map(function(definition) {
    const sheet = spreadsheet.getSheetByName(definition[0]);
    const rowCount = Math.max(1, sheet.getLastRow());
    return {
      sheetName: definition[0],
      width: definition[1],
      values: sheet.getRange(1, 1, rowCount, definition[1]).getValues(),
    };
  });
}

function restoreCalendarTableSnapshots_(spreadsheet, snapshots) {
  snapshots.forEach(function(snapshot) {
    const sheet = spreadsheet.getSheetByName(snapshot.sheetName);
    const rowsToClear = Math.max(sheet.getLastRow(), snapshot.values.length);
    ensureSheetSize_(sheet, rowsToClear, snapshot.width);
    sheet.getRange(1, 1, rowsToClear, snapshot.width).clearContent();
    sheet.getRange(1, 1, snapshot.values.length, snapshot.width).setValues(snapshot.values);
  });
  initializeCalendarTableSheet_(
    spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_TYPES), CP_CALENDAR_HEADERS.TYPES, [4, 5, 6, 7, 8, 9]
  );
  initializeCalendarTableSheet_(
    spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_EVALUATIONS), CP_CALENDAR_HEADERS.EVALUATIONS, [5]
  );
  initializeCalendarTableSheet_(
    spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_DATES), CP_CALENDAR_HEADERS.DATES, [2, 3]
  );
  hideTechnicalSheets_(spreadsheet);
}

function writeCalendarTable_(sheet, headers, rows, dateColumns) {
  const requiredRows = Math.max(2, rows.length + 1);
  ensureSheetSize_(sheet, requiredRows, headers.length);
  const rowsToClear = Math.max(1, sheet.getLastRow() - 1, rows.length);
  sheet.getRange(2, 1, rowsToClear, headers.length).clearContent();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  initializeCalendarTableSheet_(sheet, headers, dateColumns);
}

function readCalendarTableRows_(sheet, width) {
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues().filter(function(row) {
    return row.some(function(value) { return value !== '' && value !== null; });
  });
}

function getConfiguredAcademicYear_(spreadsheet) {
  const academicYear = normalizeConfigValue_(
    getGeneralConfigValues_(spreadsheet)[CP.CONFIG_KEYS.ACADEMIC_YEAR]
  );
  if (!academicYear) {
    throw new Error('Configura primero el curso académico en Datos generales.');
  }
  validateAcademicYear_(academicYear);
  return academicYear;
}

function parseCalendarDate_(value, timeZone, label, required) {
  if (value === '' || value === null || value === undefined) {
    if (required) {
      throw new Error('Indica ' + label + '.');
    }
    return null;
  }
  const dateKey = value instanceof Date && !isNaN(value.getTime())
    ? Utilities.formatDate(value, timeZone, 'yyyy-MM-dd')
    : String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error('El formato de ' + label + ' no es válido.');
  }
  const parsed = Utilities.parseDate(dateKey, timeZone, 'yyyy-MM-dd');
  if (Utilities.formatDate(parsed, timeZone, 'yyyy-MM-dd') !== dateKey) {
    throw new Error('El valor de ' + label + ' no es una fecha válida.');
  }
  return parsed;
}

function formatCalendarDateForUi_(value, timeZone) {
  if (!(value instanceof Date) || isNaN(value.getTime())) {
    return '';
  }
  return Utilities.formatDate(value, timeZone, 'yyyy-MM-dd');
}

function compareCalendarDates_(first, second, timeZone) {
  return getCalendarDateSerial_(first, timeZone) - getCalendarDateSerial_(second, timeZone);
}

function getCalendarDateSerial_(date, timeZone) {
  return Number(Utilities.formatDate(date, timeZone, 'yyyyMMdd'));
}

function validateDateWithinRange_(date, start, end, message, timeZone) {
  if (compareCalendarDates_(date, start, timeZone) < 0 ||
      compareCalendarDates_(date, end, timeZone) > 0) {
    throw new Error(message);
  }
}

function normalizeCalendarBoolean_(value) {
  return value === true || value === 1 || String(value).toUpperCase() === 'TRUE';
}

function normalizeCalendarText_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function isSupportedCalendarTypeId_(typeId) {
  return CP_CALENDAR_TYPE_DEFINITIONS.some(function(definition) {
    return definition.id === normalizeCalendarText_(typeId);
  });
}

function isSupportedCalendarCategory_(category) {
  return Object.prototype.hasOwnProperty.call(
    CP_CALENDAR_CATEGORIES,
    normalizeCalendarText_(category)
  );
}

function createCalendarRecordId_(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
}

function getActiveTeachingTypes_() {
  return getCalendarTeachingTypes_().filter(function(type) { return type.active; });
}

function getTeachingTypeById_(typeId) {
  const normalizedTypeId = normalizeCalendarText_(typeId);
  return getCalendarTeachingTypes_().find(function(type) {
    return type.id === normalizedTypeId;
  }) || null;
}

function getCalendarTeachingTypes_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_TYPES);
  if (!sheet) {
    return [];
  }
  return readCalendarTableRows_(sheet, CP_CALENDAR_HEADERS.TYPES.length).map(function(row) {
    return {
      id: normalizeCalendarText_(row[0]),
      name: normalizeCalendarText_(row[1]),
      active: normalizeCalendarBoolean_(row[2]),
      startDate: row[3] instanceof Date ? row[3] : null,
      endDate: row[4] instanceof Date ? row[4] : null,
      practicesStart: row[5] instanceof Date ? row[5] : null,
      practicesEnd: row[6] instanceof Date ? row[6] : null,
      reviewStart: row[7] instanceof Date ? row[7] : null,
      reviewEnd: row[8] instanceof Date ? row[8] : null,
    };
  });
}

function getEvaluationsForType_(typeId) {
  const normalizedTypeId = normalizeCalendarText_(typeId);
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_EVALUATIONS);
  if (!sheet) {
    return [];
  }
  return readCalendarTableRows_(sheet, CP_CALENDAR_HEADERS.EVALUATIONS.length)
    .filter(function(row) { return normalizeCalendarText_(row[1]) === normalizedTypeId; })
    .map(function(row) {
      return {
        id: normalizeCalendarText_(row[0]),
        typeId: normalizedTypeId,
        order: Number(row[2]),
        name: normalizeCalendarText_(row[3]),
        endDate: row[4] instanceof Date ? row[4] : null,
      };
    }).sort(function(first, second) { return first.order - second.order; });
}

function getCalendarEventsForDate_(date, typeId) {
  return getCalendarEventsBetween_(date, date, typeId);
}

function getCalendarEventsBetween_(startDate, endDate, typeId) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const timeZone = spreadsheet.getSpreadsheetTimeZone();
  const normalizedStart = parseCalendarDate_(startDate, timeZone, 'la fecha inicial de consulta', true);
  const normalizedEnd = parseCalendarDate_(endDate, timeZone, 'la fecha final de consulta', true);
  if (compareCalendarDates_(normalizedStart, normalizedEnd, timeZone) > 0) {
    throw new Error('El intervalo de consulta de eventos no es válido.');
  }
  const normalizedTypeId = normalizeCalendarText_(typeId);
  if (normalizedTypeId && !isSupportedCalendarTypeId_(normalizedTypeId)) {
    throw new Error('El tipo de enseñanza consultado no es válido.');
  }
  const sheet = spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_DATES);
  if (!sheet) {
    return [];
  }
  return readCalendarTableRows_(sheet, CP_CALENDAR_HEADERS.DATES.length)
    .filter(function(row) {
      const eventTypeId = normalizeCalendarText_(row[4]);
      const eventStart = row[1];
      const eventEnd = row[2];
      return isSupportedCalendarCategory_(row[3]) &&
        eventStart instanceof Date && eventEnd instanceof Date &&
        (!eventTypeId || eventTypeId === normalizedTypeId) &&
        compareCalendarDates_(eventStart, normalizedEnd, timeZone) <= 0 &&
        compareCalendarDates_(eventEnd, normalizedStart, timeZone) >= 0;
    }).map(function(row) {
      const category = normalizeCalendarText_(row[3]);
      return {
        id: normalizeCalendarText_(row[0]),
        startDate: row[1],
        endDate: row[2],
        category: category,
        typeId: normalizeCalendarText_(row[4]),
        description: normalizeCalendarText_(row[5]),
        priority: Number(row[6]) || CP_CALENDAR_CATEGORIES[category].priority,
      };
    });
}

function getDominantCalendarEvent_(date, typeId) {
  const events = getCalendarEventsForDate_(date, typeId).slice();
  events.sort(function(first, second) {
    return first.priority - second.priority;
  });
  return events.length ? events[0] : null;
}

function isNonTeachingDate_(date, typeId) {
  if (isWeekend_(date)) {
    return true;
  }
  return getCalendarEventsForDate_(date, typeId).some(function(event) {
    const category = CP_CALENDAR_CATEGORIES[event.category];
    return category && category.nonTeaching;
  });
}

function isWeekend_(date) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const timeZone = spreadsheet.getSpreadsheetTimeZone();
  const normalizedDate = parseCalendarDate_(date, timeZone, 'la fecha', true);
  const parts = Utilities.formatDate(normalizedDate, timeZone, 'yyyy-MM-dd').split('-');
  const day = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))).getUTCDay();
  return day === 0 || day === 6;
}
