const CP_MODULE_CONFIG_HEADERS = Object.freeze([
  'actividad_id', 'sheet_id', 'curso_academico', 'created_at', 'applied_signature',
]);
const CP_MODULE_PLAN_HEADERS = Object.freeze([
  'plan_id', 'actividad_id', 'curso_academico', 'fecha', 'tramo_id', 'ut_id',
]);
const CP_MODULE_CONFIG_LAYOUT = Object.freeze({
  COLUMNS: 42,
  CALENDAR_COLUMNS: 39,
  FIRST_MONTH_ROW: 7,
  MONTH_ROWS: 8,
  MONTH_COLUMNS: 7,
  MONTH_GAP_ROWS: 1,
  MONTH_GAP_COLUMNS: 1,
  UT_HEADER_ROW: 27,
  UT_FIRST_ROW: 28,
  INITIAL_UT_ROWS: 50,
  UT_ID_COLUMN: 40,
  EVALUATION_ID_COLUMN: 41,
  APPLIED_SIGNATURE_COLUMN: 41,
  CURRENT_SIGNATURE_COLUMN: 42,
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
      let prerequisiteError = '';
      if (!registeredSheet) {
        try {
          validateModuleConfigPrerequisites_(spreadsheet, activity);
        } catch (error) {
          prerequisiteError = error && error.message
            ? error.message
            : 'La configuración del módulo está incompleta.';
        }
      }
      return {
        id: activity.id,
        label: getModuleDialogLabel_(activity),
        configured: Boolean(record && registeredSheet),
        sheetName: registeredSheet ? registeredSheet.getName() : '',
        prerequisiteError: prerequisiteError,
      };
    }),
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
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const activity = getModuleActivityById_(activityId);
    if (!activity) {
      throw new Error('El módulo seleccionado ya no existe en la configuración del Horario.');
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

    let sheet = null;
    try {
      const sheetName = buildUniqueModuleConfigSheetName_(spreadsheet, activity);
      sheet = spreadsheet.insertSheet(sheetName);
      renderNewModuleConfigSheet_(sheet, activity, context);
      SpreadsheetApp.flush();
      const signature = readModuleCurrentSignature_(sheet, true);
      sheet.getRange(2, CP_MODULE_CONFIG_LAYOUT.APPLIED_SIGNATURE_COLUMN).setValue(signature);
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
      if (sheet && !findModuleConfigRecordBySheetId_(spreadsheet, sheet.getSheetId())) {
        spreadsheet.deleteSheet(sheet);
      }
      throw error;
    }
  } finally {
    lock.releaseLock();
  }
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
    throw new Error(
      'Antes de crear esta configuración, completa: ' + missing.join('; ') + '.'
    );
  }

  const timeZone = spreadsheet.getSpreadsheetTimeZone();
  let previousEnd = null;
  evaluations.forEach(function(evaluation) {
    if (previousEnd && compareCalendarDates_(evaluation.endDate, previousEnd, timeZone) <= 0) {
      throw new Error('Las fechas finales de las evaluaciones deben estar en orden cronológico.');
    }
    if (compareCalendarDates_(evaluation.endDate, type.startDate, timeZone) < 0 ||
        compareCalendarDates_(evaluation.endDate, type.endDate, timeZone) > 0) {
      throw new Error('Las fechas finales de evaluación deben estar dentro del periodo lectivo.');
    }
    previousEnd = evaluation.endDate;
  });

  return {
    academicYear: getConfiguredAcademicYear_(spreadsheet),
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
  sheet.hideColumns(CP_MODULE_CONFIG_LAYOUT.UT_ID_COLUMN, 3);
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
    .setFormula('=IF($AP$2=$AO$2,"\u2713 Calendario actualizado","\u26a0 Hay cambios pendientes de aplicar al calendario")')
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
    sheet.setColumnWidth(column, [8, 16, 24, 32].indexOf(column) !== -1 ? 10 : 31);
  }
  sheet.setColumnWidths(40, 3, 40);
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
    const lines = item.order.map(function(id) {
      const unit = item.units[id];
      return unit.code + ': ' + unit.count + ' h';
    });
    const unassigned = sessionCountByDate[dateKey] - item.assigned;
    if (unassigned > 0) lines.push('Sin distribuir: ' + unassigned + ' h');
    let background = '';
    if (item.order.length > 1) {
      background = model.theme && model.theme.colors.mixedDay
        ? model.theme.colors.mixedDay
        : CP_MODULE_MIXED_DAY_COLOR;
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
    'Horas equivale a sesiones docentes. Añade filas si necesitas más UT; Recalcular asignará sus IDs y colores.')
    .setBackground(theme.colors.surface)
    .setFontColor(theme.colors.mutedText)
    .setHorizontalAlignment('left');
  sheet.getRange(CP_MODULE_CONFIG_LAYOUT.UT_HEADER_ROW, 1, 1, 5)
    .setValues([['UT', 'Nombre', 'Color', 'Horas', 'Evaluación']])
    .setBackground(theme.colors.secondary)
    .setFontColor(theme.colors.onSecondary)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange(firstRow, 1, rowCount, 5)
    .setBackground(theme.colors.surface)
    .setFontColor(theme.colors.text)
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, theme.colors.border, SpreadsheetApp.BorderStyle.SOLID);
  sheet.setColumnWidth(1, 70);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 95);
  sheet.setColumnWidth(4, 75);
  sheet.setColumnWidth(5, 160);
  sheet.getRange(firstRow, 3, rowCount, 1).setNumberFormat('@');
  sheet.getRange(firstRow, 4, rowCount, 1).setNumberFormat('0');
  sheet.getRange(firstRow, CP_MODULE_CONFIG_LAYOUT.UT_ID_COLUMN, rowCount, 2)
    .setNumberFormat('@');

  const evaluationNames = context.evaluations.map(function(evaluation) { return evaluation.name; });
  sheet.getRange(firstRow, 5, rowCount, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(evaluationNames, true).setAllowInvalid(false).build()
  );
  sheet.getRange(firstRow, 3, rowCount, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(CP_MODULE_UT_COLORS, true).setAllowInvalid(true).build()
  );
  sheet.getRange(firstRow, 4, rowCount, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).build()
  );
  const rules = CP_MODULE_UT_COLORS.map(function(color) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(color)
      .setBackground(color)
      .setFontColor(getAccessibleTextColor_(color))
      .setRanges([sheet.getRange(firstRow, 3, rowCount, 1)])
      .build();
  });
  sheet.setConditionalFormatRules(rules);

  sheet.getRange(1, CP_MODULE_CONFIG_LAYOUT.UT_ID_COLUMN).setValue('ut_id');
  sheet.getRange(1, CP_MODULE_CONFIG_LAYOUT.EVALUATION_ID_COLUMN).setValue('evaluation_id');
  sheet.getRange(1, CP_MODULE_CONFIG_LAYOUT.CURRENT_SIGNATURE_COLUMN).setValue('current_signature');
  sheet.getRange(2, CP_MODULE_CONFIG_LAYOUT.CURRENT_SIGNATURE_COLUMN).setFormula(
    '=TEXTJOIN("\u2666",TRUE,ARRAYFORMULA(IF((LEN(A' + firstRow + ':A)+LEN(B' + firstRow +
    ':B)+LEN(C' + firstRow + ':C)+LEN(D' + firstRow + ':D)+LEN(E' + firstRow +
    ':E)+LEN(AN' + firstRow + ':AN)+LEN(AO' + firstRow + ':AO))=0,"",ROW(A' + firstRow +
    ':A)&"\u00a6"&AN' + firstRow + ':AN&"\u00a6"&A' + firstRow + ':A&"\u00a6"&B' + firstRow +
    ':B&"\u00a6"&C' + firstRow + ':C&"\u00a6"&D' + firstRow + ':D&"\u00a6"&E' + firstRow +
    ':E&"\u00a6"&AO' + firstRow + ':AO)))'
  );

  renderModuleHoursSummary_(sheet, activity, context, 27);
}

function renderModuleHoursSummary_(sheet, activity, context, startRow) {
  const theme = getActiveTheme_(sheet.getParent());
  sheet.getRange(startRow, 8, 1, 6).merge().setValue('RESUMEN DE HORAS')
    .setBackground(theme.colors.secondary)
    .setFontColor(theme.colors.onSecondary)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  let row = startRow + 1;
  context.evaluations.forEach(function(evaluation) {
    sheet.getRange(row, 8, 1, 3).merge().setValue(evaluation.name);
    sheet.getRange(row, 11, 1, 3).merge().setFormula(
      '=SUMIF($E$' + CP_MODULE_CONFIG_LAYOUT.UT_FIRST_ROW + ':$E,"' +
      escapeModuleFormulaText_(evaluation.name) + '",$D$' + CP_MODULE_CONFIG_LAYOUT.UT_FIRST_ROW + ':$D)'
    ).setNumberFormat('0');
    row += 1;
  });
  sheet.getRange(row, 8, 1, 3).merge().setValue('Horas previstas totales').setFontWeight('bold');
  sheet.getRange(row, 11, 1, 3).merge()
    .setFormula('=SUM($D$' + CP_MODULE_CONFIG_LAYOUT.UT_FIRST_ROW + ':$D)')
    .setNumberFormat('0').setFontWeight('bold');
  const totalRow = row;
  row += 1;
  sheet.getRange(row, 8, 1, 3).merge().setValue('Sesiones lectivas disponibles');
  sheet.getRange(row, 11, 1, 3).merge().setValue(
    buildRealModuleSessions_(sheet.getParent(), context.type, activity).length
  ).setNumberFormat('0');
  const availableRow = row;
  row += 1;
  sheet.getRange(row, 8, 2, 6).merge().setFormula(
    '=IF(K' + totalRow + '=K' + availableRow + ',"\u2713 Planificación completa",' +
    'IF(K' + totalRow + '>K' + availableRow + ',"\u26a0 Exceso de "&(K' + totalRow + '-K' + availableRow +
    ')&" h","\u26a0 Quedan "&(K' + availableRow + '-K' + totalRow + ')&" sesiones sin distribuir"))'
  ).setBackground(theme.colors.surface)
    .setFontColor(theme.colors.warning)
    .setFontWeight('bold')
    .setWrap(true)
    .setHorizontalAlignment('center');
  row += 3;
  sheet.getRange(row, 8, 1, 6).merge().setValue('Resultado del último recálculo')
    .setBackground(theme.colors.muted)
    .setFontWeight('bold');
  sheet.getRange(row + 1, 8, 5, 6).merge().setValue('Todavía no se ha recalculado.')
    .setBackground(theme.colors.surface)
    .setFontColor(theme.colors.mutedText)
    .setWrap(true)
    .setVerticalAlignment('top');
}

function escapeModuleFormulaText_(value) {
  return String(value || '').replace(/"/g, '""');
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
    if (!isTeachingDayForType_(date, type, events, timeZone)) continue;
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
  try {
    const result = recalculateActiveModuleConfig_();
    SpreadsheetApp.getUi().alert(CP.PROJECT_NAME, result.message, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      CP.PROJECT_NAME,
      error && error.message ? error.message : 'No se ha podido recalcular la configuración.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
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
        'Sitúate en una hoja 4 Config gestionada y vuelve a ejecutar Recalcular.'
      );
    }
    const academicYear = getConfiguredAcademicYear_(spreadsheet);
    if (record.academicYear !== academicYear) {
      throw new Error('Esta configuración pertenece a otro curso académico.');
    }
    const activity = getModuleActivityById_(record.activityId);
    if (!activity) throw new Error('La actividad asociada a esta configuración ya no existe.');
    const context = validateModuleConfigPrerequisites_(spreadsheet, activity);
    const units = readAndNormalizeModuleUnits_(sheet, context.evaluations);
    if (!units.length) throw new Error('Define al menos una UT con nombre, horas y evaluación.');
    const sessions = buildRealModuleSessions_(spreadsheet, context.type, activity);
    const assignments = assignModuleUnitsToSessions_(sessions, units);
    const warnings = buildModulePlanningWarnings_(sessions, assignments, units, context);
    const oldPlanRows = readModulePlanRows_(spreadsheet);
    try {
      replaceModulePlan_(spreadsheet, record.activityId, academicYear, assignments);
      renderModuleConfigCalendar_(sheet, activity, context, sessions, assignments);
      refreshModuleConfigUtSupport_(sheet, activity, context);
      updateModuleRecalculationSummary_(
        sheet, context, sessions.length, assignments.length, warnings
      );
      SpreadsheetApp.flush();
      const signature = readModuleCurrentSignature_(sheet, false);
      updateModuleConfigRecordSignature_(spreadsheet, record.activityId, signature);
      sheet.getRange(2, CP_MODULE_CONFIG_LAYOUT.APPLIED_SIGNATURE_COLUMN).setValue(signature);
      spreadsheet.toast('Configuración del módulo recalculada.', CP.PROJECT_NAME, 5);
      return {
        message: warnings.length
          ? 'Recalculado con avisos:\n\n' + warnings.join('\n')
          : 'Planificación recalculada: ' + assignments.length +
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

function readAndNormalizeModuleUnits_(sheet, evaluations) {
  const firstRow = CP_MODULE_CONFIG_LAYOUT.UT_FIRST_ROW;
  const rowCount = Math.max(1, sheet.getMaxRows() - firstRow + 1);
  const visible = sheet.getRange(firstRow, 1, rowCount, 5).getValues();
  const ids = sheet.getRange(firstRow, CP_MODULE_CONFIG_LAYOUT.UT_ID_COLUMN, rowCount, 2).getValues();
  const evaluationByName = evaluations.reduce(function(map, evaluation) {
    map[normalizeScheduleText_(evaluation.name)] = evaluation;
    return map;
  }, {});
  const usedCodes = {};
  const usedIds = {};
  const units = [];
  let changed = false;
  const inactiveRowsWithMetadata = [];
  visible.forEach(function(row, index) {
    const codeValue = normalizeScheduleText_(row[0]);
    const name = normalizeScheduleText_(row[1]);
    const colorValue = normalizeScheduleText_(row[2]).toUpperCase();
    const hoursValue = row[3];
    const evaluationName = normalizeScheduleText_(row[4]);
    const active = Boolean(codeValue || name || evaluationName || hoursValue !== '' && hoursValue !== null);
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
    const evaluation = evaluationByName[evaluationName];
    if (!evaluation) {
      throw new Error('Selecciona una evaluación válida para ' + code + '.');
    }
    if (colorValue && !CP_SCHEDULE_COLOR_PATTERN.test(colorValue)) {
      throw new Error('El color de ' + code + ' debe tener el formato #RRGGBB.');
    }
    const color = colorValue || CP_MODULE_UT_COLORS[units.length % CP_MODULE_UT_COLORS.length];
    const id = normalizeScheduleText_(ids[index][0]) || createCalendarRecordId_('UT');
    if (usedCodes[code.toUpperCase()]) throw new Error('El código de UT ' + code + ' está repetido.');
    if (usedIds[id]) throw new Error('Dos UT comparten la misma identidad interna.');
    usedCodes[code.toUpperCase()] = true;
    usedIds[id] = true;
    units.push({
      id: id,
      code: code,
      name: name,
      color: color,
      hours: hours,
      evaluationId: evaluation.id,
      evaluationName: evaluation.name,
      sourceRow: firstRow + index,
    });
    if (code !== codeValue || color !== colorValue || id !== normalizeScheduleText_(ids[index][0]) ||
        evaluation.id !== normalizeScheduleText_(ids[index][1])) changed = true;
  });
  if (changed) {
    units.forEach(function(unit) {
      sheet.getRange(unit.sourceRow, 1).setValue(unit.code);
      sheet.getRange(unit.sourceRow, 3).setValue(unit.color).setBackground(unit.color)
        .setFontColor(getAccessibleTextColor_(unit.color));
      sheet.getRange(unit.sourceRow, CP_MODULE_CONFIG_LAYOUT.UT_ID_COLUMN).setValue(unit.id);
      sheet.getRange(unit.sourceRow, CP_MODULE_CONFIG_LAYOUT.EVALUATION_ID_COLUMN)
        .setValue(unit.evaluationId);
    });
  }
  if (inactiveRowsWithMetadata.length) {
    const colors = getActiveTheme_(sheet.getParent()).colors;
    inactiveRowsWithMetadata.forEach(function(row) {
      sheet.getRange(row, CP_MODULE_CONFIG_LAYOUT.UT_ID_COLUMN, 1, 2).clearContent();
      sheet.getRange(row, 3).setBackground(colors.surface).setFontColor(colors.text);
    });
  }
  return units;
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
  if (plannedHours > sessions.length) {
    warnings.push('Sobran ' + (plannedHours - sessions.length) + ' horas previstas sin fecha disponible.');
  } else if (plannedHours < sessions.length) {
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
  const mismatches = {};
  assignments.forEach(function(assignment) {
    const actual = evaluationByDate(assignment.date);
    if (!actual || actual.id !== assignment.ut.evaluationId) {
      mismatches[assignment.ut.code] = true;
    }
  });
  if (Object.keys(mismatches).length) {
    warnings.push(
      'Revisa la evaluación de estas UT: ' + Object.keys(mismatches).join(', ') +
      '. Su distribución cruza las fechas configuradas.'
    );
  }
  return warnings;
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
  const evaluationNames = context.evaluations.map(function(evaluation) { return evaluation.name; });
  sheet.getRange(firstRow, 5, rowCount, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(evaluationNames, true)
      .setAllowInvalid(false).build()
  );
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

function readModuleCurrentSignature_(sheet, allowEmpty) {
  const signature = String(
    sheet.getRange(2, CP_MODULE_CONFIG_LAYOUT.CURRENT_SIGNATURE_COLUMN).getDisplayValue() || ''
  );
  if ((!allowEmpty && !signature) || signature.charAt(0) === '#') {
    throw new Error(
      'No se ha podido verificar la firma de cambios de la tabla de UT. ' +
      'Revisa las fórmulas de la hoja.'
    );
  }
  return signature;
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

function getModuleConfigurationStatuses_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const registry = readModuleConfigRegistry_(spreadsheet);
  return getModuleActivities_().map(function(activity) {
    const record = registry.find(function(item) { return item.activityId === activity.id; });
    const sheet = record ? getSheetById_(spreadsheet, record.sheetId) : null;
    if (!sheet) {
      return { label: getModuleDisplayName_(activity), status: 'pending', statusLabel: 'Sin configurar' };
    }
    const applied = String(sheet.getRange(2, CP_MODULE_CONFIG_LAYOUT.APPLIED_SIGNATURE_COLUMN)
      .getDisplayValue() || '');
    const current = String(sheet.getRange(2, CP_MODULE_CONFIG_LAYOUT.CURRENT_SIGNATURE_COLUMN)
      .getDisplayValue() || '');
    const pending = applied !== current;
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
