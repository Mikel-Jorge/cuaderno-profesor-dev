const CP_MODULE_CONFIG_HEADERS = Object.freeze([
  'actividad_id', 'sheet_id', 'curso_academico', 'created_at', 'applied_signature',
]);
const CP_MODULE_PLAN_HEADERS = Object.freeze([
  'plan_id', 'actividad_id', 'curso_academico', 'fecha', 'tramo_id', 'ut_id',
]);
const CP_MODULE_CONFIG_LAYOUT = Object.freeze({
  COLUMNS: 44,
  CALENDAR_COLUMNS: 39,
  FIRST_MONTH_ROW: 7,
  MONTH_ROWS: 8,
  MONTH_COLUMNS: 7,
  MONTH_GAP_ROWS: 1,
  MONTH_GAP_COLUMNS: 1,
  UT_HEADER_ROW: 27,
  UT_FIRST_ROW: 28,
  INITIAL_UT_ROWS: 15,
  UT_ID_COLUMN: 40,
  EVALUATION_ID_COLUMN: 41,
  CURRENT_ROW_SIGNATURE_COLUMN: 42,
  APPLIED_ROW_SIGNATURE_COLUMN: 43,
  CHANGE_FLAG_COLUMN: 44,
});
const CP_MODULE_MIXED_DAY_COLOR = '#F59E0B';
const CP_MODULE_UT_COLORS = Object.freeze([
  '#BFDBFE', '#BBF7D0', '#FDE68A', '#FBCFE8', '#DDD6FE', '#FED7AA',
  '#A5F3FC', '#C7D2FE', '#D9F99D', '#FECACA', '#E9D5FF', '#BAE6FD',
]);

function ensureModuleConfigTechnicalStructure_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  ensureModuleTechnicalTable_(
    getOrCreateSheet_(spreadsheet, CP.SHEETS.MODULE_CONFIG),
    CP_MODULE_CONFIG_HEADERS
  );
  ensureModuleTechnicalTable_(
    getOrCreateSheet_(spreadsheet, CP.SHEETS.MODULE_PLAN),
    CP_MODULE_PLAN_HEADERS
  );
  spreadsheet.getSheetByName(CP.SHEETS.MODULE_CONFIG).hideSheet();
  spreadsheet.getSheetByName(CP.SHEETS.MODULE_PLAN).hideSheet();
}

function ensureModuleTechnicalTable_(sheet, headers) {
  const existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0]
    .map(normalizeScheduleText_);
  const hasContent = existing.some(Boolean) || sheet.getLastRow() > 1;
  if (hasContent && existing.some(function(header, index) { return header !== headers[index]; })) {
    throw new Error(
      'La hoja técnica ' + sheet.getName() +
      ' tiene un esquema incompatible. No se han modificado sus datos.'
    );
  }
  ensureSheetSize_(sheet, 2, headers.length);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), headers.length)
    .setNumberFormat('@');
}

function assertModuleConfigStructureReady_(spreadsheet) {
  [
    [CP.SHEETS.MODULE_CONFIG, CP_MODULE_CONFIG_HEADERS],
    [CP.SHEETS.MODULE_PLAN, CP_MODULE_PLAN_HEADERS],
  ].forEach(function(definition) {
    const sheet = spreadsheet.getSheetByName(definition[0]);
    if (!sheet || sheet.getLastColumn() < definition[1].length) {
      throw new Error(
        'Falta la estructura técnica de Módulos. Usa «Inicializar / reparar estructura».'
      );
    }
    const headers = sheet.getRange(1, 1, 1, definition[1].length).getValues()[0]
      .map(normalizeScheduleText_);
    if (headers.some(function(header, index) { return header !== definition[1][index]; })) {
      throw new Error(
        'La hoja técnica ' + definition[0] +
        ' no tiene las cabeceras esperadas. Usa «Inicializar / reparar estructura».'
      );
    }
  });
}

function abrirCreacionConfiguracionModulo() {
  const template = HtmlService.createTemplateFromFile('UiDialogModuleConfig');
  template.moduleData = getModuleConfigDialogData_();
  setCommonUiTemplateData_(template);
  const output = template.evaluate()
    .setWidth(CP.UI.MODULE_CONFIG_DIALOG_WIDTH)
    .setHeight(CP.UI.MODULE_CONFIG_DIALOG_HEIGHT);
  SpreadsheetApp.getUi().showModalDialog(output, CP.MENU.MODULE_CONFIG_CREATE);
}

function getModuleConfigDialogData_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const registry = readModuleConfigRegistry_(spreadsheet);
  return {
    modules: getModuleActivities_().map(function(activity) {
      const record = registry.find(function(item) { return item.activityId === activity.id; });
      const registeredSheet = record ? getSheetById_(spreadsheet, record.sheetId) : null;
      if (registeredSheet) return null;
      let prerequisiteError = '';
      try {
        validateModuleConfigPrerequisites_(spreadsheet, activity);
      } catch (error) {
        prerequisiteError = error && error.message
          ? error.message
          : 'La configuración del módulo está incompleta.';
      }
      return {
        id: activity.id,
        label: getModuleDialogLabel_(activity),
        configured: false,
        sheetName: '',
        prerequisiteError: prerequisiteError,
      };
    }).filter(Boolean),
  };
}

function getModuleDialogLabel_(activity) {
  const displayName = getModuleDisplayName_(activity);
  const fullName = normalizeScheduleText_(activity.name);
  return fullName && fullName !== normalizeScheduleText_(activity.acronym)
    ? displayName + ' — ' + fullName
    : displayName;
}

function crearConfiguracionModulo(activityId) {
  try {
    const result = createModuleConfig_(activityId);
    return Object.assign({ ok: true }, result);
  } catch (error) {
    console.error(
      'Error al crear la configuración de módulo: ' +
      (error && error.stack ? error.stack : error)
    );
    return {
      ok: false,
      expected: Boolean(error && error.moduleConfigExpected),
      rollbackComplete: error && error.moduleConfigRollbackComplete !== false,
      message: error && error.moduleConfigExpected
        ? error.message
        : 'No se ha podido crear la configuración del módulo.',
    };
  }
}

function createModuleConfig_(activityId) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const activity = getModuleActivityById_(activityId);
    if (!activity) {
      throwModuleConfigExpectedError_(
        'El módulo seleccionado ya no existe en la configuración del Horario.'
      );
    }
    const existing = findModuleConfigRecordByActivityId_(spreadsheet, activity.id);
    if (existing) {
      const existingSheet = getSheetById_(spreadsheet, existing.sheetId);
      if (!existingSheet) {
        throw new Error(
          'Existe un registro de configuración sin su hoja asociada. ' +
          'Usa «Inicializar / reparar estructura» antes de continuar.'
        );
      }
      spreadsheet.setActiveSheet(existingSheet);
      return {
        created: false,
        sheetName: existingSheet.getName(),
        message: 'La configuración ya existía. Se ha abierto su hoja.',
      };
    }
    const context = validateModuleConfigPrerequisites_(spreadsheet, activity);
    ensureModuleConfigTechnicalStructure_();
    const previousConfigRows = readModuleConfigRegistry_(spreadsheet)
      .map(moduleConfigRecordToRow_);
    const previousPlanRows = readModulePlanRows_(spreadsheet);

    let sheet = null;
    try {
      const sheetName = buildUniqueModuleConfigSheetName_(spreadsheet, activity);
      sheet = spreadsheet.insertSheet(sheetName);
      renderNewModuleConfigSheet_(sheet, activity, context);
      const signature = applyModuleSignatureSnapshot_(sheet);
      replaceModulePlan_(spreadsheet, activity.id, context.academicYear, []);
      appendModuleConfigRecord_(spreadsheet, {
        activityId: activity.id,
        sheetId: sheet.getSheetId(),
        academicYear: context.academicYear,
        createdAt: new Date(),
        appliedSignature: signature,
      });
      reorderManagedVisibleSheets_(spreadsheet);
      actualizarIndicePortada();
      spreadsheet.setActiveSheet(sheet);
      return {
        created: true,
        sheetName: sheet.getName(),
        message: 'Configuración creada. Completa las UT y ejecuta Recalcular.',
      };
    } catch (error) {
      const rollbackComplete = rollbackFailedModuleConfigCreation_(
        spreadsheet,
        sheet,
        previousConfigRows,
        previousPlanRows
      );
      if (error && typeof error === 'object') {
        error.moduleConfigRollbackComplete = rollbackComplete;
      }
      throw error;
    }
  } finally {
    lock.releaseLock();
  }
}

function throwModuleConfigExpectedError_(message) {
  const error = new Error(message);
  error.moduleConfigExpected = true;
  throw error;
}

function validateModuleConfigPrerequisites_(spreadsheet, activity) {
  const missing = [];
  const typeId = normalizeScheduleText_(activity.teachingTypeId);
  const group = normalizeScheduleText_(activity.group);
  const type = typeId ? getTeachingTypeById_(typeId) : null;
  const weeklySessions = countWeeklySessionsForActivity_(activity.id);
  const evaluations = typeId ? getEvaluationsForType_(typeId) : [];

  if (!typeId || !isSupportedCalendarTypeId_(typeId)) missing.push('tipo de enseñanza del módulo');
  if (!group) missing.push('grupo del módulo');
  if (!weeklySessions) missing.push('al menos una sesión semanal asignada en Horario');
  if (!type || !type.active || !(type.startDate instanceof Date) || !(type.endDate instanceof Date)) {
    missing.push('periodo lectivo activo para el tipo de enseñanza en Calendario');
  }
  if (!evaluations.length || evaluations.some(function(evaluation) {
    return !(evaluation.endDate instanceof Date) || !evaluation.name;
  })) {
    missing.push('evaluaciones con nombre y fecha final para el tipo de enseñanza');
  }
  if (missing.length) {
    throwModuleConfigExpectedError_(
      'Antes de crear esta configuración, completa: ' + missing.join('; ') + '.'
    );
  }

  const timeZone = spreadsheet.getSpreadsheetTimeZone();
  let previousEnd = null;
  evaluations.forEach(function(evaluation) {
    if (previousEnd && compareCalendarDates_(evaluation.endDate, previousEnd, timeZone) <= 0) {
      throwModuleConfigExpectedError_(
        'Las fechas finales de las evaluaciones deben estar en orden cronológico.'
      );
    }
    if (compareCalendarDates_(evaluation.endDate, type.startDate, timeZone) < 0 ||
        compareCalendarDates_(evaluation.endDate, type.endDate, timeZone) > 0) {
      throwModuleConfigExpectedError_(
        'Las fechas finales de evaluación deben estar dentro del periodo lectivo.'
      );
    }
    previousEnd = evaluation.endDate;
  });

  let academicYear;
  try {
    academicYear = getConfiguredAcademicYear_(spreadsheet);
  } catch (error) {
    throwModuleConfigExpectedError_(error && error.message
      ? error.message
      : 'Configura primero el curso académico en Datos generales.');
  }
  return {
    academicYear: academicYear,
    type: type,
    evaluations: evaluations,
    weeklySessions: weeklySessions,
  };
}

function buildUniqueModuleConfigSheetName_(spreadsheet, activity) {
  const displayName = getModuleDisplayName_(activity) || activity.id;
  let base = ('4 Config ' + displayName)
    .replace(/[\\\/\?\*\[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  base = base.slice(0, 100).trim();
  if (!base) base = '4 Config Modulo';
  let candidate = base;
  let suffix = 2;
  while (spreadsheet.getSheetByName(candidate)) {
    const marker = ' (' + suffix + ')';
    candidate = base.slice(0, 100 - marker.length).trim() + marker;
    suffix += 1;
  }
  return candidate;
}

function renderNewModuleConfigSheet_(sheet, activity, context) {
  const rows = CP_MODULE_CONFIG_LAYOUT.UT_FIRST_ROW +
    CP_MODULE_CONFIG_LAYOUT.INITIAL_UT_ROWS - 1;
  ensureSheetSize_(sheet, rows, CP_MODULE_CONFIG_LAYOUT.COLUMNS);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.getRange(1, 1, rows, CP_MODULE_CONFIG_LAYOUT.COLUMNS).clear();
  sheet.setConditionalFormatRules([]);
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(5);
  sheet.setFrozenColumns(0);
  sheet.setTabColor(getActiveTheme_(sheet.getParent()).colors.primary);
  const sessions = buildRealModuleSessions_(sheet.getParent(), context.type, activity);
  renderModuleConfigCalendar_(sheet, activity, context, sessions, []);
  renderModuleConfigUtArea_(sheet, activity, context);
  sheet.hideColumns(CP_MODULE_CONFIG_LAYOUT.UT_ID_COLUMN, 5);
  trimSheetToBounds_(sheet, rows, CP_MODULE_CONFIG_LAYOUT.COLUMNS);
}

function buildModuleCalendarModel_(spreadsheet, type) {
  const academicYear = getConfiguredAcademicYear_(spreadsheet);
  const timeZone = spreadsheet.getSpreadsheetTimeZone();
  const theme = getActiveTheme_(spreadsheet);
  const today = parseCalendarDate_(new Date(), timeZone, 'hoy', true);
  const evaluationsByTypeId = {};
  evaluationsByTypeId[type.id] = getEvaluationPeriodsForType_(type, timeZone);
  return {
    spreadsheet: spreadsheet,
    academicYear: academicYear,
    timeZone: timeZone,
    bounds: getAcademicYearBounds_(academicYear, timeZone),
    theme: theme,
    styles: getCalendarSemanticStyles_(theme),
    types: [type],
    activeTypes: [type],
    activeTypeIds: [type.id],
    events: getAllCalendarEvents_(),
    evaluationsByTypeId: evaluationsByTypeId,
    today: today,
    todaySerial: getCalendarDateSerial_(today, timeZone),
    stats: [],
  };
}

function renderModuleConfigCalendar_(sheet, activity, context, sessions, assignments) {
  ensureSheetSize_(sheet, sheet.getMaxRows(), CP_MODULE_CONFIG_LAYOUT.COLUMNS);
  const model = buildModuleCalendarModel_(sheet.getParent(), context.type);
  const theme = model.theme;
  const calendarRange = sheet.getRange(1, 1, 24, CP_MODULE_CONFIG_LAYOUT.CALENDAR_COLUMNS);
  calendarRange.breakApart().clear();
  calendarRange
    .setFontFamily('Arial')
    .setFontSize(8)
    .setVerticalAlignment('middle')
    .setWrap(false)
    .setBackground(theme.colors.background)
    .setFontColor(theme.colors.text);
  applyModuleConfigDimensions_(sheet);
  setMergedRangeValue_(sheet.getRange(1, 1, 1, 39), 'CONFIGURACIÓN DEL MÓDULO')
    .setBackground(theme.colors.primary)
    .setFontColor(theme.colors.onPrimary)
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  setMergedRangeValue_(sheet.getRange(2, 1, 1, 39), getModuleDialogLabel_(activity))
    .setBackground(theme.colors.secondary)
    .setFontColor(theme.colors.onSecondary)
    .setFontSize(12)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  setMergedRangeValue_(sheet.getRange(3, 1, 1, 39),
    'Curso ' + context.academicYear + ' · ' + context.type.name +
    ' · ' + context.weeklySessions + ' sesiones semanales')
    .setBackground(theme.colors.surface)
    .setFontColor(theme.colors.mutedText)
    .setHorizontalAlignment('center');
  sheet.getRange(4, 1, 1, 39).merge()
    .setFormula(
      '=SUM(AR' + CP_MODULE_CONFIG_LAYOUT.UT_FIRST_ROW + ':AR)'
    )
    .setNumberFormat(
      '[=0]"\u2713 Calendario actualizado";' +
      '[>0]"\u26a0 Hay cambios pendientes de aplicar al calendario";;'
    )
    .setBackground(theme.colors.surface)
    .setFontColor(theme.colors.warning)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  setMergedRangeValue_(sheet.getRange(5, 1, 1, 39),
    'Edita las UT y usa Módulos → Recalcular configuración del módulo.')
    .setBackground(theme.colors.background)
    .setFontColor(theme.colors.mutedText)
    .setHorizontalAlignment('center');

  const planByDate = groupModulePlanByDate_(model, sessions, assignments);
  const academicStartYear = Number(context.academicYear.split('-')[0]);
  for (let monthIndex = 0; monthIndex < 10; monthIndex += 1) {
    const gridRow = Math.floor(monthIndex / 5);
    const gridColumn = monthIndex % 5;
    const startRow = CP_MODULE_CONFIG_LAYOUT.FIRST_MONTH_ROW +
      gridRow * (CP_MODULE_CONFIG_LAYOUT.MONTH_ROWS + CP_MODULE_CONFIG_LAYOUT.MONTH_GAP_ROWS);
    const startColumn = 1 +
      gridColumn * (CP_MODULE_CONFIG_LAYOUT.MONTH_COLUMNS + CP_MODULE_CONFIG_LAYOUT.MONTH_GAP_COLUMNS);
    const monthNumber = monthIndex < 4 ? monthIndex + 8 : monthIndex - 4;
    const year = monthIndex < 4 ? academicStartYear : academicStartYear + 1;
    renderSingleModuleMonth_(
      sheet, model, planByDate, startRow, startColumn, year, monthNumber, monthIndex
    );
  }
}

function applyModuleConfigDimensions_(sheet) {
  for (let column = 1; column <= 39; column += 1) {
    sheet.setColumnWidth(column, column % 8 === 0 ? 10 : 31);
  }
  sheet.setColumnWidths(40, 5, 40);
  sheet.setRowHeights(1, sheet.getMaxRows(), 22);
  sheet.setRowHeight(1, 30);
  sheet.setRowHeight(2, 24);
  for (let block = 0; block < 2; block += 1) {
    const row = CP_MODULE_CONFIG_LAYOUT.FIRST_MONTH_ROW +
      block * (CP_MODULE_CONFIG_LAYOUT.MONTH_ROWS + CP_MODULE_CONFIG_LAYOUT.MONTH_GAP_ROWS);
    sheet.setRowHeight(row, 22);
    sheet.setRowHeight(row + 1, 18);
    sheet.setRowHeights(row + 2, 6, 31);
  }
}

function renderSingleModuleMonth_(sheet, model, planByDate, startRow, startColumn, year, month, index) {
  const colors = model.theme.colors;
  setMergedRangeValue_(sheet.getRange(startRow, startColumn, 1, 7),
    CP_CALENDAR_MONTH_NAMES[index] + ' ' + year)
    .setBackground(colors.primary)
    .setFontColor(colors.onPrimary)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange(startRow + 1, startColumn, 1, 7)
    .setValues([CP_CALENDAR_WEEKDAY_LABELS])
    .setBackground(colors.muted)
    .setFontColor(colors.text)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  const values = [];
  const backgrounds = [];
  const fontColors = [];
  const fontWeights = [];
  const fontLines = [];
  const notes = [];
  const firstDay = new Date(year, month, 1, 12, 0, 0);
  const leading = (firstDay.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  for (let week = 0; week < 6; week += 1) {
    const valueRow = [];
    const backgroundRow = [];
    const fontColorRow = [];
    const fontWeightRow = [];
    const fontLineRow = [];
    const noteRow = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const day = week * 7 + weekday - leading + 1;
      if (day < 1 || day > days) {
        valueRow.push('');
        backgroundRow.push(colors.background);
        fontColorRow.push(colors.mutedText);
        fontWeightRow.push('normal');
        fontLineRow.push('none');
        noteRow.push('');
        continue;
      }
      const date = new Date(year, month, day, 12, 0, 0);
      const state = getCalendarVisualStateForDate_(date, model);
      const dateKey = Utilities.formatDate(date, model.timeZone, 'yyyy-MM-dd');
      const overlay = planByDate[dateKey];
      valueRow.push(day);
      backgroundRow.push(overlay && overlay.background ? overlay.background : state.background);
      fontColorRow.push(overlay && overlay.background
        ? getAccessibleTextColor_(overlay.background)
        : state.fontColor);
      fontWeightRow.push(state.isToday ? 'bold' : 'normal');
      fontLineRow.push(state.isPast && !state.isToday ? 'line-through' : 'none');
      noteRow.push(combineModuleCalendarNotes_(state.note, overlay && overlay.note));
    }
    values.push(valueRow);
    backgrounds.push(backgroundRow);
    fontColors.push(fontColorRow);
    fontWeights.push(fontWeightRow);
    fontLines.push(fontLineRow);
    notes.push(noteRow);
  }
  const range = sheet.getRange(startRow + 2, startColumn, 6, 7);
  range.setValues(values)
    .setBackgrounds(backgrounds)
    .setFontColors(fontColors)
    .setFontWeights(fontWeights)
    .setFontLines(fontLines)
    .setNotes(notes)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, colors.border, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(startRow, startColumn, 8, 7)
    .setBorder(true, true, true, true, false, false, colors.border, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

function groupModulePlanByDate_(model, sessions, assignments) {
  const sessionCountByDate = sessions.reduce(function(map, session) {
    map[session.dateKey] = (map[session.dateKey] || 0) + 1;
    return map;
  }, {});
  const grouped = assignments.reduce(function(map, assignment) {
    const item = map[assignment.dateKey] || { assigned: 0, units: {}, order: [] };
    item.assigned += 1;
    if (!item.units[assignment.ut.id]) {
      item.units[assignment.ut.id] = { code: assignment.ut.code, color: assignment.ut.color, count: 0 };
      item.order.push(assignment.ut.id);
    }
    item.units[assignment.ut.id].count += 1;
    map[assignment.dateKey] = item;
    return map;
  }, {});
  Object.keys(sessionCountByDate).forEach(function(dateKey) {
    const item = grouped[dateKey] || { assigned: 0, units: {}, order: [] };
    const lines = [];
    const unassigned = sessionCountByDate[dateKey] - item.assigned;
    let background = '';
    if (item.order.length > 1) {
      background = model.theme && model.theme.colors.mixedDay
        ? model.theme.colors.mixedDay
        : CP_MODULE_MIXED_DAY_COLOR;
      item.order.forEach(function(id) {
        const unit = item.units[id];
        lines.push(unit.code + ': ' + unit.count + ' h');
      });
    } else if (item.order.length === 1 && unassigned === 0) {
      background = item.units[item.order[0]].color;
    }
    grouped[dateKey] = { background: background, note: lines.join('\n') };
  });
  return grouped;
}

function combineModuleCalendarNotes_(calendarNote, planningNote) {
  return [normalizeCalendarText_(calendarNote), normalizeCalendarText_(planningNote)]
    .filter(Boolean).join('\n');
}

function renderModuleConfigUtArea_(sheet, activity, context) {
  const theme = getActiveTheme_(sheet.getParent());
  const firstRow = CP_MODULE_CONFIG_LAYOUT.UT_FIRST_ROW;
  const rowCount = CP_MODULE_CONFIG_LAYOUT.INITIAL_UT_ROWS;
  setMergedRangeValue_(sheet.getRange(25, 1, 1, 39), 'UNIDADES DE TRABAJO')
    .setBackground(theme.colors.primary)
    .setFontColor(theme.colors.onPrimary)
    .setFontSize(13)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  setMergedRangeValue_(sheet.getRange(26, 1, 1, 39),
    'Horas equivale a sesiones docentes. La evaluacion se calcula con el ultimo dia asignado a cada UT.')
    .setBackground(theme.colors.surface)
    .setFontColor(theme.colors.mutedText)
    .setHorizontalAlignment('left');
  sheet.getRange(CP_MODULE_CONFIG_LAYOUT.UT_HEADER_ROW, 1, 1, 5)
    .setValues([['UT', 'Nombre', 'Horas', 'Color', 'Evaluacion']])
    .setBackground(theme.colors.secondary)
    .setFontColor(theme.colors.onSecondary)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange(firstRow, 1, rowCount, 5)
    .setBackground(theme.colors.surface)
    .setFontColor(theme.colors.text)
    .setVerticalAlignment('middle')
    .setWrap(true)
    .setBorder(true, true, true, true, true, true, theme.colors.border, SpreadsheetApp.BorderStyle.SOLID);
  applyModuleConfigDimensions_(sheet);
  sheet.setRowHeights(firstRow, rowCount, 34);
  sheet.getRange(firstRow, 3, rowCount, 1).setNumberFormat('0');
  sheet.getRange(firstRow, 4, rowCount, 1).setNumberFormat('@');
  sheet.getRange(firstRow, 5, rowCount, 1)
    .setBackground(theme.colors.muted)
    .setFontColor(theme.colors.mutedText)
    .setFontStyle('italic');
  sheet.getRange(firstRow, CP_MODULE_CONFIG_LAYOUT.UT_ID_COLUMN, rowCount, 2)
    .setNumberFormat('@');

  sheet.getRange(firstRow, 5, rowCount, 1).clearDataValidations();
  sheet.getRange(firstRow, 4, rowCount, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(CP_MODULE_UT_COLORS, true).setAllowInvalid(true).build()
  );
  sheet.getRange(firstRow, 3, rowCount, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).build()
  );
  const rules = CP_MODULE_UT_COLORS.map(function(color) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(color)
      .setBackground(color)
      .setFontColor(getAccessibleTextColor_(color))
      .setRanges([sheet.getRange(firstRow, 4, rowCount, 1)])
      .build();
  });
  sheet.setConditionalFormatRules(rules);

  sheet.getRange(1, CP_MODULE_CONFIG_LAYOUT.UT_ID_COLUMN).setValue('ut_id');
  sheet.getRange(1, CP_MODULE_CONFIG_LAYOUT.EVALUATION_ID_COLUMN).setValue('evaluation_id');
  sheet.getRange(1, CP_MODULE_CONFIG_LAYOUT.CURRENT_ROW_SIGNATURE_COLUMN)
    .setValue('current_row_signature');
  sheet.getRange(1, CP_MODULE_CONFIG_LAYOUT.APPLIED_ROW_SIGNATURE_COLUMN)
    .setValue('applied_row_signature');
  sheet.getRange(1, CP_MODULE_CONFIG_LAYOUT.CHANGE_FLAG_COLUMN).setValue('change_flag');

  renderModuleHoursSummary_(sheet, activity, context, 27);
}

function renderModuleHoursSummary_(sheet, activity, context, startRow) {
  const theme = getActiveTheme_(sheet.getParent());
  const sessions = buildRealModuleSessions_(sheet.getParent(), context.type, activity);
  const units = readAndNormalizeModuleUnits_(sheet, context.evaluations, {
    writeBack: false,
    allowEmpty: true,
  });
  const summary = buildModuleHoursSummaryData_(sessions, units, context);
  sheet.getRange(startRow, 8, 1, 6).merge().setValue('RESUMEN DE HORAS')
    .setBackground(theme.colors.secondary)
    .setFontColor(theme.colors.onSecondary)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  let row = startRow + 1;
  context.evaluations.forEach(function(evaluation) {
    sheet.getRange(row, 8, 1, 3).merge().setValue(evaluation.name);
    sheet.getRange(row, 11, 1, 3).merge().setValue(summary.byEvaluation[evaluation.id] || 0)
      .setNumberFormat('0');
    row += 1;
  });
  sheet.getRange(row, 8, 1, 3).merge().setValue('Horas previstas totales').setFontWeight('bold');
  sheet.getRange(row, 11, 1, 3).merge().setValue(summary.planned)
    .setNumberFormat('0').setFontWeight('bold');
  row += 1;
  sheet.getRange(row, 8, 1, 3).merge().setValue('Sesiones lectivas disponibles');
  sheet.getRange(row, 11, 1, 3).merge().setValue(summary.available).setNumberFormat('0');
  row += 1;
  sheet.getRange(row, 8, 2, 6).merge().setValue(summary.statusText)
    .setBackground(theme.colors.surface)
    .setFontColor(theme.colors.warning)
    .setFontWeight('bold')
    .setWrap(true)
    .setHorizontalAlignment('center');
  row += 3;
  sheet.getRange(row, 8, 1, 6).merge().setValue('Resultado del ultimo recalculo')
    .setBackground(theme.colors.muted)
    .setFontWeight('bold');
  sheet.getRange(row + 1, 8, 5, 6).merge().setValue('Todavia no se ha recalculado.')
    .setBackground(theme.colors.surface)
    .setFontColor(theme.colors.mutedText)
    .setWrap(true)
    .setVerticalAlignment('top');
}

function buildModuleHoursSummaryData_(sessions, units, context) {
  const byEvaluation = context.evaluations.reduce(function(map, evaluation) {
    map[evaluation.id] = 0;
    return map;
  }, {});
  const planned = units.reduce(function(total, unit) {
    if (unit.evaluationId && Object.prototype.hasOwnProperty.call(byEvaluation, unit.evaluationId)) {
      byEvaluation[unit.evaluationId] += unit.hours;
    }
    return total + unit.hours;
  }, 0);
  const available = sessions.length;
  let statusText = 'Planificacion completa.';
  if (planned > available) {
    statusText = 'Exceso de ' + (planned - available) + ' h previstas sobre las sesiones disponibles.';
  } else if (planned < available) {
    statusText = 'Quedan ' + (available - planned) + ' sesiones reales sin distribuir.';
  }
  return {
    byEvaluation: byEvaluation,
    planned: planned,
    available: available,
    statusText: statusText,
  };
}

function isDateInModulePracticePeriod_(date, type, timeZone) {
  return type.practicesStart instanceof Date &&
    type.practicesEnd instanceof Date &&
    compareCalendarDates_(date, type.practicesStart, timeZone) >= 0 &&
    compareCalendarDates_(date, type.practicesEnd, timeZone) <= 0;
}
function buildRealModuleSessions_(spreadsheet, type, activity) {
  const timeZone = spreadsheet.getSpreadsheetTimeZone();
  const events = getAllCalendarEvents_();
  const slots = getTeachingTimeSlots_();
  const slotOrder = slots.reduce(function(map, slot, index) {
    map[slot.id] = index;
    return map;
  }, {});
  const assignments = getScheduleSessionsForActivity_(activity.id).filter(function(session) {
    return Object.prototype.hasOwnProperty.call(slotOrder, session.slotId);
  });
  const byDay = assignments.reduce(function(map, session) {
    map[session.day] = map[session.day] || [];
    map[session.day].push(session);
    return map;
  }, {});
  const result = [];
  for (let date = type.startDate;
      compareCalendarDates_(date, type.endDate, timeZone) <= 0;
      date = addCalendarDays_(date, 1, timeZone)) {
    if (!isTeachingDayForType_(date, type, events, timeZone) ||
        isDateInModulePracticePeriod_(date, type, timeZone)) continue;
    const dayNumber = Number(Utilities.formatDate(date, timeZone, 'u'));
    const dayCode = CP_SCHEDULE_DAYS[dayNumber - 1].id;
    (byDay[dayCode] || []).forEach(function(session) {
      result.push({
        date: new Date(date.getTime()),
        dateKey: Utilities.formatDate(date, timeZone, 'yyyy-MM-dd'),
        slotId: session.slotId,
        slotOrder: slotOrder[session.slotId],
      });
    });
  }
  return result.sort(function(first, second) {
    return first.dateKey.localeCompare(second.dateKey) || first.slotOrder - second.slotOrder;
  });
}

function recalcularConfiguracionModulo() {
  const template = HtmlService.createTemplateFromFile('UiDialogModuleRecalculation');
  setCommonUiTemplateData_(template);
  const output = template.evaluate()
    .setWidth(CP.UI.PROGRESS_DIALOG_WIDTH)
    .setHeight(430);
  SpreadsheetApp.getUi().showModalDialog(output, CP.MENU.MODULE_CONFIG_RECALCULATE);
}

function ejecutarRecalculoConfiguracionModuloUi() {
  try {
    return recalculateActiveModuleConfig_();
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      title: 'No se ha podido recalcular',
      message: error && error.message ? error.message : 'No se ha podido recalcular la configuracion.',
    };
  }
}

function recalculateActiveModuleConfig_() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getActiveSheet();
    const record = findModuleConfigRecordBySheetId_(spreadsheet, sheet.getSheetId());
    if (!record) {
      throw new Error(
        'Situate en una hoja 4 Config gestionada y vuelve a ejecutar Recalcular.'
      );
    }
    const academicYear = getConfiguredAcademicYear_(spreadsheet);
    if (record.academicYear !== academicYear) {
      throw new Error('Esta configuracion pertenece a otro curso academico.');
    }
    const activity = getModuleActivityById_(record.activityId);
    if (!activity) throw new Error('La actividad asociada a esta configuracion ya no existe.');
    const context = validateModuleConfigPrerequisites_(spreadsheet, activity);
    const units = readAndNormalizeModuleUnits_(sheet, context.evaluations, { writeBack: false });
    if (!units.length) throw new Error('Define al menos una UT con nombre y horas.');
    const sessions = buildRealModuleSessions_(spreadsheet, context.type, activity);
    const plannedHours = units.reduce(function(total, unit) { return total + unit.hours; }, 0);
    if (plannedHours > sessions.length) {
      throw new Error(
        'Las horas previstas por UT (' + plannedHours + ') superan las sesiones disponibles reales (' +
        sessions.length + '). Reduce ' + (plannedHours - sessions.length) +
        ' h antes de recalcular. No se ha modificado el calendario.'
      );
    }
    const assignments = assignModuleUnitsToSessions_(sessions, units);
    applyCalculatedEvaluationsToModuleUnits_(units, assignments, context);
    const warnings = buildModulePlanningWarnings_(sessions, assignments, units, context);
    const oldPlanRows = readModulePlanRows_(spreadsheet);
    try {
      writeNormalizedModuleUnits_(sheet, units);
      replaceModulePlan_(spreadsheet, record.activityId, academicYear, assignments);
      renderModuleConfigCalendar_(sheet, activity, context, sessions, assignments);
      refreshModuleConfigUtSupport_(sheet, activity, context);
      updateModuleRecalculationSummary_(
        sheet, context, sessions.length, assignments.length, warnings
      );
      const signature = applyModuleSignatureSnapshot_(sheet);
      updateModuleConfigRecordSignature_(spreadsheet, record.activityId, signature);
      spreadsheet.toast('Configuracion del modulo recalculada.', CP.PROJECT_NAME, 5);
      return {
        ok: true,
        status: warnings.length ? 'warning' : 'success',
        title: warnings.length ? 'Recalculado con avisos' : 'Configuracion recalculada',
        message: warnings.length
          ? warnings.join('\n')
          : 'Planificacion recalculada: ' + assignments.length +
            ' de ' + sessions.length + ' sesiones asignadas.',
      };
    } catch (error) {
      writeModuleTable_(
        spreadsheet.getSheetByName(CP.SHEETS.MODULE_PLAN),
        CP_MODULE_PLAN_HEADERS,
        oldPlanRows
      );
      throw error;
    }
  } finally {
    lock.releaseLock();
  }
}
function readAndNormalizeModuleUnits_(sheet, evaluations, options) {
  const readOptions = Object.assign({ writeBack: true, allowEmpty: false }, options || {});
  const firstRow = CP_MODULE_CONFIG_LAYOUT.UT_FIRST_ROW;
  const rowCount = CP_MODULE_CONFIG_LAYOUT.INITIAL_UT_ROWS;
  const visible = sheet.getRange(firstRow, 1, rowCount, 5).getValues();
  const ids = sheet.getRange(firstRow, CP_MODULE_CONFIG_LAYOUT.UT_ID_COLUMN, rowCount, 2).getValues();
  const usedCodes = {};
  const usedIds = {};
  const units = [];
  let changed = false;
  const inactiveRowsWithMetadata = [];
  visible.forEach(function(row, index) {
    const codeValue = normalizeScheduleText_(row[0]);
    const name = normalizeScheduleText_(row[1]);
    const hoursValue = row[2];
    const colorValue = normalizeScheduleText_(row[3]).toUpperCase();
    const evaluationName = normalizeScheduleText_(row[4]);
    const active = Boolean(codeValue || name || colorValue || evaluationName ||
      hoursValue !== '' && hoursValue !== null);
    if (!active) {
      if (normalizeScheduleText_(ids[index][0]) || normalizeScheduleText_(ids[index][1])) {
        inactiveRowsWithMetadata.push(firstRow + index);
      }
      return;
    }
    const code = codeValue || 'UT' + (units.length + 1);
    if (!name) throw new Error('Indica el nombre de ' + code + '.');
    const hours = Number(hoursValue);
    if (!Number.isInteger(hours) || hours < 0) {
      throw new Error('Las horas de ' + code + ' deben ser un entero igual o mayor que cero.');
    }
    if (colorValue && !CP_SCHEDULE_COLOR_PATTERN.test(colorValue)) {
      throw new Error('El color de ' + code + ' debe tener el formato #RRGGBB.');
    }
    const color = colorValue || CP_MODULE_UT_COLORS[units.length % CP_MODULE_UT_COLORS.length];
    const id = normalizeScheduleText_(ids[index][0]) || createCalendarRecordId_('UT');
    const evaluationId = normalizeScheduleText_(ids[index][1]);
    const evaluation = getModuleEvaluationByIdOrName_(evaluations, evaluationId, evaluationName);
    if (usedCodes[code.toUpperCase()]) throw new Error('El codigo de UT ' + code + ' esta repetido.');
    if (usedIds[id]) throw new Error('Dos UT comparten la misma identidad interna.');
    usedCodes[code.toUpperCase()] = true;
    usedIds[id] = true;
    units.push({
      id: id,
      code: code,
      name: name,
      color: color,
      hours: hours,
      evaluationId: evaluation ? evaluation.id : '',
      evaluationName: evaluation ? evaluation.name : '',
      sourceRow: firstRow + index,
    });
    if (code !== codeValue || color !== colorValue || id !== normalizeScheduleText_(ids[index][0]) ||
        (evaluation ? evaluation.id : '') !== evaluationId) changed = true;
  });
  if (changed && readOptions.writeBack) {
    writeNormalizedModuleUnits_(sheet, units);
  }
  if (inactiveRowsWithMetadata.length && readOptions.writeBack) {
    const colors = getActiveTheme_(sheet.getParent()).colors;
    inactiveRowsWithMetadata.forEach(function(row) {
      sheet.getRange(row, CP_MODULE_CONFIG_LAYOUT.UT_ID_COLUMN, 1, 2).clearContent();
      sheet.getRange(row, 4).setBackground(colors.surface).setFontColor(colors.text);
    });
  }
  return units;
}

function getModuleEvaluationByIdOrName_(evaluations, evaluationId, evaluationName) {
  return evaluations.find(function(evaluation) {
    return normalizeScheduleText_(evaluation.id) === evaluationId;
  }) || evaluations.find(function(evaluation) {
    return normalizeScheduleText_(evaluation.name) === evaluationName;
  }) || null;
}

function writeNormalizedModuleUnits_(sheet, units) {
  const theme = getActiveTheme_(sheet.getParent());
  units.forEach(function(unit) {
    sheet.getRange(unit.sourceRow, 1).setValue(unit.code);
    sheet.getRange(unit.sourceRow, 3).setValue(unit.hours);
    sheet.getRange(unit.sourceRow, 4).setValue(unit.color).setBackground(unit.color)
      .setFontColor(getAccessibleTextColor_(unit.color));
    sheet.getRange(unit.sourceRow, 5).setValue(unit.evaluationName || '')
      .setBackground(theme.colors.muted)
      .setFontColor(theme.colors.mutedText)
      .setFontStyle('italic');
    sheet.getRange(unit.sourceRow, CP_MODULE_CONFIG_LAYOUT.UT_ID_COLUMN).setValue(unit.id);
    sheet.getRange(unit.sourceRow, CP_MODULE_CONFIG_LAYOUT.EVALUATION_ID_COLUMN)
      .setValue(unit.evaluationId || '');
  });
}
function assignModuleUnitsToSessions_(sessions, units) {
  const assignments = [];
  let sessionIndex = 0;
  units.forEach(function(unit) {
    for (let count = 0; count < unit.hours && sessionIndex < sessions.length; count += 1) {
      assignments.push(Object.assign({}, sessions[sessionIndex], { ut: unit }));
      sessionIndex += 1;
    }
  });
  return assignments;
}

function buildModulePlanningWarnings_(sessions, assignments, units, context) {
  const warnings = [];
  const plannedHours = units.reduce(function(total, unit) { return total + unit.hours; }, 0);
  if (plannedHours < sessions.length) {
    warnings.push('Quedan ' + (sessions.length - plannedHours) + ' sesiones reales sin UT.');
  }
  const evaluationPeriods = getEvaluationPeriodsForType_(context.type,
    SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone());
  const evaluationByDate = function(date) {
    return evaluationPeriods.find(function(period) {
      return compareCalendarDates_(date, period.startDate,
        SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone()) >= 0 &&
        compareCalendarDates_(date, period.endDate,
          SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone()) <= 0;
    });
  };
  const crossed = {};
  assignments.forEach(function(assignment) {
    const actual = evaluationByDate(assignment.date);
    if (!actual) return;
    crossed[assignment.ut.code] = crossed[assignment.ut.code] || {};
    crossed[assignment.ut.code][actual.id] = true;
  });
  const crossedCodes = Object.keys(crossed).filter(function(code) {
    return Object.keys(crossed[code]).length > 1;
  });
  if (crossedCodes.length) {
    warnings.push(
      'Estas UT cruzan fechas de distintas evaluaciones: ' + crossedCodes.join(', ') +
      '. Se ha asignado como evaluacion final la del ultimo dia planificado.'
    );
  }
  return warnings;
}

function applyCalculatedEvaluationsToModuleUnits_(units, assignments, context) {
  const timeZone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const periods = getEvaluationPeriodsForType_(context.type, timeZone);
  const lastByUnitId = {};
  assignments.forEach(function(assignment) {
    lastByUnitId[assignment.ut.id] = assignment.date;
  });
  units.forEach(function(unit) {
    const lastDate = lastByUnitId[unit.id];
    const period = lastDate ? periods.find(function(item) {
      return compareCalendarDates_(lastDate, item.startDate, timeZone) >= 0 &&
        compareCalendarDates_(lastDate, item.endDate, timeZone) <= 0;
    }) : null;
    unit.evaluationId = period ? period.id : '';
    unit.evaluationName = period ? period.name : '';
  });
}
function updateModuleRecalculationSummary_(sheet, context, available, assigned, warnings) {
  const row = CP_MODULE_CONFIG_LAYOUT.UT_HEADER_ROW + context.evaluations.length + 7;
  const text = 'Sesiones asignadas: ' + assigned + ' de ' + available + '.' +
    (warnings.length ? '\n' + warnings.join('\n') : '\nSin avisos de distribución.');
  sheet.getRange(row, 8, 5, 6).setValue(text).setWrap(true);
}

function refreshModuleConfigUtSupport_(sheet, activity, context) {
  const firstRow = CP_MODULE_CONFIG_LAYOUT.UT_FIRST_ROW;
  const rowCount = Math.max(1, sheet.getMaxRows() - firstRow + 1);
  const theme = getActiveTheme_(sheet.getParent());
  sheet.getRange(firstRow, 5, rowCount, 1)
    .clearDataValidations()
    .setBackground(theme.colors.muted)
    .setFontColor(theme.colors.mutedText)
    .setFontStyle('italic');
  sheet.getRange(27, 8, Math.min(20, sheet.getMaxRows() - 26), 6)
    .breakApart().clearContent().clearFormat();
  renderModuleHoursSummary_(sheet, activity, context, 27);
}

function readModuleConfigRegistry_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(CP.SHEETS.MODULE_CONFIG);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, CP_MODULE_CONFIG_HEADERS.length)
    .getValues().filter(function(row) { return normalizeScheduleText_(row[0]); })
    .map(function(row) {
      return {
        activityId: normalizeScheduleText_(row[0]),
        sheetId: Number(row[1]),
        academicYear: normalizeScheduleText_(row[2]),
        createdAt: row[3],
        appliedSignature: normalizeScheduleText_(row[4]),
      };
    });
}

function applyModuleSignatureSnapshot_(sheet) {
  ensureSheetSize_(
    sheet,
    Math.max(sheet.getMaxRows(), CP_MODULE_CONFIG_LAYOUT.UT_FIRST_ROW),
    CP_MODULE_CONFIG_LAYOUT.COLUMNS
  );
  const rows = readModuleSignatureRows_(sheet);
  const currentFormulas = rows.map(function(row) {
    return [buildModuleRowSignatureFormula_(row.rowNumber)];
  });
  const appliedValues = rows.map(function(row) { return [row.signature]; });
  const changeFormulas = rows.map(function(row) {
    return [
      '=--(AP' + row.rowNumber + '<>AQ' + row.rowNumber + ')',
    ];
  });
  if (rows.length) {
    sheet.getRange(
      CP_MODULE_CONFIG_LAYOUT.UT_FIRST_ROW,
      CP_MODULE_CONFIG_LAYOUT.CURRENT_ROW_SIGNATURE_COLUMN,
      rows.length,
      1
    ).setFormulas(currentFormulas);
    sheet.getRange(
      CP_MODULE_CONFIG_LAYOUT.UT_FIRST_ROW,
      CP_MODULE_CONFIG_LAYOUT.APPLIED_ROW_SIGNATURE_COLUMN,
      rows.length,
      1
    ).setValues(appliedValues).setNumberFormat('@');
    sheet.getRange(
      CP_MODULE_CONFIG_LAYOUT.UT_FIRST_ROW,
      CP_MODULE_CONFIG_LAYOUT.CHANGE_FLAG_COLUMN,
      rows.length,
      1
    ).setFormulas(changeFormulas).setNumberFormat('0');
  }
  return buildModuleCanonicalSignatureFromRows_(rows);
}

function buildModuleCanonicalSignature_(sheet) {
  return buildModuleCanonicalSignatureFromRows_(readModuleSignatureRows_(sheet));
}

function buildModuleCanonicalSignatureFromRows_(rows) {
  return rows.filter(function(row) { return row.active; })
    .map(function(row) { return row.signature; })
    .join('\u2666');
}

function readModuleSignatureRows_(sheet) {
  const firstRow = CP_MODULE_CONFIG_LAYOUT.UT_FIRST_ROW;
  const rowCount = Math.max(1, sheet.getMaxRows() - firstRow + 1);
  const visible = sheet.getRange(firstRow, 1, rowCount, 5).getDisplayValues();
  const technical = sheet.getRange(
    firstRow,
    CP_MODULE_CONFIG_LAYOUT.UT_ID_COLUMN,
    rowCount,
    2
  ).getDisplayValues();
  return visible.map(function(values, index) {
    const rowNumber = firstRow + index;
    const fields = [
      rowNumber,
      technical[index][0],
      values[0],
      values[1],
      values[2],
      values[3],
      values[4],
      technical[index][1],
    ].map(normalizeModuleSignatureValue_);
    return {
      rowNumber: rowNumber,
      active: values.concat(technical[index]).some(function(value) {
        return normalizeModuleSignatureValue_(value) !== '';
      }),
      signature: fields.join('\u00a6'),
    };
  });
}

function normalizeModuleSignatureValue_(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\r\n/g, '\n');
}

function buildModuleRowSignatureFormula_(rowNumber) {
  return '=ROW()&"\u00a6"&AN' + rowNumber + '&"\u00a6"&A' + rowNumber +
    '&"\u00a6"&B' + rowNumber + '&"\u00a6"&C' + rowNumber + '&"\u00a6"&D' + rowNumber +
    '&"\u00a6"&E' + rowNumber + '&"\u00a6"&AO' + rowNumber;
}

function findModuleConfigRecordByActivityId_(spreadsheet, activityId) {
  const normalized = normalizeScheduleText_(activityId);
  return readModuleConfigRegistry_(spreadsheet).find(function(record) {
    return record.activityId === normalized;
  }) || null;
}

function findModuleConfigRecordBySheetId_(spreadsheet, sheetId) {
  return readModuleConfigRegistry_(spreadsheet).find(function(record) {
    return record.sheetId === Number(sheetId);
  }) || null;
}

function getSheetById_(spreadsheet, sheetId) {
  return spreadsheet.getSheets().find(function(sheet) {
    return sheet.getSheetId() === Number(sheetId);
  }) || null;
}

function appendModuleConfigRecord_(spreadsheet, record) {
  const rows = readModuleConfigRegistry_(spreadsheet).map(moduleConfigRecordToRow_);
  rows.push(moduleConfigRecordToRow_(record));
  writeModuleTable_(spreadsheet.getSheetByName(CP.SHEETS.MODULE_CONFIG),
    CP_MODULE_CONFIG_HEADERS, rows);
}

function updateModuleConfigRecordSignature_(spreadsheet, activityId, signature) {
  const records = readModuleConfigRegistry_(spreadsheet);
  const record = records.find(function(item) { return item.activityId === activityId; });
  if (!record) throw new Error('No se encuentra el registro interno de esta configuración.');
  record.appliedSignature = signature;
  writeModuleTable_(spreadsheet.getSheetByName(CP.SHEETS.MODULE_CONFIG),
    CP_MODULE_CONFIG_HEADERS, records.map(moduleConfigRecordToRow_));
}

function moduleConfigRecordToRow_(record) {
  return [record.activityId, String(record.sheetId), record.academicYear,
    record.createdAt, record.appliedSignature];
}

function readModulePlanRows_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(CP.SHEETS.MODULE_PLAN);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, CP_MODULE_PLAN_HEADERS.length)
    .getValues().filter(function(row) { return normalizeScheduleText_(row[0]); });
}

function replaceModulePlan_(spreadsheet, activityId, academicYear, assignments) {
  const rows = readModulePlanRows_(spreadsheet).filter(function(row) {
    return normalizeScheduleText_(row[1]) !== activityId ||
      normalizeScheduleText_(row[2]) !== academicYear;
  });
  assignments.forEach(function(assignment) {
    rows.push([
      [activityId, academicYear, assignment.dateKey, assignment.slotId].join('|'),
      activityId,
      academicYear,
      assignment.dateKey,
      assignment.slotId,
      assignment.ut.id,
    ]);
  });
  writeModuleTable_(spreadsheet.getSheetByName(CP.SHEETS.MODULE_PLAN),
    CP_MODULE_PLAN_HEADERS, rows);
}

function writeModuleTable_(sheet, headers, rows) {
  ensureSheetSize_(sheet, Math.max(2, rows.length + 1), headers.length);
  const clearRows = Math.max(1, sheet.getLastRow() - 1, rows.length);
  sheet.getRange(2, 1, clearRows, headers.length).clearContent();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(2, 1, Math.max(1, rows.length), headers.length).setNumberFormat('@');
}

function rollbackFailedModuleConfigCreation_(
  spreadsheet,
  sheet,
  previousConfigRows,
  previousPlanRows
) {
  const rollbackErrors = [];
  const sheetId = sheet ? sheet.getSheetId() : 0;
  try {
    const configSheet = spreadsheet.getSheetByName(CP.SHEETS.MODULE_CONFIG);
    if (configSheet) {
      writeModuleTable_(
        configSheet,
        CP_MODULE_CONFIG_HEADERS,
        previousConfigRows
      );
    }
  } catch (error) {
    rollbackErrors.push('registro: ' + (error && error.message ? error.message : error));
  }
  try {
    const planSheet = spreadsheet.getSheetByName(CP.SHEETS.MODULE_PLAN);
    if (planSheet) {
      writeModuleTable_(planSheet, CP_MODULE_PLAN_HEADERS, previousPlanRows);
    }
  } catch (error) {
    rollbackErrors.push('planificación: ' + (error && error.message ? error.message : error));
  }
  try {
    const currentSheet = sheetId ? getSheetById_(spreadsheet, sheetId) : null;
    if (currentSheet) spreadsheet.deleteSheet(currentSheet);
  } catch (error) {
    rollbackErrors.push('hoja: ' + (error && error.message ? error.message : error));
  }
  if (rollbackErrors.length) {
    console.error('Rollback incompleto de 4 Config: ' + rollbackErrors.join(' | '));
  }
  return rollbackErrors.length === 0;
}

function getModuleConfigurationStatuses_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const registry = readModuleConfigRegistry_(spreadsheet);
  return getModuleActivities_().map(function(activity) {
    const record = registry.find(function(item) { return item.activityId === activity.id; });
    const sheet = record ? getSheetById_(spreadsheet, record.sheetId) : null;
    if (!sheet) {
      return { label: getModuleDisplayName_(activity), status: 'pending', statusLabel: 'Sin configurar' };
    }
    const pending = record.appliedSignature !== buildModuleCanonicalSignature_(sheet);
    return {
      label: getModuleDisplayName_(activity),
      status: pending ? 'pending' : 'complete',
      statusLabel: pending ? 'Cambios pendientes' : 'Configurado',
    };
  });
}

function getModuleConfigActivityIdForSheet_(sheet) {
  if (!sheet) return '';
  const record = findModuleConfigRecordBySheetId_(sheet.getParent(), sheet.getSheetId());
  return record ? record.activityId : '';
}

function deleteManagedModuleConfigsForNewCourse_(spreadsheet) {
  const configSheet = spreadsheet.getSheetByName(CP.SHEETS.MODULE_CONFIG);
  const planSheet = spreadsheet.getSheetByName(CP.SHEETS.MODULE_PLAN);
  if (!configSheet && !planSheet) return 0;
  assertModuleConfigStructureReady_(spreadsheet);
  const records = readModuleConfigRegistry_(spreadsheet);
  const seenActivities = {};
  const seenSheets = {};
  records.forEach(function(record) {
    if (seenActivities[record.activityId] || seenSheets[record.sheetId]) {
      throw new Error(
        'El registro de configuraciones contiene identidades duplicadas. ' +
        'No se ha eliminado ninguna hoja.'
      );
    }
    seenActivities[record.activityId] = true;
    seenSheets[record.sheetId] = true;
  });

  const deletedActivities = {};
  let deletedSheets = 0;
  try {
    records.forEach(function(record) {
      const sheet = getSheetById_(spreadsheet, record.sheetId);
      if (sheet) {
        spreadsheet.deleteSheet(sheet);
        deletedSheets += 1;
      }
      deletedActivities[record.activityId] = true;
    });
  } catch (error) {
    const remainingRecords = records.filter(function(record) {
      return !deletedActivities[record.activityId];
    });
    const remainingPlan = readModulePlanRows_(spreadsheet).filter(function(row) {
      return !deletedActivities[normalizeScheduleText_(row[1])];
    });
    writeModuleTable_(configSheet, CP_MODULE_CONFIG_HEADERS,
      remainingRecords.map(moduleConfigRecordToRow_));
    writeModuleTable_(planSheet, CP_MODULE_PLAN_HEADERS, remainingPlan);
    throw new Error(
      'No se han podido eliminar todas las configuraciones del curso anterior. ' +
      'Los registros ya eliminados se han limpiado y la copia de seguridad conserva el curso completo.'
    );
  }
  writeModuleTable_(configSheet, CP_MODULE_CONFIG_HEADERS, []);
  writeModuleTable_(planSheet, CP_MODULE_PLAN_HEADERS, []);
  return deletedSheets;
}
