const CP_CALENDAR_TYPE_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 'FP1', name: '1º' }),
  Object.freeze({ id: 'FP2', name: '2º' }),
  Object.freeze({ id: 'ONLINE', name: 'Online' }),
  Object.freeze({ id: 'CE', name: 'Curso de Especialización' }),
]);

const CP_CALENDAR_CATEGORIES = Object.freeze({
  FESTIVO: Object.freeze({ label: 'Festivo / no lectivo', priority: 10, nonTeaching: true }),
  REUNION: Object.freeze({ label: 'Reunión', priority: 20, nonTeaching: false }),
  DESTACADO: Object.freeze({ label: 'Destacado', priority: 30, nonTeaching: false }),
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
        return [row[0], row[1], row[2], normalizeCalendarCategory_(row[3]), row[5], row[6]];
      });
      writeCalendarTable_(datesSheet, CP_CALENDAR_HEADERS.DATES, migratedDateRows, [2, 3]);
      if (datesSheet.getMaxColumns() >= legacyWidth) {
        datesSheet.getRange(1, legacyWidth, datesSheet.getMaxRows(), 1).clearContent();
      }
    } else {
      initializeCalendarTableSheet_(datesSheet, CP_CALENDAR_HEADERS.DATES, [2, 3]);
    }

    const normalizedDateRows = readCalendarTableRows_(datesSheet, CP_CALENDAR_HEADERS.DATES.length)
      .map(function(row) {
        row[3] = normalizeCalendarCategory_(row[3]);
        row[5] = CP_CALENDAR_CATEGORIES[row[3]]
          ? CP_CALENDAR_CATEGORIES[row[3]].priority
          : row[5];
        return row;
      });
    writeCalendarTable_(datesSheet, CP_CALENDAR_HEADERS.DATES, normalizedDateRows, [2, 3]);

    const validDateIds = normalizedDateRows
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

  createOrRepairCalendarSheet_();
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
        category: normalizeCalendarCategory_(row[3]),
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
  const category = normalizeCalendarCategory_(input.category);
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

function normalizeCalendarCategory_(category) {
  const normalized = normalizeCalendarText_(category);
  if (normalized === 'VACACIONES' || normalized === 'NO_LECTIVO') {
    return 'FESTIVO';
  }
  return normalized;
}

function isSupportedCalendarTypeId_(typeId) {
  return CP_CALENDAR_TYPE_DEFINITIONS.some(function(definition) {
    return definition.id === normalizeCalendarText_(typeId);
  });
}

function isSupportedCalendarCategory_(category) {
  return Object.prototype.hasOwnProperty.call(
    CP_CALENDAR_CATEGORIES,
    normalizeCalendarCategory_(category)
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
      const category = normalizeCalendarCategory_(row[3]);
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

const CP_CALENDAR_MONTH_NAMES = Object.freeze([
  'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Enero',
  'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
]);

const CP_CALENDAR_WEEKDAY_LABELS = Object.freeze(['L', 'M', 'X', 'J', 'V', 'S', 'D']);

const CP_CALENDAR_STYLE_KEYS = Object.freeze({
  FESTIVO: 'festivo',
  EVALUATION_END: 'evaluationEnd',
  REUNION: 'reunion',
  DESTACADO: 'destacado',
  PRACTICAS: 'practicas',
  REPASO: 'repaso',
  HOY: 'hoy',
  WEEKEND: 'weekend',
  OUTSIDE_ACTIVE_TYPES: 'outsideActiveTypes',
  NORMAL: 'normal',
});

const CP_CALENDAR_SEMANTIC_COLORS = Object.freeze({
  EVALUATION_END: '#CCFBF1',
});

function actualizarCalendario_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  initializeCalendarStructure_();
  const sheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.CALENDAR);
  moveCalendarSheetAfterCover_(spreadsheet, sheet);
  let model;
  try {
    model = buildCalendarRenderModel_(spreadsheet);
  } catch (error) {
    renderCalendarUnavailableSheet_(sheet, spreadsheet, error && error.message
      ? error.message
      : 'No se ha podido generar el calendario visible.');
    actualizarIndicePortada();
    spreadsheet.toast('Calendario pendiente de configuración.', CP.PROJECT_NAME, 4);
    return;
  }
  renderCalendarSheet_(sheet, model);
  actualizarIndicePortada();
  spreadsheet.toast('Calendario actualizado.', CP.PROJECT_NAME, 4);
}

function createOrRepairCalendarSheet_() {
  actualizarCalendario_();
}

function buildCalendarRenderModel_(spreadsheet) {
  const academicYear = getConfiguredAcademicYear_(spreadsheet);
  const timeZone = spreadsheet.getSpreadsheetTimeZone();
  const bounds = getAcademicYearBounds_(academicYear, timeZone);
  const theme = getActiveTheme_(spreadsheet);
  const types = getCalendarTeachingTypes_();
  const activeTypes = types.filter(function(type) {
    return type.active && type.startDate instanceof Date && type.endDate instanceof Date;
  });
  const events = getAllCalendarEvents_();
  const evaluationsByTypeId = activeTypes.reduce(function(map, type) {
    map[type.id] = getEvaluationPeriodsForType_(type, timeZone);
    return map;
  }, {});
  const today = parseCalendarDate_(new Date(), timeZone, 'hoy', true);
  const styles = getCalendarSemanticStyles_(theme);
  const stats = activeTypes.reduce(function(items, type) {
    return items.concat(calculateEvaluationStatsForType_(type, evaluationsByTypeId[type.id], events, today, timeZone));
  }, []);

  return {
    spreadsheet: spreadsheet,
    academicYear: academicYear,
    timeZone: timeZone,
    bounds: bounds,
    theme: theme,
    styles: styles,
    types: types,
    activeTypes: activeTypes,
    activeTypeIds: activeTypes.map(function(type) { return type.id; }),
    events: events,
    evaluationsByTypeId: evaluationsByTypeId,
    today: today,
    todaySerial: getCalendarDateSerial_(today, timeZone),
    stats: stats,
  };
}

function renderCalendarSheet_(sheet, model) {
  const layout = getCalendarSheetLayout_(model);
  ensureSheetSize_(sheet, layout.rows, layout.columns);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  const canvas = sheet.getRange(1, 1, layout.rows, layout.columns);
  canvas.clear();
  canvas
    .setFontFamily('Arial')
    .setFontSize(8)
    .setVerticalAlignment('middle')
    .setWrap(false)
    .setBackground(model.theme.colors.background)
    .setFontColor(model.theme.colors.text);

  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(0);
  sheet.setFrozenColumns(0);
  sheet.setTabColor(model.theme.colors.primary);
  applyCalendarDimensions_(sheet, layout);
  renderCalendarHeader_(sheet, model, layout);

  if (!model.activeTypes.length) {
    renderCalendarNoActiveTypes_(sheet, model, layout);
    trimSheetToBounds_(sheet, 8, layout.columns);
    return;
  }

  renderCalendarLegend_(sheet, model, layout);
  renderCalendarMonths_(sheet, model, layout);
  renderCalendarStats_(sheet, model, layout);
  trimSheetToBounds_(sheet, layout.rows, layout.columns);
}

function renderCalendarUnavailableSheet_(sheet, spreadsheet, message) {
  const theme = getActiveTheme_(spreadsheet);
  const columns = 39;
  const rows = 8;
  ensureSheetSize_(sheet, rows, columns);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.getRange(1, 1, rows, columns)
    .clear()
    .setFontFamily('Arial')
    .setVerticalAlignment('middle')
    .setWrap(false)
    .setBackground(theme.colors.background)
    .setFontColor(theme.colors.text);
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(0);
  sheet.setFrozenColumns(0);
  sheet.setTabColor(theme.colors.primary);
  for (let column = 1; column <= columns; column += 1) {
    sheet.setColumnWidth(column, [8, 16, 24, 32].indexOf(column) !== -1 ? 10 : 31);
  }
  sheet.setRowHeights(1, rows, 24);
  setMergedRangeValue_(sheet.getRange(1, 1, 1, columns), 'CALENDARIO ESCOLAR')
    .setBackground(theme.colors.primary)
    .setFontColor(theme.colors.onPrimary)
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  setMergedRangeValue_(sheet.getRange(3, 1, 3, columns), message)
    .setBackground(theme.colors.surface)
    .setFontColor(theme.colors.mutedText)
    .setFontSize(12)
    .setHorizontalAlignment('center');
  trimSheetToBounds_(sheet, rows, columns);
}

function getCalendarSheetLayout_(model) {
  const monthRows = 8;
  const monthColumns = 7;
  const monthGapRows = 1;
  const monthGapColumns = 1;
  const firstMonthColumn = 1;
  const legendRow = 5;
  const firstMonthRow = legendRow + 2;
  const monthBlockRows = (monthRows * 2) + monthGapRows;
  const statsRow = firstMonthRow + monthBlockRows + 1;
  const statsRows = (model.stats.length ? model.stats.length : 1) + 2;
  return {
    rows: statsRow + statsRows - 1,
    columns: 39,
    firstMonthRow: firstMonthRow,
    firstMonthColumn: firstMonthColumn,
    monthRows: monthRows,
    monthColumns: monthColumns,
    monthGapRows: monthGapRows,
    monthGapColumns: monthGapColumns,
    legendRow: legendRow,
    statsRow: statsRow,
  };
}

function applyCalendarDimensions_(sheet, layout) {
  for (let column = 1; column <= layout.columns; column += 1) {
    sheet.setColumnWidth(column, [8, 16, 24, 32].indexOf(column) !== -1 ? 10 : 31);
  }
  sheet.setRowHeights(1, layout.rows, 22);
  sheet.setRowHeight(1, 30);
  sheet.setRowHeight(2, 24);
  for (let monthBlock = 0; monthBlock < 2; monthBlock += 1) {
    const startRow = layout.firstMonthRow + monthBlock * (layout.monthRows + layout.monthGapRows);
    sheet.setRowHeight(startRow, 22);
    sheet.setRowHeight(startRow + 1, 18);
    sheet.setRowHeights(startRow + 2, 6, 31);
  }
}

function renderCalendarHeader_(sheet, model, layout) {
  const colors = model.theme.colors;
  setMergedRangeValue_(sheet.getRange(1, 1, 1, layout.columns), 'CALENDARIO ESCOLAR')
    .setBackground(colors.primary)
    .setFontColor(colors.onPrimary)
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  setMergedRangeValue_(sheet.getRange(2, 1, 1, layout.columns), 'Curso ' + model.academicYear)
    .setBackground(colors.secondary)
    .setFontColor(colors.onSecondary)
    .setFontSize(12)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  const activeSummary = model.activeTypes.length
    ? model.activeTypes.map(function(type) { return type.name; }).join(' · ')
    : 'Sin tipos activos configurados';
  setMergedRangeValue_(sheet.getRange(3, 1, 1, layout.columns), activeSummary)
    .setBackground(colors.surface)
    .setFontColor(colors.mutedText)
    .setHorizontalAlignment('center');
}

function renderCalendarNoActiveTypes_(sheet, model, layout) {
  setMergedRangeValue_(
    sheet.getRange(5, 1, 3, layout.columns),
    'No hay tipos de enseñanza activos con fechas válidas. Configura al menos un tipo para generar el calendario visible.'
  )
    .setBackground(model.theme.colors.surface)
    .setFontColor(model.theme.colors.mutedText)
    .setFontSize(12)
    .setHorizontalAlignment('center');
}

function renderCalendarMonths_(sheet, model, layout) {
  const academicStartYear = Number(model.academicYear.split('-')[0]);
  for (let monthIndex = 0; monthIndex < 10; monthIndex += 1) {
    const gridRow = Math.floor(monthIndex / 5);
    const gridColumn = monthIndex % 5;
    const startRow = layout.firstMonthRow + gridRow * (layout.monthRows + layout.monthGapRows);
    const startColumn = layout.firstMonthColumn + gridColumn * (layout.monthColumns + layout.monthGapColumns);
    const monthNumber = monthIndex < 4 ? monthIndex + 8 : monthIndex - 4;
    const year = monthIndex < 4 ? academicStartYear : academicStartYear + 1;
    renderSingleCalendarMonth_(sheet, model, startRow, startColumn, year, monthNumber, monthIndex);
  }
}

function renderSingleCalendarMonth_(sheet, model, startRow, startColumn, year, monthNumber, monthIndex) {
  const colors = model.theme.colors;
  setMergedRangeValue_(
    sheet.getRange(startRow, startColumn, 1, 7),
    CP_CALENDAR_MONTH_NAMES[monthIndex] + ' ' + year
  )
    .setBackground(colors.primary)
    .setFontColor(colors.onPrimary)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sheet.getRange(startRow + 1, startColumn, 1, 7)
    .setValues([CP_CALENDAR_WEEKDAY_LABELS])
    .setBackground(colors.muted)
    .setFontColor(colors.text)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setWrap(false);

  const values = [];
  const backgrounds = [];
  const fontColors = [];
  const fontWeights = [];
  const fontLines = [];
  const notes = [];
  const firstDay = new Date(year, monthNumber, 1, 12, 0, 0);
  const leadingBlankDays = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthNumber + 1, 0).getDate();

  for (let week = 0; week < 6; week += 1) {
    const valueRow = [];
    const backgroundRow = [];
    const fontColorRow = [];
    const fontWeightRow = [];
    const fontLineRow = [];
    const noteRow = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const dayNumber = week * 7 + weekday - leadingBlankDays + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        valueRow.push('');
        backgroundRow.push(model.theme.colors.background);
        fontColorRow.push(model.theme.colors.mutedText);
        fontWeightRow.push('normal');
        fontLineRow.push('none');
        noteRow.push('');
        continue;
      }
      const date = new Date(year, monthNumber, dayNumber, 12, 0, 0);
      const state = getCalendarVisualStateForDate_(date, model);
      valueRow.push(dayNumber);
      backgroundRow.push(state.background);
      fontColorRow.push(state.fontColor);
      fontWeightRow.push(state.isToday ? 'bold' : 'normal');
      fontLineRow.push(state.isPast && !state.isToday ? 'line-through' : 'none');
      noteRow.push(state.note);
    }
    values.push(valueRow);
    backgrounds.push(backgroundRow);
    fontColors.push(fontColorRow);
    fontWeights.push(fontWeightRow);
    fontLines.push(fontLineRow);
    notes.push(noteRow);
  }

  const daysRange = sheet.getRange(startRow + 2, startColumn, 6, 7);
  daysRange
    .setValues(values)
    .setBackgrounds(backgrounds)
    .setFontColors(fontColors)
    .setFontWeights(fontWeights)
    .setFontLines(fontLines)
    .setNotes(notes)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(false)
    .setBorder(true, true, true, true, true, true, colors.border, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(startRow, startColumn, 8, 7)
    .setBorder(true, true, true, true, false, false, colors.border, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

function getCalendarVisualStateForDate_(date, model) {
  const serial = getCalendarDateSerial_(date, model.timeZone);
  const isToday = serial === model.todaySerial;
  const isPast = serial < model.todaySerial;
  const event = getDominantCalendarEventForTypeIds_(date, model.activeTypeIds, model.events, model.timeZone);
  const weekend = isWeekendDate_(date);
  const evaluationEnd = getEvaluationEndNotesForDate_(date, model).length > 0;
  const practiceMilestone = getPracticeMilestonesForDate_(date, model.activeTypes, model.timeZone).length > 0;
  const inReview = !weekend && isDateInAnyTeachingTypeRange_(date, model.activeTypes, 'reviewStart', 'reviewEnd', model.timeZone);
  const inActiveTypePeriod = isDateInAnyTeachingTypeRange_(date, model.activeTypes, 'startDate', 'endDate', model.timeZone);
  let styleKey = CP_CALENDAR_STYLE_KEYS.NORMAL;

  if (weekend || (event && event.category === 'FESTIVO')) {
    styleKey = CP_CALENDAR_STYLE_KEYS.WEEKEND;
  } else if (evaluationEnd) {
    styleKey = CP_CALENDAR_STYLE_KEYS.EVALUATION_END;
  } else if (event && (event.category === 'REUNION' || event.category === 'DESTACADO')) {
    styleKey = event.category;
  } else if (practiceMilestone) {
    styleKey = CP_CALENDAR_STYLE_KEYS.PRACTICAS;
  } else if (inReview) {
    styleKey = CP_CALENDAR_STYLE_KEYS.REPASO;
  } else if (!inActiveTypePeriod) {
    styleKey = CP_CALENDAR_STYLE_KEYS.OUTSIDE_ACTIVE_TYPES;
  }

  if (isToday) {
    styleKey = CP_CALENDAR_STYLE_KEYS.HOY;
  }

  const style = model.styles[styleKey] || model.styles.normal;
  return {
    background: style.background,
    fontColor: style.fontColor,
    isToday: isToday,
    isPast: isPast,
    note: buildCalendarDayNote_(date, model),
  };
}

function getCalendarSemanticStyles_(theme) {
  const colors = theme.colors;
  const styles = {};
  styles.FESTIVO = { label: 'Festivo / no lectivo', background: colors.muted, fontColor: colors.mutedText };
  styles.evaluationEnd = {
    label: 'Fin de evaluación',
    background: CP_CALENDAR_SEMANTIC_COLORS.EVALUATION_END,
    fontColor: colors.text,
  };
  styles.REUNION = { label: 'Reunión', background: '#E0E7FF', fontColor: colors.text };
  styles.DESTACADO = { label: 'Destacado', background: '#FEF3C7', fontColor: colors.text };
  styles.practicas = { label: 'Inicio/fin prácticas', background: '#DBEAFE', fontColor: colors.text };
  styles.repaso = { label: 'Repaso', background: '#FCE7F3', fontColor: colors.text };
  styles.hoy = { label: 'Hoy', background: '#00A6B2', fontColor: getAccessibleTextColor_('#00A6B2') };
  styles.weekend = { label: 'Festivo / no lectivo', background: colors.muted, fontColor: colors.mutedText };
  styles.outsideActiveTypes = { label: 'Fuera de periodo', background: colors.surface, fontColor: colors.mutedText };
  styles.normal = { label: 'Día lectivo', background: colors.surface, fontColor: colors.text };
  return styles;
}

function renderCalendarLegend_(sheet, model, layout) {
  const legendItems = getCalendarLegendItems_(model);
  const rowRange = sheet.getRange(layout.legendRow, 1, 1, layout.columns);
  rowRange
    .setBackground(model.theme.colors.background)
    .setFontColor(model.theme.colors.text)
    .setFontWeight('bold')
    .setVerticalAlignment('middle')
    .setWrap(false)
    .setBorder(true, true, true, true, false, false, model.theme.colors.border, SpreadsheetApp.BorderStyle.SOLID);
  setMergedRangeValue_(sheet.getRange(layout.legendRow, 1, 1, 2), 'LEYENDA')
    .setBackground(model.theme.colors.primary)
    .setFontColor(model.theme.colors.onPrimary)
    .setHorizontalAlignment('center');
  legendItems.forEach(function(item, index) {
    const startColumn = 3 + index * 5;
    if (startColumn + 3 > layout.columns) return;
    sheet.getRange(layout.legendRow, startColumn)
      .setBackground(item.background)
      .setFontColor(item.fontColor);
    setMergedRangeValue_(sheet.getRange(layout.legendRow, startColumn + 1, 1, 3), item.label)
      .setBackground(model.theme.colors.background)
      .setFontColor(model.theme.colors.text)
      .setHorizontalAlignment('left');
  });
}

function getCalendarLegendItems_(model) {
  const categoriesInUse = model.events.reduce(function(map, event) {
    if (eventAppliesToAnyTypeId_(event, model.activeTypeIds)) {
      map[event.category] = true;
    }
    return map;
  }, {});
  const orderedKeys = ['REUNION', 'DESTACADO'];
  const items = orderedKeys.filter(function(key) {
    return categoriesInUse[key];
  }).map(function(key) {
    return {
      label: model.styles[key].label,
      background: model.styles[key].background,
      fontColor: model.styles[key].fontColor,
    };
  });
  items.unshift(model.styles.weekend);
  if (model.activeTypes.some(function(type) {
    return (model.evaluationsByTypeId[type.id] || []).length > 0;
  })) {
    items.splice(1, 0, model.styles.evaluationEnd);
  }
  if (model.activeTypes.some(function(type) { return type.practicesStart || type.practicesEnd; })) {
    items.push(model.styles.practicas);
  }
  if (model.activeTypes.some(function(type) { return type.reviewStart && type.reviewEnd; })) {
    items.push(model.styles.repaso);
  }
  items.push(model.styles.hoy);
  return items;
}

function renderCalendarStats_(sheet, model, layout) {
  const colors = model.theme.colors;
  setMergedRangeValue_(sheet.getRange(layout.statsRow, 1, 1, layout.columns), 'ESTADÍSTICAS DE DÍAS LECTIVOS')
    .setBackground(colors.primary)
    .setFontColor(colors.onPrimary)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  renderCalendarStatsRow_(sheet, model, layout.statsRow + 1, {
    typeName: 'Tipo',
    evaluationName: 'Evaluación',
    total: 'Lectivos',
    elapsed: 'Transcurridos',
    remaining: 'Restantes',
  }, true);
  const stats = model.stats.length
    ? model.stats
    : [{ typeName: '', evaluationName: 'Sin evaluaciones configuradas', total: '', elapsed: '', remaining: '' }];
  stats.forEach(function(item, index) {
    renderCalendarStatsRow_(sheet, model, layout.statsRow + index + 2, item, false);
  });
  sheet.getRange(layout.statsRow, 1, stats.length + 2, layout.columns)
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
    .setBorder(true, true, true, true, true, true, colors.border, SpreadsheetApp.BorderStyle.SOLID);
}

function renderCalendarStatsRow_(sheet, model, row, item, isHeader) {
  const colors = model.theme.colors;
  const background = isHeader ? colors.muted : colors.surface;
  const fontWeight = isHeader ? 'bold' : 'normal';
  const segments = [
    { column: 1, width: 7, value: item.typeName },
    { column: 8, width: 12, value: item.evaluationName },
    { column: 20, width: 6, value: item.total },
    { column: 26, width: 7, value: item.elapsed },
    { column: 33, width: 7, value: item.remaining },
  ];
  segments.forEach(function(segment) {
    setMergedRangeValue_(sheet.getRange(row, segment.column, 1, segment.width), segment.value)
      .setBackground(background)
      .setFontColor(colors.text)
      .setFontWeight(fontWeight)
      .setHorizontalAlignment(segment.column >= 20 ? 'center' : 'left');
  });
}

function moveCalendarSheetAfterCover_(spreadsheet, sheet) {
  sheet.showSheet();
  const coverSheet = spreadsheet.getSheetByName(CP.SHEETS.COVER);
  spreadsheet.setActiveSheet(sheet);
  spreadsheet.moveActiveSheet(coverSheet ? coverSheet.getIndex() + 1 : 1);
}

function getAllCalendarEvents_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const datesSheet = spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_DATES);
  const dateTypesSheet = spreadsheet.getSheetByName(CP.SHEETS.CALENDAR_DATE_TYPES);
  const typeIdsByDateId = readCalendarTableRows_(dateTypesSheet, CP_CALENDAR_HEADERS.DATE_TYPES.length)
    .reduce(function(map, row) {
      const dateId = normalizeCalendarText_(row[0]);
      const typeId = normalizeCalendarText_(row[1]);
      if (dateId && isSupportedCalendarTypeId_(typeId)) {
        map[dateId] = map[dateId] || [];
        if (map[dateId].indexOf(typeId) === -1) map[dateId].push(typeId);
      }
      return map;
    }, {});
  return readCalendarTableRows_(datesSheet, CP_CALENDAR_HEADERS.DATES.length)
    .filter(function(row) {
      return isSupportedCalendarCategory_(row[3]) && row[1] instanceof Date && row[2] instanceof Date;
    }).map(function(row) {
      const category = normalizeCalendarCategory_(row[3]);
      const dateId = normalizeCalendarText_(row[0]);
      return {
        id: dateId,
        startDate: row[1],
        endDate: row[2],
        category: category,
        typeIds: typeIdsByDateId[dateId] || [],
        description: normalizeCalendarText_(row[4]),
        priority: Number(row[5]) || CP_CALENDAR_CATEGORIES[category].priority,
      };
    });
}

function getEvaluationPeriodsForType_(type, timeZone) {
  let previousEnd = null;
  return getEvaluationsForType_(type.id).filter(function(evaluation) {
    return evaluation.endDate instanceof Date;
  }).map(function(evaluation) {
    const startDate = previousEnd ? addCalendarDays_(previousEnd, 1, timeZone) : type.startDate;
    previousEnd = evaluation.endDate;
    return {
      id: evaluation.id,
      typeId: type.id,
      name: evaluation.name,
      startDate: startDate,
      endDate: evaluation.endDate,
    };
  });
}

function calculateEvaluationStatsForType_(type, evaluationPeriods, events, today, timeZone) {
  return evaluationPeriods.map(function(period) {
    const total = countTeachingDaysBetween_(period.startDate, period.endDate, type, events, timeZone);
    const elapsedEnd = compareCalendarDates_(today, period.endDate, timeZone) < 0 ? today : period.endDate;
    const elapsed = compareCalendarDates_(today, period.startDate, timeZone) < 0
      ? 0
      : countTeachingDaysBetween_(period.startDate, elapsedEnd, type, events, timeZone);
    return {
      typeName: type.name,
      evaluationName: period.name,
      total: total,
      elapsed: elapsed,
      remaining: Math.max(0, total - elapsed),
    };
  });
}

function countTeachingDaysBetween_(startDate, endDate, type, events, timeZone) {
  if (!startDate || !endDate || compareCalendarDates_(startDate, endDate, timeZone) > 0) {
    return 0;
  }
  let count = 0;
  for (let cursor = startDate; compareCalendarDates_(cursor, endDate, timeZone) <= 0; cursor = addCalendarDays_(cursor, 1, timeZone)) {
    if (isTeachingDayForType_(cursor, type, events, timeZone)) {
      count += 1;
    }
  }
  return count;
}

function isTeachingDayForType_(date, type, events, timeZone) {
  return isDateInTeachingTypePeriod_(date, type, timeZone) &&
    !isWeekendDate_(date) &&
    !getCalendarEventsForTypeFromList_(date, type.id, events, timeZone).some(function(event) {
      const category = CP_CALENDAR_CATEGORIES[event.category];
      return category && category.nonTeaching;
    });
}

function getDominantCalendarEventForTypeIds_(date, typeIds, events, timeZone) {
  const applicableEvents = events.filter(function(event) {
    return eventAppliesToAnyTypeId_(event, typeIds) && isDateInsideCalendarEvent_(date, event, timeZone);
  }).sort(function(first, second) {
    return first.priority - second.priority;
  });
  return applicableEvents.length ? applicableEvents[0] : null;
}

function getCalendarEventsForTypeFromList_(date, typeId, events, timeZone) {
  return events.filter(function(event) {
    return eventAppliesToTypeId_(event, typeId) && isDateInsideCalendarEvent_(date, event, timeZone);
  });
}

function getCalendarEventsForTypeIdsFromList_(date, typeIds, events, timeZone) {
  return events.filter(function(event) {
    return eventAppliesToAnyTypeId_(event, typeIds) && isDateInsideCalendarEvent_(date, event, timeZone);
  });
}

function buildCalendarDayNote_(date, model) {
  const lines = [];
  getCalendarEventsForTypeIdsFromList_(date, model.activeTypeIds, model.events, model.timeZone)
    .forEach(function(event) {
      if (event.category !== 'REUNION' && event.category !== 'DESTACADO') return;
      const description = normalizeCalendarText_(event.description);
      if (description) lines.push(description);
    });
  getEvaluationEndNotesForDate_(date, model)
    .forEach(function(line) { lines.push(line); });
  getPracticeMilestonesForDate_(date, model.activeTypes, model.timeZone)
    .forEach(function(line) { lines.push(line); });
  return dedupeCalendarNoteLines_(lines).join('\n');
}

function getEvaluationEndNotesForDate_(date, model) {
  const lines = [];
  model.activeTypes.forEach(function(type) {
    (model.evaluationsByTypeId[type.id] || []).forEach(function(period) {
      if (compareCalendarDates_(date, period.endDate, model.timeZone) === 0) {
        lines.push(type.name + ' - Fin ' + period.name);
      }
    });
  });
  return lines;
}

function getPracticeMilestonesForDate_(date, types, timeZone) {
  const lines = [];
  types.forEach(function(type) {
    if (type.practicesStart instanceof Date &&
        compareCalendarDates_(date, type.practicesStart, timeZone) === 0) {
      lines.push(type.name + ' - Inicio prácticas');
    }
    if (type.practicesEnd instanceof Date &&
        compareCalendarDates_(date, type.practicesEnd, timeZone) === 0) {
      lines.push(type.name + ' - Fin prácticas');
    }
  });
  return lines;
}

function dedupeCalendarNoteLines_(lines) {
  return lines.reduce(function(result, line) {
    const normalized = normalizeCalendarText_(line);
    if (normalized && result.indexOf(normalized) === -1) {
      result.push(normalized);
    }
    return result;
  }, []);
}

function eventAppliesToAnyTypeId_(event, typeIds) {
  return event.typeIds.length === 0 || event.typeIds.some(function(typeId) {
    return typeIds.indexOf(typeId) !== -1;
  });
}

function eventAppliesToTypeId_(event, typeId) {
  return event.typeIds.length === 0 || event.typeIds.indexOf(typeId) !== -1;
}

function isDateInsideCalendarEvent_(date, event, timeZone) {
  return compareCalendarDates_(event.startDate, date, timeZone) <= 0 &&
    compareCalendarDates_(event.endDate, date, timeZone) >= 0;
}

function isDateInTeachingTypePeriod_(date, type, timeZone) {
  return isDateInRange_(date, type.startDate, type.endDate, timeZone);
}

function isDateInAnyTeachingTypeRange_(date, types, startField, endField, timeZone) {
  return types.some(function(type) {
    return isDateInRange_(date, type[startField], type[endField], timeZone);
  });
}

function isDateInRange_(date, startDate, endDate, timeZone) {
  return startDate instanceof Date && endDate instanceof Date &&
    compareCalendarDates_(date, startDate, timeZone) >= 0 &&
    compareCalendarDates_(date, endDate, timeZone) <= 0;
}

function isWeekendDate_(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function addCalendarDays_(date, days, timeZone) {
  const dateKey = Utilities.formatDate(date, timeZone, 'yyyy-MM-dd');
  const parts = dateKey.split('-').map(Number);
  const copy = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatCalendarDateForDisplay_(date, timeZone) {
  return date instanceof Date ? Utilities.formatDate(date, timeZone, 'dd/MM/yyyy') : '';
}

function formatCalendarEventNote_(event) {
  if (!event || (event.category !== 'REUNION' && event.category !== 'DESTACADO')) {
    return '';
  }
  return normalizeCalendarText_(event.description);
}

function isCalendarConfiguredForSidebar_() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    initializeCalendarStructure_();
    const model = buildCalendarRenderModel_(spreadsheet);
    return model.activeTypes.length > 0 && Boolean(spreadsheet.getSheetByName(CP.SHEETS.CALENDAR));
  } catch (error) {
    return false;
  }
}
