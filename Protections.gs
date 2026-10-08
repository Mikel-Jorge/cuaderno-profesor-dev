const CP_PROTECTION_PREFIX = 'CUADERNO:';

function groupConsecutiveRows_(rows) {
  const groups = [];
  rows.forEach(function(row) {
    const last = groups[groups.length - 1];
    if (last && last.start + last.count === row) last.count += 1;
    else groups.push({ start: row, count: 1 });
  });
  return groups;
}

function getManagedProtectionRanges_(sheet, kind) {
  if (kind === 'STUDENTS') {
    return [sheet.getRange(2, 1, sheet.getMaxRows() - 1, 6)];
  }
  if (kind === 'CONFIG') {
    const ranges = [sheet.getRange(28, 1, 15, 18)];
    const rows = sheet.getRange(29, 23, Math.max(1, sheet.getMaxRows() - 28), 1)
      .getDisplayValues();
    const total = rows.findIndex(function(row) { return row[0] === 'TOTAL'; });
    if (total > 0) ranges.push(sheet.getRange(29, 34, total, 2));
    return ranges;
  }
  if (kind === 'TRACKING') {
    const ranges = [];
    groupConsecutiveRows_(getTrackingDataRowNumbers_(sheet)).forEach(function(group) {
      ranges.push(sheet.getRange(group.start, 2, group.count, 4));
      ranges.push(sheet.getRange(group.start, 8, group.count, 1));
    });
    return ranges;
  }
  if (kind === 'EVALUATION') {
    const headers = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const idColumn = headers.indexOf('alumno_id') + 1;
    const footerRow = sheet.getLastRow();
    const count = Math.max(0, footerRow - 4);
    if (!idColumn || !count) return [];
    const ranges = [];
    headers.forEach(function(header, index) {
      if ((index >= 3 && header && !/^Media /i.test(header) &&
           !/^Educa /i.test(header) && header !== 'alumno_id') ||
          /^Educa /i.test(header)) {
        ranges.push(sheet.getRange(4, index + 1, count, 1));
      }
    });
    return ranges;
  }
  return [];
}

function installManagedSheetProtections_(sheet, kind) {
  const type = kind || getManagedProtectionKind_(sheet);
  if (!type) return;
  const description = CP_PROTECTION_PREFIX + type;
  const owned = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET)
    .filter(function(item) { return String(item.getDescription()).startsWith(CP_PROTECTION_PREFIX); });
  let protection = owned.find(function(item) { return item.getDescription() === description; });
  owned.forEach(function(item) { if (item !== protection) item.remove(); });
  if (!protection) protection = sheet.protect().setDescription(description);
  protection.setWarningOnly(true);
  protection.setUnprotectedRanges(getManagedProtectionRanges_(sheet, type));
}

function getManagedProtectionKind_(sheet) {
  const name = sheet.getName();
  if (name === CP.SHEETS.COVER) return 'PORTADA';
  if (name === CP.SHEETS.CALENDAR) return 'CALENDARIO';
  if (name === CP.SHEETS.SCHEDULE) return 'HORARIO';
  if (name === CP.SHEETS.STUDENTS) return 'STUDENTS';
  const technical = [CP.SHEETS.CONFIG, CP.SHEETS.CALENDAR_TYPES,
    CP.SHEETS.CALENDAR_EVALUATIONS, CP.SHEETS.CALENDAR_DATES,
    CP.SHEETS.CALENDAR_DATE_TYPES, CP.SHEETS.SCHEDULE_SLOTS,
    CP.SHEETS.SCHEDULE_ACTIVITIES, CP.SHEETS.SCHEDULE_SESSIONS,
    CP.SHEETS.MODULE_CONFIG, CP.SHEETS.MODULE_PLAN, CP.SHEETS.META];
  if (technical.indexOf(name) !== -1) return 'TECNICA';
  const id = sheet.getSheetId();
  const record = readModuleConfigRegistry_(sheet.getParent()).find(function(item) {
    return item.sheetId === id || item.trackingSheetId === id || item.evaluationSheetId === id;
  });
  if (record) {
    if (record.sheetId === id) return 'CONFIG';
    if (record.trackingSheetId === id) return 'TRACKING';
    return 'EVALUATION';
  }
  if (/^5 Seg\s+.+\s+OLD\s+\d{4}$/i.test(name) &&
      isRegisteredModuleTrackingSheet_(sheet)) return 'TRACKING_OLD';
  return '';
}

function installAllManagedProtections_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  spreadsheet.getSheets().forEach(function(sheet) {
    installManagedSheetProtections_(sheet);
  });
  return 'Protecciones de advertencia del Cuaderno actualizadas.';
}

function installSelectedManagedProtections_(selection) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const kinds = {
    PORTADA: selection.cover,
    CALENDARIO: selection.calendar,
    HORARIO: selection.schedule,
    STUDENTS: selection.students,
    CONFIG: selection.config,
    TRACKING: selection.tracking,
    EVALUATION: selection.evaluation,
    TECNICA: true,
    TRACKING_OLD: true,
  };
  spreadsheet.getSheets().forEach(function(sheet) {
    const kind = getManagedProtectionKind_(sheet);
    if (kinds[kind]) installManagedSheetProtections_(sheet, kind);
  });
  return 'Metadatos y protecciones actualizados.';
}
