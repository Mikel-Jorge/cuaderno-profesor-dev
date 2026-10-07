const CP_SCHEDULE_VIEW = Object.freeze({
  HEADER_ROWS: 3,
  VISIBLE_COLUMNS: 6,
  TOTAL_COLUMNS: 9,
  FIRST_SLOT_ROW: 4,
});

function createOrRepairScheduleSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  assertScheduleStructureReady_(spreadsheet);
  const slots = getScheduleTimeSlots_();
  let sheet = spreadsheet.getSheetByName(CP.SHEETS.SCHEDULE);

  if (!slots.length && !sheet) return;

  sheet = sheet || spreadsheet.insertSheet(CP.SHEETS.SCHEDULE);
  moveScheduleSheetAfterCalendar_(spreadsheet, sheet);

  if (!slots.length) {
    renderEmptyScheduleSheet_(sheet, spreadsheet);
  } else {
    renderScheduleSheet_(sheet, buildScheduleRenderModel_(spreadsheet, slots));
  }

  actualizarIndicePortada();
  SpreadsheetApp.flush();
}

function buildScheduleRenderModel_(spreadsheet, slots) {
  const activities = getScheduleActivities_();
  const sessions = getWeeklySchedule_();
  const slotById = slots.reduce(function(map, slot) { map[slot.id] = slot; return map; }, {});
  const activityById = activities.reduce(function(map, activity) { map[activity.id] = activity; return map; }, {});
  const validDays = CP_SCHEDULE_DAYS.reduce(function(map, day) { map[day.id] = true; return map; }, {});
  const sessionByKey = {};

  sessions.forEach(function(session) {
    const slot = slotById[session.slotId];
    if (!validDays[session.day] || !slot || slot.type !== 'SESION' || !activityById[session.activityId]) {
      throw new Error('Hay una sesión que referencia un tramo o una actividad no válidos.');
    }
    const key = session.day + '|' + session.slotId;
    if (sessionByKey[key]) throw new Error('Hay más de una sesión para el mismo día y tramo.');
    sessionByKey[key] = session;
  });

  return {
    theme: getActiveTheme_(spreadsheet),
    slots: slots,
    activityById: activityById,
    sessionByKey: sessionByKey,
  };
}

function renderScheduleSheet_(sheet, model) {
  const layoutRows = CP_SCHEDULE_VIEW.HEADER_ROWS + model.slots.length;
  prepareScheduleSheet_(sheet, model.theme, layoutRows);
  renderScheduleHeader_(sheet, model);
  renderScheduleRows_(sheet, model);
  applyScheduleCurrentTimeRules_(sheet, model);
  sheet.hideColumns(7, 3);
  trimSheetToBounds_(sheet, layoutRows, CP_SCHEDULE_VIEW.TOTAL_COLUMNS);
}

function prepareScheduleSheet_(sheet, theme, rows) {
  ensureSheetSize_(sheet, rows, CP_SCHEDULE_VIEW.TOTAL_COLUMNS);
  sheet.showColumns(1, sheet.getMaxColumns());
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.setConditionalFormatRules([]);
  sheet.getRange(1, 1, rows, CP_SCHEDULE_VIEW.TOTAL_COLUMNS)
    .clear()
    .setFontFamily('Arial')
    .setFontSize(9)
    .setVerticalAlignment('middle')
    .setBackground(theme.colors.background)
    .setFontColor(theme.colors.text);
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(CP_SCHEDULE_VIEW.HEADER_ROWS);
  sheet.setFrozenColumns(1);
  sheet.setTabColor(CP.TAB_COLORS.GENERAL);
  sheet.setColumnWidth(1, 142);
  for (let column = 2; column <= CP_SCHEDULE_VIEW.VISIBLE_COLUMNS; column += 1) sheet.setColumnWidth(column, 132);
  for (let column = 7; column <= CP_SCHEDULE_VIEW.TOTAL_COLUMNS; column += 1) sheet.setColumnWidth(column, 70);
  sheet.setRowHeights(1, rows, 54);
  sheet.setRowHeight(1, 30);
  sheet.setRowHeight(2, 24);
  sheet.setRowHeight(3, 32);
}

function renderScheduleHeader_(sheet, model) {
  const colors = model.theme.colors;
  sheet.getRange('A1')
    .setFormula('=TODAY()')
    .setNumberFormat('dddd')
    .setBackground(colors.secondary)
    .setFontColor(colors.onSecondary)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange('A2')
    .setFormula('=NOW()')
    .setNumberFormat('dd/MM/yyyy HH:mm')
    .setBackground(colors.surface)
    .setFontColor(colors.mutedText)
    .setHorizontalAlignment('center');
  setMergedRangeValue_(sheet.getRange('B1:F1'), 'HORARIO')
    .setBackground(colors.primary)
    .setFontColor(colors.onPrimary)
    .setFontSize(17)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  const weekRange = setMergedRangeValue_(sheet.getRange('B2:F2'), 'HORARIO SEMANAL');
  weekRange
    .setBackground(colors.surface)
    .setFontColor(colors.mutedText)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange('A3')
    .setValue('TRAMO')
    .setBackground(colors.muted)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  const formulas = CP_SCHEDULE_DAYS.map(function(day, index) {
    return '=TODAY()-WEEKDAY(TODAY()-1)+1+7*(WEEKDAY(TODAY()-1)>5)+' + index;
  });
  sheet.getRange(3, 2, 1, 5)
    .setFormulas([formulas])
    .setNumberFormat('dddd · dd mmm')
    .setBackground(colors.secondary)
    .setFontColor(colors.onSecondary)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange('A3:F3')
    .setBorder(true, true, true, true, true, true, colors.border, SpreadsheetApp.BorderStyle.SOLID);
}

function renderScheduleRows_(sheet, model) {
  const colors = model.theme.colors;
  const values = [];
  const backgrounds = [];
  const fontColors = [];
  const richTextValues = [];
  const helpers = [];

  model.slots.forEach(function(slot) {
    const timeRange = slot.startTime + '–' + getTimeSlotEndTime_(slot);
    const rowValues = [slot.type === 'DESCANSO' ? 'Recreo\n' + timeRange : timeRange];
    const rowBackgrounds = [slot.type === 'DESCANSO' ? colors.muted : colors.surface];
    const rowFontColors = [colors.text];
    const rowRichText = [];

    CP_SCHEDULE_DAYS.forEach(function(day) {
      if (slot.type === 'DESCANSO') {
        rowValues.push('');
        rowBackgrounds.push(colors.muted);
        rowFontColors.push(colors.mutedText);
        rowRichText.push(createScheduleCellRichText_('', colors.mutedText));
        return;
      }
      const session = model.sessionByKey[day.id + '|' + slot.id];
      const activity = session && model.activityById[session.activityId];
      const text = activity ? formatScheduleCell_(activity, session.support) : '';
      const fontColor = activity ? getAccessibleTextColor_(activity.color) : colors.text;
      rowValues.push(text);
      rowBackgrounds.push(activity ? activity.color : colors.surface);
      rowFontColors.push(fontColor);
      rowRichText.push(createScheduleCellRichText_(text, fontColor));
    });

    values.push(rowValues);
    backgrounds.push(rowBackgrounds);
    fontColors.push(rowFontColors);
    richTextValues.push(rowRichText);
    helpers.push([
      timeToMinutes_(slot.startTime) / (24 * 60),
      getTimeSlotEndMinutes_(slot) / (24 * 60),
      slot.type,
    ]);
  });

  const firstRow = CP_SCHEDULE_VIEW.FIRST_SLOT_ROW;
  const body = sheet.getRange(firstRow, 1, model.slots.length, CP_SCHEDULE_VIEW.VISIBLE_COLUMNS);
  body.setValues(values)
    .setBackgrounds(backgrounds)
    .setFontColors(fontColors)
    .setWrap(true)
    .setHorizontalAlignment('center')
    .setBorder(true, true, true, true, true, true, colors.border, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(firstRow, 2, model.slots.length, 5).setRichTextValues(richTextValues);
  sheet.getRange(firstRow, 1, model.slots.length, 1).setFontWeight('bold');
  sheet.getRange(firstRow, 7, model.slots.length, 3)
    .setValues(helpers);
  sheet.getRange(firstRow, 7, model.slots.length, 2).setNumberFormat('hh:mm');

  model.slots.forEach(function(slot, index) {
    if (slot.type !== 'DESCANSO') return;
    const row = firstRow + index;
    setMergedRangeValue_(sheet.getRange(row, 2, 1, 5), 'DESCANSO')
      .setBackground(colors.muted)
      .setFontColor(colors.mutedText)
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    sheet.setRowHeight(row, 34);
  });
}

function formatScheduleCell_(activity, support) {
  const lines = [activity.acronym];
  const details = [];
  if (activity.group) details.push(activity.group);
  if (activity.classroom) details.push(activity.classroom);
  if (!details.length && activity.category !== 'MODULO' && activity.name && activity.name.toUpperCase() !== activity.acronym) {
    details.push(activity.name);
  }
  const context = details.join(' · ');
  if (context) lines.push(compactScheduleCellText_(context, 24));
  if (support) lines.push('↳ ' + support);
  return lines.join('\n');
}

function compactScheduleCellText_(value, maxLength) {
  const text = normalizeScheduleText_(value);
  return text.length > maxLength ? text.slice(0, maxLength - 1).trim() + '…' : text;
}

function createScheduleCellRichText_(text, fontColor) {
  const value = normalizeScheduleText_(text).split('\n').map(function(line) { return line.trim(); }).join('\n');
  const secondaryStart = value.indexOf('\n');
  const primaryEnd = secondaryStart === -1 ? value.length : secondaryStart;
  const supportMarker = '\n↳ ';
  const supportStart = value.lastIndexOf(supportMarker);
  const secondaryStyle = SpreadsheetApp.newTextStyle()
    .setFontFamily('Arial')
    .setFontSize(8)
    .setBold(false)
    .setForegroundColor(fontColor)
    .build();
  const primaryStyle = SpreadsheetApp.newTextStyle()
    .setFontFamily('Arial')
    .setFontSize(10)
    .setBold(true)
    .setForegroundColor(fontColor)
    .build();
  const supportStyle = SpreadsheetApp.newTextStyle()
    .setFontFamily('Arial')
    .setFontSize(8)
    .setBold(false)
    .setItalic(true)
    .setForegroundColor(fontColor)
    .build();
  const builder = SpreadsheetApp.newRichTextValue()
    .setText(value)
    .setTextStyle(secondaryStyle);
  if (primaryEnd) builder.setTextStyle(0, primaryEnd, primaryStyle);
  if (supportStart !== -1) builder.setTextStyle(supportStart + 1, value.length, supportStyle);
  return builder.build();
}

function applyScheduleCurrentTimeRules_(sheet, model) {
  const colors = model.theme.colors;
  const firstRow = CP_SCHEDULE_VIEW.FIRST_SLOT_ROW;
  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=(WEEKDAY(TODAY()-1)<6)*(B$3=TODAY())')
      .setBackground(colors.accent)
      .setFontColor(colors.onAccent)
      .setBold(true)
      .setRanges([sheet.getRange('B3:F3')])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=(WEEKDAY(TODAY()-1)<6)*(NOW()-TODAY()>=$G' + firstRow + ')*(NOW()-TODAY()<$H' + firstRow + ')')
      .setBackground(colors.accent)
      .setFontColor(colors.onAccent)
      .setBold(true)
      .setRanges([sheet.getRange(firstRow, 1, model.slots.length, 1)])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=($I' + firstRow + '="SESION")*(WEEKDAY(TODAY()-1)=COLUMN()-1)*(NOW()-TODAY()>=$G' + firstRow + ')*(NOW()-TODAY()<$H' + firstRow + ')')
      .setUnderline(true)
      .setRanges([sheet.getRange(firstRow, 2, model.slots.length, 5)])
      .build(),
  ];
  sheet.setConditionalFormatRules(rules);
}

function renderEmptyScheduleSheet_(sheet, spreadsheet) {
  const theme = getActiveTheme_(spreadsheet);
  const rows = 5;
  prepareScheduleSheet_(sheet, theme, rows);
  renderScheduleHeader_(sheet, { theme: theme });
  setMergedRangeValue_(sheet.getRange('A4:F5'), 'Configura al menos un tramo para generar el horario semanal.')
    .setBackground(theme.colors.surface)
    .setFontColor(theme.colors.mutedText)
    .setFontSize(11)
    .setHorizontalAlignment('center');
  sheet.hideColumns(7, 3);
  trimSheetToBounds_(sheet, rows, CP_SCHEDULE_VIEW.TOTAL_COLUMNS);
}

function moveScheduleSheetAfterCalendar_(spreadsheet, sheet) {
  sheet.showSheet();
  const calendarSheet = spreadsheet.getSheetByName(CP.SHEETS.CALENDAR);
  const coverSheet = spreadsheet.getSheetByName(CP.SHEETS.COVER);
  const anchorSheet = calendarSheet || coverSheet;
  spreadsheet.setActiveSheet(sheet);
  spreadsheet.moveActiveSheet(anchorSheet ? anchorSheet.getIndex() + 1 : 1);
}

function isScheduleConfiguredForSidebar_() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    assertScheduleStructureReady_(spreadsheet);
    return getScheduleTimeSlots_().length > 0 &&
      getWeeklySchedule_().length > 0 &&
      Boolean(spreadsheet.getSheetByName(CP.SHEETS.SCHEDULE));
  } catch (error) {
    return false;
  }
}
