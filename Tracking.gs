const CP_TRACKING_HEADERS = Object.freeze([
  'Fecha', 'UT', 'Plan previsto', 'Actividades realizadas',
  'Actual', 'Acum.', 'Total', 'Mejoras',
]);
const CP_TRACKING_LAYOUT = Object.freeze({
  VISIBLE_COLUMNS: 8,
  TOTAL_COLUMNS: 12,
  SNAPSHOT_FIRST_COLUMN: 10,
  HEADER_ROW: 1,
  FIRST_DATA_ROW: 2,
});
const CP_TRACKING_SEPARATOR_COLORS = Object.freeze({
  EVALUATION: '#B91C1C',
  BREAK: '#1D4ED8',
});

function abrirCreacionSeguimientoEvaluacion() {
  const template = HtmlService.createTemplateFromFile('UiDialogTracking');
  try {
    template.trackingData = getTrackingDialogData_();
  } catch (error) {
    console.error('Error al preparar Seguimiento y Evaluación: ' +
      (error && error.stack ? error.stack : error));
    template.trackingData = {
      modules: [],
      selectedActivityId: '',
      errorMessage: error && error.message ? error.message :
        'No se han podido comprobar los módulos disponibles.',
    };
  }
  setCommonUiTemplateData_(template);
  const output = template.evaluate()
    .setWidth(CP.UI.MODULE_TRACKING_DIALOG_WIDTH)
    .setHeight(CP.UI.MODULE_TRACKING_DIALOG_HEIGHT);
  SpreadsheetApp.getUi().showModalDialog(output, CP.MENU.MODULE_TRACKING_CREATE);
}

function getTrackingDialogData_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = spreadsheet.getActiveSheet();
  const activeRecord = activeSheet
    ? findModuleConfigRecordBySheetId_(spreadsheet, activeSheet.getSheetId())
    : null;
  const records = readModuleConfigRegistry_(spreadsheet);
  const modules = records.map(function(record) {
    const configSheet = getSheetById_(spreadsheet, record.sheetId);
    const activity = getModuleActivityById_(record.activityId);
    if (!configSheet || !activity || !isRegisteredModuleConfigSheet_(configSheet)) return null;
    try {
      const context = validateModuleConfigPrerequisites_(spreadsheet, activity);
      if (context.academicYear !== record.academicYear) return null;
    } catch (error) {
      return null;
    }
    const trackingSheet = record.trackingSheetId
      ? getSheetById_(spreadsheet, record.trackingSheetId) : null;
    const evaluationSheet = record.evaluationSheetId
      ? getSheetById_(spreadsheet, record.evaluationSheetId) : null;
    if (isRegisteredModuleTrackingSheet_(trackingSheet) && evaluationSheet) return null;
    const planRows = getModulePlanRowsForRecord_(spreadsheet, record);
    if (!planRows.length || record.appliedSignature !== buildModuleCanonicalSignature_(configSheet)) {
      return null;
    }
    return {
      id: record.activityId,
      label: getModuleDisplayName_(activity),
      hasTracking: isRegisteredModuleTrackingSheet_(trackingSheet),
      hasEvaluation: Boolean(evaluationSheet),
    };
  }).filter(Boolean);
  return {
    modules: modules,
    selectedActivityId: activeRecord && modules.some(function(item) {
      return item.id === activeRecord.activityId;
    }) ? activeRecord.activityId : (modules[0] ? modules[0].id : ''),
  };
}

function crearSeguimientoEvaluacion(activityId) {
  try {
    return Object.assign({ ok: true }, createTrackingAndEvaluation_(activityId));
  } catch (error) {
    console.error('Error al crear Seguimiento y Evaluación: ' +
      (error && error.stack ? error.stack : error));
    return {
      ok: false,
      expected: Boolean(error && error.moduleConfigExpected),
      rollbackComplete: error && error.moduleConfigRollbackComplete !== false,
      message: error && error.moduleConfigExpected
        ? error.message
        : 'No se han podido crear Seguimiento y Evaluación.',
    };
  }
}

function createTrackingAndEvaluation_(activityId) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    ensureModuleConfigTechnicalStructure_();
    cleanupOrphanModuleConfigs_(spreadsheet);
    const record = findModuleConfigRecordByActivityId_(spreadsheet, activityId);
    const activity = getModuleActivityById_(activityId);
    if (!record || !activity) {
      throwModuleConfigExpectedError_('El módulo seleccionado ya no tiene una 4 Config válida.');
    }
    const configSheet = getSheetById_(spreadsheet, record.sheetId);
    if (!isRegisteredModuleConfigSheet_(configSheet)) {
      throwModuleConfigExpectedError_('La 4 Config registrada no conserva una estructura válida.');
    }
    const planRows = getModulePlanRowsForRecord_(spreadsheet, record);
    if (!planRows.length || record.appliedSignature !== buildModuleCanonicalSignature_(configSheet)) {
      throwModuleConfigExpectedError_(
        'Aplica primero la planificación con Módulos → Recalcular configuración del módulo.'
      );
    }
    const context = validateModuleConfigPrerequisites_(spreadsheet, activity);
    if (context.academicYear !== record.academicYear) {
      throwModuleConfigExpectedError_('La 4 Config pertenece a otro curso académico.');
    }
    const previousRows = readModuleConfigRegistry_(spreadsheet).map(moduleConfigRecordToRow_);
    const existingTracking = record.trackingSheetId
      ? getSheetById_(spreadsheet, record.trackingSheetId) : null;
    const existingEvaluation = record.evaluationSheetId
      ? getSheetById_(spreadsheet, record.evaluationSheetId) : null;
    const trackingValid = isRegisteredModuleTrackingSheet_(existingTracking);
    const evaluationValid = Boolean(existingEvaluation);
    const createdSheets = [];
    try {
      if (!trackingValid) {
        const trackingName = buildManagedModuleSheetName_(spreadsheet, '5 Seg', activity);
        const trackingSheet = spreadsheet.insertSheet(trackingName);
        createdSheets.push(trackingSheet);
        renderNewTrackingSheet_(trackingSheet, activity, context, configSheet, planRows);
        record.trackingSheetId = trackingSheet.getSheetId();
      }
      if (!evaluationValid) {
        const evaluationName = buildManagedModuleSheetName_(spreadsheet, '6 Eval', activity);
        const evaluationSheet = spreadsheet.insertSheet(evaluationName);
        createdSheets.push(evaluationSheet);
        prepareEmptyEvaluationSheet_(evaluationSheet);
        record.evaluationSheetId = evaluationSheet.getSheetId();
      }
      const records = readModuleConfigRegistry_(spreadsheet).map(function(item) {
        return item.activityId === record.activityId ? record : item;
      });
      writeModuleTable_(spreadsheet.getSheetByName(CP.SHEETS.MODULE_CONFIG),
        CP_MODULE_CONFIG_HEADERS, records.map(moduleConfigRecordToRow_));
      reorderManagedVisibleSheets_(spreadsheet);
      actualizarIndicePortada();
      const trackingSheet = getSheetById_(spreadsheet, record.trackingSheetId);
      spreadsheet.setActiveSheet(trackingSheet);
      return {
        trackingSheetName: trackingSheet.getName(),
        evaluationSheetName: getSheetById_(spreadsheet, record.evaluationSheetId).getName(),
        trackingCreated: !trackingValid,
        evaluationCreated: !evaluationValid,
        message: buildTrackingCreationMessage_(!trackingValid, !evaluationValid),
      };
    } catch (error) {
      const rollbackErrors = [];
      createdSheets.reverse().forEach(function(sheet) {
        try {
          const current = getSheetById_(spreadsheet, sheet.getSheetId());
          if (current) spreadsheet.deleteSheet(current);
        } catch (rollbackError) {
          rollbackErrors.push('hoja: ' + rollbackError.message);
        }
      });
      try {
        writeModuleTable_(spreadsheet.getSheetByName(CP.SHEETS.MODULE_CONFIG),
          CP_MODULE_CONFIG_HEADERS, previousRows);
      } catch (rollbackError) {
        rollbackErrors.push('registro: ' + rollbackError.message);
      }
      error.moduleConfigRollbackComplete = rollbackErrors.length === 0;
      throw error;
    }
  } finally {
    lock.releaseLock();
  }
}

function buildTrackingCreationMessage_(trackingCreated, evaluationCreated) {
  if (trackingCreated && evaluationCreated) return 'Seguimiento y Evaluación creados correctamente.';
  if (trackingCreated) return 'Seguimiento creado; se ha conservado la Evaluación existente.';
  if (evaluationCreated) return 'Evaluación creada; se ha conservado intacto el Seguimiento existente.';
  return 'Seguimiento y Evaluación ya existían.';
}

function buildManagedModuleSheetName_(spreadsheet, family, activity) {
  const displayName = getModuleDisplayName_(activity) || activity.id;
  let name = (family + ' ' + displayName)
    .replace(/[\\\/\?\*\[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100).trim();
  if (!name) name = family + ' Módulo';
  if (spreadsheet.getSheetByName(name)) {
    throwModuleConfigExpectedError_(
      'Ya existe una hoja llamada «' + name + '» sin una identidad gestionada válida. ' +
      'Renómbrala o elimínala antes de continuar.'
    );
  }
  return name;
}

function getModulePlanRowsForRecord_(spreadsheet, record) {
  return readModulePlanRows_(spreadsheet).filter(function(row) {
    return normalizeScheduleText_(row[1]) === record.activityId &&
      normalizeScheduleText_(row[2]) === record.academicYear;
  });
}

function buildTrackingDataRows_(planRows, units, timeZone) {
  const unitById = units.reduce(function(map, unit) { map[unit.id] = unit; return map; }, {});
  const groups = {};
  const order = [];
  planRows.forEach(function(row) {
    const dateKey = normalizeScheduleText_(row[3]);
    const unit = unitById[normalizeScheduleText_(row[5])];
    if (!dateKey || !unit) return;
    const key = dateKey + '|' + unit.id;
    if (!groups[key]) {
      groups[key] = {
        kind: 'data',
        dateKey: dateKey,
        date: parseCalendarDate_(dateKey, timeZone, 'la fecha de seguimiento', true),
        unitCode: unit.code,
        actual: 0,
        firstIndex: order.length,
      };
      order.push(key);
    }
    groups[key].actual += 1;
  });
  return order.map(function(key) { return groups[key]; }).sort(function(first, second) {
    return first.dateKey.localeCompare(second.dateKey) || first.firstIndex - second.firstIndex;
  });
}

function buildTrackingTimeline_(spreadsheet, context, dataRows) {
  const timeZone = spreadsheet.getSpreadsheetTimeZone();
  const items = dataRows.slice();
  const periods = getEvaluationPeriodsForType_(context.type, timeZone);
  periods.forEach(function(period, index) {
    const first = dataRows.find(function(row) {
      return compareCalendarDates_(row.date, period.startDate, timeZone) >= 0 &&
        compareCalendarDates_(row.date, period.endDate, timeZone) <= 0;
    });
    if (first) items.push(buildTrackingSeparator_(first.dateKey, period.name, 'evaluation', index));
  });
  const applicableEvents = getAllCalendarEvents_().filter(function(event) {
    return !event.typeIds.length || event.typeIds.indexOf(context.type.id) !== -1;
  });
  [
    { pattern: /navidad/i, label: 'NAVIDAD', order: 20 },
    { pattern: /semana santa/i, label: 'SEMANA SANTA', order: 21 },
  ].forEach(function(definition) {
    const matches = applicableEvents.filter(function(event) {
      return definition.pattern.test(normalizeCalendarText_(event.description));
    }).sort(function(first, second) {
      return compareCalendarDates_(first.startDate, second.startDate, timeZone);
    });
    if (matches.length && isTrackingMarkerWithinPeriod_(matches[0].startDate, context, timeZone)) {
      items.push(buildTrackingSeparator_(
        Utilities.formatDate(matches[0].startDate, timeZone, 'yyyy-MM-dd'),
        definition.label, 'break', definition.order
      ));
    }
  });
  if (context.type.practicesStart instanceof Date &&
      isTrackingMarkerWithinPeriod_(context.type.practicesStart, context, timeZone)) {
    items.push(buildTrackingSeparator_(
      Utilities.formatDate(context.type.practicesStart, timeZone, 'yyyy-MM-dd'),
      'FEOE', 'break', 30
    ));
  }
  return items.sort(function(first, second) {
    return first.dateKey.localeCompare(second.dateKey) ||
      trackingItemOrder_(first) - trackingItemOrder_(second) ||
      (first.semanticOrder || 0) - (second.semanticOrder || 0) ||
      (first.firstIndex || 0) - (second.firstIndex || 0);
  });
}

function buildTrackingSeparator_(dateKey, label, separatorType, semanticOrder) {
  return {
    kind: 'separator', dateKey: dateKey, label: label,
    separatorType: separatorType, semanticOrder: semanticOrder,
  };
}

function trackingItemOrder_(item) {
  return item.kind === 'separator' ? 0 : 1;
}

function isTrackingMarkerWithinPeriod_(date, context, timeZone) {
  const lastEvaluation = context.evaluations[context.evaluations.length - 1];
  return compareCalendarDates_(date, context.type.startDate, timeZone) >= 0 &&
    compareCalendarDates_(date, lastEvaluation.endDate, timeZone) <= 0;
}

function renderNewTrackingSheet_(sheet, activity, context, configSheet, planRows) {
  const units = readAndNormalizeModuleUnits_(configSheet, context.evaluations,
    { writeBack: false });
  const timeZone = sheet.getParent().getSpreadsheetTimeZone();
  const dataRows = buildTrackingDataRows_(planRows, units, timeZone);
  if (!dataRows.length) {
    throwModuleConfigExpectedError_('La planificación aplicada no contiene sesiones asignadas a UT.');
  }
  const timeline = buildTrackingTimeline_(sheet.getParent(), context, dataRows);
  const requiredRows = Math.max(2, timeline.length + 1, units.length + 1);
  ensureSheetSize_(sheet, requiredRows, CP_TRACKING_LAYOUT.TOTAL_COLUMNS);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.clear();
  sheet.setConditionalFormatRules([]);
  const rows = [CP_TRACKING_HEADERS].concat(timeline.map(function(item) {
    return item.kind === 'separator'
      ? [item.label, '', '', '', '', '', '', '']
      : [item.date, item.unitCode, '', '', item.actual, '', '', ''];
  }));
  sheet.getRange(1, 1, rows.length, CP_TRACKING_LAYOUT.VISIBLE_COLUMNS).setValues(rows);
  writeTrackingSnapshot_(sheet, units);
  timeline.forEach(function(item, index) {
    if (item.kind === 'separator') {
      sheet.getRange(index + 2, 1, 1, CP_TRACKING_LAYOUT.VISIBLE_COLUMNS).merge();
    }
  });
  formatAndRepairTrackingSheet_(sheet);
  trimSheetToBounds_(sheet, requiredRows, CP_TRACKING_LAYOUT.TOTAL_COLUMNS);
}

function writeTrackingSnapshot_(sheet, units) {
  const rows = [['UT', 'Total inicial', 'Color']].concat(units.map(function(unit) {
    return [unit.code, unit.hours, unit.color];
  }));
  sheet.getRange(1, CP_TRACKING_LAYOUT.SNAPSHOT_FIRST_COLUMN, rows.length, 3).setValues(rows);
}

function formatAndRepairTrackingSheet_(sheet) {
  const theme = getActiveTheme_(sheet.getParent());
  const lastRow = Math.max(1, sheet.getLastRow());
  const snapshot = readTrackingSnapshot_(sheet);
  if (!snapshot.length) {
    throw new Error('El Seguimiento no conserva su snapshot interno de UT.');
  }
  ensureSheetSize_(sheet, lastRow, CP_TRACKING_LAYOUT.TOTAL_COLUMNS);
  sheet.getRange(1, 1, 1, CP_TRACKING_LAYOUT.VISIBLE_COLUMNS)
    .setValues([CP_TRACKING_HEADERS])
    .setBackground(theme.colors.primary).setFontColor(theme.colors.onPrimary)
    .setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  setTrackingHeaderNotes_(sheet);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(0);
  sheet.setHiddenGridlines(true);
  sheet.setTabColor(theme.colors.secondary);
  applyTrackingDimensions_(sheet, lastRow);

  const dataRows = getTrackingDataRowNumbers_(sheet);
  const separator = getModuleFormulaSeparator_(sheet.getParent());
  const snapshotLastRow = snapshot.length + 1;
  dataRows.forEach(function(row) {
    sheet.getRange(row, 6).setFormula(buildTrackingAccumulatedFormula_(row, separator));
    sheet.getRange(row, 7).setFormula(
      buildTrackingTotalFormula_(row, snapshotLastRow, separator)
    );
  });
  applyTrackingValidations_(sheet, dataRows, snapshot.map(function(unit) { return unit.code; }));
  styleTrackingRows_(sheet, dataRows, lastRow, snapshot);
}

function buildTrackingAccumulatedFormula_(row, separator) {
  return '=IF($B' + row + '=""' + separator + '""' + separator +
    'SUMIF($B$2:$B' + row + separator + '$B' + row + separator + '$E$2:$E' + row + '))';
}

function buildTrackingTotalFormula_(row, snapshotLastRow, separator) {
  return '=IFERROR(VLOOKUP($B' + row + separator + '$J$2:$K$' + snapshotLastRow +
    separator + '2' + separator + 'FALSE)' + separator + '"")';
}

function setTrackingHeaderNotes_(sheet) {
  sheet.getRange(1, 2).setNote(
    'UT realmente trabajada en esta fecha. Puedes cambiarla si la realidad difiere de la planificación inicial.'
  );
  sheet.getRange(1, 5).setNote('Horas/sesiones reales imputadas a esta UT en esta fecha.');
  sheet.getRange(1, 6).setNote('Horas acumuladas de esta UT hasta esta fecha, incluyendo esta fila.');
  sheet.getRange(1, 7).setNote('Horas inicialmente planificadas para esta UT en 4 Config.');
}

function applyTrackingDimensions_(sheet, lastRow) {
  const widths = [105, 62, 300, 245, 62, 62, 62, 175];
  widths.forEach(function(width, index) { sheet.setColumnWidth(index + 1, width); });
  sheet.setRowHeight(1, 34);
  if (lastRow > 1) sheet.setRowHeights(2, lastRow - 1, 42);
  sheet.getRange(2, 1, Math.max(1, lastRow - 1), 1).setNumberFormat('ddd dd/MM/yyyy');
  sheet.getRange(2, 3, Math.max(1, lastRow - 1), 2).setWrap(true);
  sheet.getRange(2, 8, Math.max(1, lastRow - 1), 1).setWrap(true);
  sheet.getRange(2, 1, Math.max(1, lastRow - 1), 8).setVerticalAlignment('middle');
  sheet.getRange(2, 5, Math.max(1, lastRow - 1), 3).setNumberFormat('0.##');
  sheet.hideColumns(9, 4);
}

function applyTrackingValidations_(sheet, rowNumbers, unitCodes) {
  if (!rowNumbers.length) return;
  const utValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(unitCodes, true).setAllowInvalid(false).build();
  const actualValidation = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).build();
  rowNumbers.forEach(function(row) {
    sheet.getRange(row, 2).setDataValidation(utValidation);
    sheet.getRange(row, 5).setDataValidation(actualValidation);
  });
}

function styleTrackingRows_(sheet, dataRows, lastRow, snapshot) {
  const dataRowMap = dataRows.reduce(function(map, row) { map[row] = true; return map; }, {});
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 7).setFontWeight('normal');
    sheet.getRange(2, 8, lastRow - 1, 1).setBackground('#FFFFFF').setFontColor('#172033');
  }
  for (let row = 2; row <= lastRow; row += 1) {
    if (dataRowMap[row]) continue;
    const label = normalizeScheduleText_(sheet.getRange(row, 1).getDisplayValue());
    if (!label) continue;
    const color = /EVALUACIÓN/i.test(label)
      ? CP_TRACKING_SEPARATOR_COLORS.EVALUATION : CP_TRACKING_SEPARATOR_COLORS.BREAK;
    sheet.getRange(row, 1, 1, 8).setBackground(color).setFontColor('#FFFFFF')
      .setFontWeight('bold').setHorizontalAlignment('center');
  }
  const rules = [];
  const colorRange = sheet.getRange(2, 1, Math.max(1, lastRow - 1), 7);
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND(ISNUMBER($F2),ISNUMBER($G2),$F2>$G2)')
    .setFontColor('#DC2626').setBold(true)
    .setRanges([sheet.getRange(2, 6, Math.max(1, lastRow - 1), 1)]).build());
  snapshot.forEach(function(unit) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$B2="' + escapeTrackingFormulaText_(unit.code) + '"')
      .setBackground(unit.color).setFontColor(getAccessibleTextColor_(unit.color))
      .setRanges([colorRange]).build());
  });
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=LEN(TRIM($H2))>0')
    .setBackground('#FFFF00').setFontColor('#172033')
    .setRanges([sheet.getRange(2, 8, Math.max(1, lastRow - 1), 1)]).build());
  sheet.setConditionalFormatRules(rules);
}

function escapeTrackingFormulaText_(value) {
  return String(value || '').replace(/"/g, '""');
}

function readTrackingSnapshot_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, CP_TRACKING_LAYOUT.SNAPSHOT_FIRST_COLUMN, lastRow - 1, 3)
    .getValues().filter(function(row) { return normalizeScheduleText_(row[0]); })
    .map(function(row) {
      return {
        code: normalizeScheduleText_(row[0]),
        hours: Number(row[1]) || 0,
        color: normalizeThemeColor_(row[2]) || '#E2E8F0',
      };
    });
}

function getTrackingDataRowNumbers_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues()
    .map(function(row, index) {
      return row[0] instanceof Date ? index + 2 : 0;
    }).filter(Boolean);
}

function isRegisteredModuleTrackingSheet_(sheet) {
  if (!sheet || sheet.getMaxColumns() < CP_TRACKING_LAYOUT.TOTAL_COLUMNS) return false;
  const headers = sheet.getRange(1, CP_TRACKING_LAYOUT.SNAPSHOT_FIRST_COLUMN, 1, 3)
    .getDisplayValues()[0]
    .map(normalizeScheduleText_);
  return headers[0] === 'UT' && headers[1] === 'Total inicial' && headers[2] === 'Color';
}

function prepareEmptyEvaluationSheet_(sheet) {
  ensureSheetSize_(sheet, 1, 1);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.clear();
  sheet.setConditionalFormatRules([]);
  sheet.setFrozenRows(0);
  sheet.setFrozenColumns(0);
  sheet.setHiddenGridlines(true);
  sheet.setTabColor(getActiveTheme_(sheet.getParent()).colors.accent);
  trimSheetToBounds_(sheet, 1, 1);
}

function repairManagedModuleConsumerSheets_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let repaired = 0;
  let recreatedEvaluations = 0;
  const records = readModuleConfigRegistry_(spreadsheet);
  records.forEach(function(record) {
    const trackingSheet = record.trackingSheetId
      ? getSheetById_(spreadsheet, record.trackingSheetId) : null;
    const evaluationSheet = record.evaluationSheetId
      ? getSheetById_(spreadsheet, record.evaluationSheetId) : null;
    if (isRegisteredModuleTrackingSheet_(trackingSheet)) {
      formatAndRepairTrackingSheet_(trackingSheet);
      repaired += 1;
    }
    if (isRegisteredModuleTrackingSheet_(trackingSheet) && !evaluationSheet) {
      const activity = getModuleActivityById_(record.activityId);
      if (!activity) return;
      const name = buildManagedModuleSheetName_(spreadsheet, '6 Eval', activity);
      const created = spreadsheet.insertSheet(name);
      prepareEmptyEvaluationSheet_(created);
      record.evaluationSheetId = created.getSheetId();
      recreatedEvaluations += 1;
    }
  });
  if (recreatedEvaluations) {
    writeModuleTable_(spreadsheet.getSheetByName(CP.SHEETS.MODULE_CONFIG),
      CP_MODULE_CONFIG_HEADERS, records.map(moduleConfigRecordToRow_));
  }
  reorderManagedVisibleSheets_(spreadsheet);
  actualizarIndicePortada();
  return repaired + ' Seguimientos reparados; ' + recreatedEvaluations +
    ' hojas de Evaluación recreadas.';
}

function getModuleConsumerActivityIdForSheet_(sheet) {
  if (!sheet) return '';
  const sheetId = sheet.getSheetId();
  const record = readModuleConfigRegistry_(sheet.getParent()).find(function(item) {
    return item.trackingSheetId === sheetId || item.evaluationSheetId === sheetId;
  });
  return record ? record.activityId : '';
}

function materializeTrackingForArchive_(sheet) {
  const dataRows = getTrackingDataRowNumbers_(sheet);
  SpreadsheetApp.flush();
  const visible = sheet.getRange(1, 1, sheet.getLastRow(), 8);
  const backgrounds = visible.getBackgrounds();
  const fontColors = visible.getFontColors();
  const fontWeights = visible.getFontWeights();
  dataRows.forEach(function(row) {
    const range = sheet.getRange(row, 6, 1, 2);
    range.setValues(range.getValues());
    sheet.getRange(row, 2).clearDataValidations();
    sheet.getRange(row, 5).clearDataValidations();
  });
  sheet.setConditionalFormatRules([]);
  visible.setBackgrounds(backgrounds).setFontColors(fontColors).setFontWeights(fontWeights);
}

function buildTrackingArchiveName_(activeName, academicYear) {
  const years = String(academicYear || '').match(/(\d{4}).*?(\d{4})/);
  const suffix = years
    ? years[1].slice(-2) + years[2].slice(-2)
    : String(academicYear || '').replace(/\D/g, '').slice(-4);
  return (String(activeName || '').replace(/\s+OLD\s+\d{4}$/i, '') +
    ' OLD ' + (suffix || 'ARCH')).slice(0, 100).trim();
}

function archiveTrackingAndDeleteModuleSheetsForNewCourse_(spreadsheet) {
  ensureModuleConfigTechnicalStructure_();
  const records = readModuleConfigRegistry_(spreadsheet);
  const operations = records.map(function(record) {
    const configSheet = getSheetById_(spreadsheet, record.sheetId);
    const trackingSheet = record.trackingSheetId
      ? getSheetById_(spreadsheet, record.trackingSheetId) : null;
    const evaluationSheet = record.evaluationSheetId
      ? getSheetById_(spreadsheet, record.evaluationSheetId) : null;
    if (trackingSheet && !isRegisteredModuleTrackingSheet_(trackingSheet)) {
      throw new Error('La hoja de Seguimiento registrada no conserva su estructura: ' +
        trackingSheet.getName() + '.');
    }
    const archiveName = trackingSheet
      ? buildTrackingArchiveName_(trackingSheet.getName(), record.academicYear) : '';
    const collision = archiveName ? spreadsheet.getSheetByName(archiveName) : null;
    if (collision && collision.getSheetId() !== trackingSheet.getSheetId()) {
      throw new Error('Ya existe el histórico ' + archiveName + '. No se ha iniciado la limpieza anual.');
    }
    return {
      configSheet: configSheet,
      trackingSheet: trackingSheet,
      evaluationSheet: evaluationSheet,
      archiveName: archiveName,
    };
  });
  operations.forEach(function(operation) {
    if (operation.trackingSheet) {
      materializeTrackingForArchive_(operation.trackingSheet);
      operation.trackingSheet.setName(operation.archiveName);
    }
    if (operation.evaluationSheet) spreadsheet.deleteSheet(operation.evaluationSheet);
    if (operation.configSheet) spreadsheet.deleteSheet(operation.configSheet);
  });
  writeModuleTable_(spreadsheet.getSheetByName(CP.SHEETS.MODULE_CONFIG),
    CP_MODULE_CONFIG_HEADERS, []);
  writeModuleTable_(spreadsheet.getSheetByName(CP.SHEETS.MODULE_PLAN),
    CP_MODULE_PLAN_HEADERS, []);
  return operations.length;
}
