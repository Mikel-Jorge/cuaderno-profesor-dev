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
    'descripcion', 'prioridad',
  ]),
  DATE_TYPES: Object.freeze([
    'fecha_id', 'tipo_id',
  ]),
});

const CP_CALENDAR_LEGACY_DATE_HEADERS = Object.freeze([
  'fecha_id', 'fecha_inicio', 'fecha_fin', 'categoria',
  'tipo_id', 'descripcion', 'prioridad',
]);

function initializeCalendarStructure_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const typesSheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.CALENDAR_TYPES);
  const evaluationsSheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.CALENDAR_EVALUATIONS);
  const datesSheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.CALENDAR_DATES);
  const dateTypesSheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.CALENDAR_DATE_TYPES);

  initializeCalendarTypesSheet_(typesSheet);
  initializeCalendarTableSheet_(evaluationsSheet, CP_CALENDAR_HEADERS.EVALUATIONS, [5]);
  migrateCalendarDateScopeModel_(datesSheet, dateTypesSheet);

  typesSheet.hideSheet();
  evaluationsSheet.hideSheet();
  datesSheet.hideSheet();
  dateTypesSheet.hideSheet();
}

function migrateCalendarDateScopeModel_(datesSheet, dateTypesSheet) {
  const migrationSnapshots = [
    captureCalendarMigrationSheet_(datesSheet, CP_CALENDAR_LEGACY_DATE_HEADERS.length),
    captureCalendarMigrationSheet_(dateTypesSheet, CP_CALENDAR_HEADERS.DATE_TYPES.length),
  ];
  try {
    const legacyWidth = CP_CALENDAR_LEGACY_DATE_HEADERS.length;
    const existingHeader = datesSheet.getLastRow() > 0
      ? datesSheet.getRange(1, 1, 1, Math.min(legacyWidth, datesSheet.getMaxColumns())).getValues()[0]
        .map(normalizeCalendarText_)
      : [];
    const isLegacy = CP_CALENDAR_LEGACY_DATE_HEADERS.every(function(header, index) {
      return existingHeader[index] === header;
    });

    initializeCalendarTableSheet_(dateTypesSheet, CP_CALENDAR_HEADERS.DATE_TYPES, []);
    let relationRows = deduplicateCalendarDateTypeRows_(
      readCalendarTableRows_(dateTypesSheet, CP_CALENDAR_HEADERS.DATE_TYPES.length)
    );

    if (isLegacy) {
      const legacyRows = readCalendarTableRows_(datesSheet, legacyWidth);
      const migratedDateRows = legacyRows.map(function(row) {
        const dateId = normalizeCalendarText_(row[0]);
        const typeId = normalizeCalendarText_(row[4]);
        if (dateId && isSupportedCalendarTypeId_(typeId)) {
          relationRows.push([dateId, typeId]);
        }
        return [row[0], row[1], row[2], row[3], row[5], row[6]];
      });
      writeCalendarTable_(datesSheet, CP_CALENDAR_HEADERS.DATES, migratedDateRows, [2, 3]);
      if (datesSheet.getMaxColumns() >= legacyWidth) {
        datesSheet.getRange(1, legacyWidth, datesSheet.getMaxRows(), 1).clearContent();
      }
    } else {
      initializeCalendarTableSheet_(datesSheet, CP_CALENDAR_HEADERS.DATES, [2, 3]);
    }

    const validDateIds = readCalendarTableRows_(datesSheet, CP_CALENDAR_HEADERS.DATES.length)
      .reduce(function(map, row) {
        const dateId = normalizeCalendarText_(row[0]);
        if (dateId) {
          map[dateId] = true;
        }
        return map;
      }, {});
    relationRows = deduplicateCalendarDateTypeRows_(relationRows).filter(function(row) {
      return validDateIds[normalizeCalendarText_(row[0])] &&
        isSupportedCalendarTypeId_(normalizeCalendarText_(row[1]));
    });
    writeCalendarTable_(dateTypesSheet, CP_CALENDAR_HEADERS.DATE_TYPES, relationRows, []);
  } catch (error) {
    migrationSnapshots.forEach(restoreCalendarMigrationSheet_);
    throw error;
  }
}

function captureCalendarMigrationSheet_(sheet, width) {
  const rowCount = Math.max(1, sheet.getLastRow());
  ensureSheetSize_(sheet, rowCount, width);
  return {
    sheet: sheet,
    width: width,
    values: sheet.getRange(1, 1, rowCount, width).getValues(),
  };
}

function restoreCalendarMigrationSheet_(snapshot) {
  const sheet = snapshot.sheet;
  const rowsToClear = Math.max(1, sheet.getLastRow(), snapshot.values.length);
  ensureSheetSize_(sheet, rowsToClear, snapshot.width);
  sheet.getRange(1, 1, rowsToClear, snapshot.width).clearContent();
  sheet.getRange(1, 1, snapshot.values.length, snapshot.width).setValues(snapshot.values);
}

function deduplicateCalendarDateTypeRows_(rows) {
  const seen = {};
  return rows.filter(function(row) {
    const dateId = normalizeCalendarText_(row[0]);
    const typeId = normalizeCalendarText_(row[1]);
    const key = dateId + '\n' + typeId;
    if (!dateId || !typeId || seen[key]) {
      return false;
    }
    seen[key] = true;
    return true;
  }).map(function(row) {
    return [normalizeCalendarText_(row[0]), normalizeCalendarText_(row[1])];
  });
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
          configurePractices: false,
          reviewStart: '',
          reviewEnd: '',
          configureReview: false,
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
  const dateTypeRows = readCalendarTableRows_(
    spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_DATE_TYPES),
    CP_CALENDAR_HEADERS.DATE_TYPES.length
  );
  const typeIdsByDateId = dateTypeRows.reduce(function(map, row) {
    const dateId = normalizeCalendarText_(row[0]);
    const typeId = normalizeCalendarText_(row[1]);
    if (dateId && isSupportedCalendarTypeId_(typeId)) {
      map[dateId] = map[dateId] || [];
      if (map[dateId].indexOf(typeId) === -1) {
        map[dateId].push(typeId);
      }
    }
    return map;
  }, {});

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
        configurePractices: Boolean(row[5] || row[6]),
        reviewStart: formatCalendarDateForUi_(row[7], timeZone),
        reviewEnd: formatCalendarDateForUi_(row[8], timeZone),
        configureReview: Boolean(row[7] || row[8]),
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
      return isSupportedCalendarCategory_(row[3]);
    }).map(function(row) {
      const dateId = normalizeCalendarText_(row[0]);
      const startDate = formatCalendarDateForUi_(row[1], timeZone);
      const endDate = formatCalendarDateForUi_(row[2], timeZone);
      const typeIds = typeIdsByDateId[dateId] || [];
      return {
        id: dateId,
        startDate: startDate,
        endDate: endDate,
        isRange: Boolean(startDate && endDate && startDate !== endDate),
        category: normalizeCalendarText_(row[3]),
        appliesToAll: typeIds.length === 0,
        typeIds: typeIds,
        description: normalizeCalendarText_(row[4]),
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
  const configurePractices = input.configurePractices === undefined
    ? Boolean(input.practicesStart || input.practicesEnd)
    : input.configurePractices === true;
  const configureReview = input.configureReview === undefined
    ? Boolean(input.reviewStart || input.reviewEnd)
    : input.configureReview === true;
  return {
    id: definition.id,
    name: definition.name,
    active: input.active === true,
    startDate: parseCalendarDate_(input.startDate, timeZone, 'la fecha de inicio', false),
    endDate: parseCalendarDate_(input.endDate, timeZone, 'la fecha de fin', false),
    practicesStart: configurePractices
      ? parseCalendarDate_(input.practicesStart, timeZone, 'el inicio de prácticas', false) : null,
    practicesEnd: configurePractices
      ? parseCalendarDate_(input.practicesEnd, timeZone, 'el fin de prácticas', false) : null,
    configurePractices: configurePractices,
    reviewStart: configureReview
      ? parseCalendarDate_(input.reviewStart, timeZone, 'el inicio de repaso', false) : null,
    reviewEnd: configureReview
      ? parseCalendarDate_(input.reviewEnd, timeZone, 'el fin de repaso', false) : null,
    configureReview: configureReview,
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
  const appliesToAll = input.appliesToAll === true;
  const inputTypeIds = Array.isArray(input.typeIds) ? input.typeIds : [];
  const typeIds = inputTypeIds.map(normalizeCalendarText_).filter(function(typeId, index, values) {
    return typeId && values.indexOf(typeId) === index;
  });
  if (typeIds.some(function(typeId) { return !isSupportedCalendarTypeId_(typeId); })) {
    throw new Error('Uno de los tipos de enseñanza de una fecha especial no es válido.');
  }
  if (!appliesToAll && typeIds.length === 0) {
    throw new Error('Selecciona Todos o al menos un tipo para cada fecha especial.');
  }
  const startDate = parseCalendarDate_(input.startDate, timeZone, 'la fecha especial', true);
  const isRange = input.isRange === true;
  const endDate = isRange
    ? parseCalendarDate_(input.endDate, timeZone, 'el fin de la fecha especial', true)
    : startDate;
  return {
    id: normalizeCalendarText_(input.id) || createCalendarRecordId_('FECHA'),
    startDate: startDate,
    endDate: endDate,
    category: category,
    typeIds: appliesToAll ? [] : typeIds,
    description: normalizeCalendarText_(input.description),
    priority: CP_CALENDAR_CATEGORIES[category].priority,
  };
}

function persistCalendarConfig_(spreadsheet, config) {
  const supportedTypeIds = CP_CALENDAR_TYPE_DEFINITIONS.map(function(item) { return item.id; });
  const typesSheet = spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_TYPES);
  const evaluationsSheet = spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_EVALUATIONS);
  const datesSheet = spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_DATES);
  const dateTypesSheet = spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_DATE_TYPES);
  const unknownTypeRows = readCalendarTableRows_(typesSheet, CP_CALENDAR_HEADERS.TYPES.length)
    .filter(function(row) { return supportedTypeIds.indexOf(normalizeCalendarText_(row[0])) === -1; });
  const unknownEvaluationRows = readCalendarTableRows_(evaluationsSheet, CP_CALENDAR_HEADERS.EVALUATIONS.length)
    .filter(function(row) { return supportedTypeIds.indexOf(normalizeCalendarText_(row[1])) === -1; });
  const unknownEventRows = readCalendarTableRows_(datesSheet, CP_CALENDAR_HEADERS.DATES.length)
    .filter(function(row) {
      return !isSupportedCalendarCategory_(row[3]);
    });
  const managedExistingEventIds = readCalendarTableRows_(datesSheet, CP_CALENDAR_HEADERS.DATES.length)
    .reduce(function(map, row) {
      if (isSupportedCalendarCategory_(row[3])) {
        map[normalizeCalendarText_(row[0])] = true;
      }
      return map;
    }, {});
  const preservedRelationRows = readCalendarTableRows_(dateTypesSheet, CP_CALENDAR_HEADERS.DATE_TYPES.length)
    .filter(function(row) { return !managedExistingEventIds[normalizeCalendarText_(row[0])]; });

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
      event.description, event.priority,
    ];
  }).concat(unknownEventRows);
  const dateTypeRows = config.events.reduce(function(rows, event) {
    return rows.concat(event.typeIds.map(function(typeId) {
      return [event.id, typeId];
    }));
  }, []).concat(preservedRelationRows);

  writeCalendarTable_(typesSheet, CP_CALENDAR_HEADERS.TYPES, typeRows, [4, 5, 6, 7, 8, 9]);
  writeCalendarTable_(evaluationsSheet, CP_CALENDAR_HEADERS.EVALUATIONS, evaluationRows, [5]);
  writeCalendarTable_(datesSheet, CP_CALENDAR_HEADERS.DATES, eventRows, [2, 3]);
  writeCalendarTable_(
    dateTypesSheet,
    CP_CALENDAR_HEADERS.DATE_TYPES,
    deduplicateCalendarDateTypeRows_(dateTypeRows),
    []
  );
  hideTechnicalSheets_(spreadsheet);
}

function captureCalendarTableSnapshots_(spreadsheet) {
  return [
    [CP.SHEETS.CALENDAR_TYPES, CP_CALENDAR_HEADERS.TYPES.length],
    [CP.SHEETS.CALENDAR_EVALUATIONS, CP_CALENDAR_HEADERS.EVALUATIONS.length],
    [CP.SHEETS.CALENDAR_DATES, CP_CALENDAR_HEADERS.DATES.length],
    [CP.SHEETS.CALENDAR_DATE_TYPES, CP_CALENDAR_HEADERS.DATE_TYPES.length],
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
  initializeCalendarTableSheet_(
    spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_DATE_TYPES), CP_CALENDAR_HEADERS.DATE_TYPES, []
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
  const dateTypesSheet = spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_DATE_TYPES);
  const typeIdsByDateId = readCalendarTableRows_(dateTypesSheet, CP_CALENDAR_HEADERS.DATE_TYPES.length)
    .reduce(function(map, row) {
      const dateId = normalizeCalendarText_(row[0]);
      const relatedTypeId = normalizeCalendarText_(row[1]);
      if (dateId && isSupportedCalendarTypeId_(relatedTypeId)) {
        map[dateId] = map[dateId] || {};
        map[dateId][relatedTypeId] = true;
      }
      return map;
    }, {});
  return readCalendarTableRows_(sheet, CP_CALENDAR_HEADERS.DATES.length)
    .filter(function(row) {
      const dateId = normalizeCalendarText_(row[0]);
      const relatedTypeIds = typeIdsByDateId[dateId] || {};
      const hasRelations = Object.keys(relatedTypeIds).length > 0;
      const eventStart = row[1];
      const eventEnd = row[2];
      return isSupportedCalendarCategory_(row[3]) &&
        eventStart instanceof Date && eventEnd instanceof Date &&
        (!hasRelations || Boolean(normalizedTypeId && relatedTypeIds[normalizedTypeId])) &&
        compareCalendarDates_(eventStart, normalizedEnd, timeZone) <= 0 &&
        compareCalendarDates_(eventEnd, normalizedStart, timeZone) >= 0;
    }).map(function(row) {
      const category = normalizeCalendarText_(row[3]);
      return {
        id: normalizeCalendarText_(row[0]),
        startDate: row[1],
        endDate: row[2],
        category: category,
        typeIds: Object.keys(typeIdsByDateId[normalizeCalendarText_(row[0])] || {}),
        description: normalizeCalendarText_(row[4]),
        priority: Number(row[5]) || CP_CALENDAR_CATEGORIES[category].priority,
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
