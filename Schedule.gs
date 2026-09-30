const CP_SCHEDULE_HEADERS = Object.freeze({
  SLOTS: Object.freeze(['tramo_id', 'tipo', 'nombre', 'hora_inicio', 'duracion_minutos']),
  LEGACY_SLOTS: Object.freeze(['tramo_id', 'orden', 'jornada', 'tipo', 'nombre', 'hora_inicio', 'hora_fin']),
  ACTIVITIES: Object.freeze(['actividad_id', 'categoria', 'nombre', 'sigla', 'tipo_ensenanza_id', 'grupo', 'aula', 'color']),
  SESSIONS: Object.freeze(['sesion_id', 'dia_semana', 'tramo_id', 'actividad_id', 'apoyo_sigla']),
});

const CP_SCHEDULE_DAYS = Object.freeze([
  Object.freeze({ id: 'LUN', label: 'Lunes' }),
  Object.freeze({ id: 'MAR', label: 'Martes' }),
  Object.freeze({ id: 'MIE', label: 'Miércoles' }),
  Object.freeze({ id: 'JUE', label: 'Jueves' }),
  Object.freeze({ id: 'VIE', label: 'Viernes' }),
]);

const CP_SCHEDULE_SLOT_TYPES = Object.freeze({ SESION: 'Sesión', DESCANSO: 'Descanso' });
const CP_SCHEDULE_ACTIVITY_CATEGORIES = Object.freeze([
  'MODULO', 'TUTORIA', 'GUARDIA', 'REUNION', 'DUAL', 'PPPP', 'P', 'OTRA',
]);
const CP_SCHEDULE_ACTIVITY_DEFAULTS = Object.freeze({
  TUTORIA: Object.freeze({ name: 'Tutoría', acronym: 'T' }),
  P: Object.freeze({ name: 'Labores propias del puesto de trabajo', acronym: 'P' }),
  PPPP: Object.freeze({ name: 'Participación en proyectos, programas o planes de centro', acronym: 'PPPP' }),
});
const CP_SCHEDULE_TEACHING_TYPE_IDS = Object.freeze(CP_CALENDAR_TYPE_DEFINITIONS.map(function(definition) { return definition.id; }));
const CP_SCHEDULE_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const CP_SCHEDULE_COLOR_PATTERN = /^#[0-9A-F]{6}$/i;
const CP_SCHEDULE_SUPPORT_MAX_LENGTH = 40;

function ensureScheduleTechnicalStructure_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  ensureScheduleSlotsTable_(getOrCreateSheet_(spreadsheet, CP.SHEETS.SCHEDULE_SLOTS));
  const activitiesSheet = getOrCreateSheet_(spreadsheet, CP.SHEETS.SCHEDULE_ACTIVITIES);
  initializeScheduleTable_(activitiesSheet, CP_SCHEDULE_HEADERS.ACTIVITIES);
  normalizeLegacyScheduleActivityCategories_(activitiesSheet);
  initializeScheduleTable_(getOrCreateSheet_(spreadsheet, CP.SHEETS.SCHEDULE_SESSIONS), CP_SCHEDULE_HEADERS.SESSIONS);
  spreadsheet.getSheetByName(CP.SHEETS.SCHEDULE_SLOTS).hideSheet();
  spreadsheet.getSheetByName(CP.SHEETS.SCHEDULE_ACTIVITIES).hideSheet();
  spreadsheet.getSheetByName(CP.SHEETS.SCHEDULE_SESSIONS).hideSheet();
}

function ensureScheduleSlotsTable_(sheet) {
  const headerWidth = Math.max(CP_SCHEDULE_HEADERS.SLOTS.length, CP_SCHEDULE_HEADERS.LEGACY_SLOTS.length);
  const headers = sheet.getRange(1, 1, 1, headerWidth).getValues()[0].map(normalizeScheduleText_);
  if (scheduleHeadersMatch_(headers, CP_SCHEDULE_HEADERS.SLOTS)) {
    normalizeCurrentScheduleSlotsTable_(sheet);
    initializeScheduleTable_(sheet, CP_SCHEDULE_HEADERS.SLOTS);
    return;
  }
  if (scheduleHeadersMatch_(headers, CP_SCHEDULE_HEADERS.LEGACY_SLOTS)) {
    migrateScheduleSlotsToSchema7_(sheet);
    return;
  }
  if (sheet.getLastRow() <= 1 || !headers.some(Boolean)) {
    sheet.clearContents();
    initializeScheduleTable_(sheet, CP_SCHEDULE_HEADERS.SLOTS);
    return;
  }
  throw new Error('La hoja técnica ' + CP.SHEETS.SCHEDULE_SLOTS + ' tiene un esquema incompatible. No se han modificado sus datos.');
}

function normalizeCurrentScheduleSlotsTable_(sheet) {
  if (sheet.getLastRow() < 2) return;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, CP_SCHEDULE_HEADERS.SLOTS.length).getValues().filter(function(row) {
    return row.some(function(value) { return normalizeScheduleText_(value); });
  });
  const slots = rows.map(function(row) {
    return {
      id: normalizeScheduleText_(row[0]),
      type: normalizeScheduleText_(row[1]).toUpperCase(),
      name: normalizeScheduleText_(row[2]),
      startTime: normalizeScheduleTime_(row[3]),
      durationMinutes: Number(row[4]),
    };
  });
  const normalized = normalizeScheduleSlotChain_(sortScheduleSlots_(slots));
  writeScheduleTable_(sheet, CP_SCHEDULE_HEADERS.SLOTS, normalized.map(function(slot) {
    return [slot.id, slot.type, slot.name, slot.startTime, slot.durationMinutes];
  }));
}

function scheduleHeadersMatch_(actual, expected) {
  return expected.every(function(header, index) { return actual[index] === header; });
}

function migrateScheduleSlotsToSchema7_(sheet) {
  const oldWidth = CP_SCHEDULE_HEADERS.LEGACY_SLOTS.length;
  const oldRows = sheet.getLastRow() < 2
    ? []
    : sheet.getRange(2, 1, sheet.getLastRow() - 1, oldWidth).getValues().filter(function(row) {
      return row.some(function(value) { return normalizeScheduleText_(value); });
    });
  const migrated = oldRows.map(function(row, index) {
    try {
      const startTime = normalizeScheduleTime_(row[5]);
      const endTime = normalizeScheduleTime_(row[6]);
      const durationMinutes = timeToMinutes_(endTime) - timeToMinutes_(startTime);
      const slot = {
        id: normalizeScheduleText_(row[0]),
        type: normalizeScheduleText_(row[3]).toUpperCase(),
        name: normalizeScheduleText_(row[4]),
        startTime: startTime,
        durationMinutes: durationMinutes,
      };
      validateScheduleSlot_(slot);
      return slot;
    } catch (error) {
      throw new Error('No se puede migrar el tramo de la fila ' + (index + 2) + ': ' + error.message + ' No se han modificado los datos.');
    }
  });
  const ordered = normalizeScheduleSlotChain_(sortScheduleSlots_(migrated));
  const snapshot = sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), oldWidth).getValues();
  try {
    sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), oldWidth).clearContent();
    writeScheduleTable_(sheet, CP_SCHEDULE_HEADERS.SLOTS, ordered.map(function(slot) {
      return [slot.id, slot.type, slot.name, slot.startTime, slot.durationMinutes];
    }));
  } catch (error) {
    ensureSheetSize_(sheet, snapshot.length, oldWidth);
    sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), oldWidth).clearContent();
    sheet.getRange(1, 1, snapshot.length, oldWidth).setValues(snapshot);
    throw new Error('No se ha podido migrar ' + CP.SHEETS.SCHEDULE_SLOTS + '; se han restaurado los datos anteriores.');
  }
}

function normalizeLegacyScheduleActivityCategories_(sheet) {
  if (sheet.getLastRow() < 2) return;
  const range = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1);
  const values = range.getValues();
  let changed = false;
  values.forEach(function(row) {
    if (normalizeScheduleText_(row[0]).toUpperCase() === 'COORDINACION') {
      row[0] = 'REUNION';
      changed = true;
    }
  });
  if (changed) range.setValues(values);
}

function initializeScheduleStructure_() {
  ensureScheduleTechnicalStructure_();
}

function initializeScheduleTable_(sheet, headers) {
  initializeCalendarTableSheet_(sheet, headers, []);
  sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), headers.length).setNumberFormat('@');
}

function assertScheduleStructureReady_(spreadsheet) {
  [
    [CP.SHEETS.SCHEDULE_SLOTS, CP_SCHEDULE_HEADERS.SLOTS],
    [CP.SHEETS.SCHEDULE_ACTIVITIES, CP_SCHEDULE_HEADERS.ACTIVITIES],
    [CP.SHEETS.SCHEDULE_SESSIONS, CP_SCHEDULE_HEADERS.SESSIONS],
  ].forEach(function(definition) {
    const sheet = spreadsheet.getSheetByName(definition[0]);
    if (!sheet) throw new Error('Falta la hoja técnica ' + definition[0] + '. Usa «Inicializar / reparar estructura».');
    if (sheet.getLastRow() < 1 || sheet.getLastColumn() < definition[1].length) {
      throw new Error('La hoja técnica ' + definition[0] + ' no tiene la estructura esperada. Usa «Inicializar / reparar estructura».');
    }
    const headers = sheet.getRange(1, 1, 1, definition[1].length).getValues()[0].map(normalizeScheduleText_);
    if (headers.some(function(header, index) { return header !== definition[1][index]; })) {
      throw new Error('La hoja técnica ' + definition[0] + ' no tiene las cabeceras esperadas. Usa «Inicializar / reparar estructura».');
    }
  });
}

function abrirConfiguracionHorario() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let scheduleConfig;
  try {
    assertScheduleStructureReady_(spreadsheet);
    scheduleConfig = getScheduleConfigForUi_(spreadsheet);
  } catch (error) {
    scheduleConfig = {
      blockingError: error && error.message ? error.message : 'La estructura del horario necesita reparación.',
      slots: [],
      activities: [],
      sessions: [],
      days: CP_SCHEDULE_DAYS,
      slotTypes: CP_SCHEDULE_SLOT_TYPES,
      categories: CP_SCHEDULE_ACTIVITY_CATEGORIES,
      activityDefaults: CP_SCHEDULE_ACTIVITY_DEFAULTS,
      teachingTypes: CP_SCHEDULE_TEACHING_TYPE_IDS,
      supportMaxLength: CP_SCHEDULE_SUPPORT_MAX_LENGTH,
    };
  }
  const template = HtmlService.createTemplateFromFile('UiDialogScheduleConfig');
  template.scheduleConfig = scheduleConfig;
  setCommonUiTemplateData_(template);
  const output = template.evaluate()
    .setWidth(CP.UI.SCHEDULE_CONFIG_DIALOG_WIDTH)
    .setHeight(CP.UI.SCHEDULE_CONFIG_DIALOG_HEIGHT);
  SpreadsheetApp.getUi().showModalDialog(output, CP.MENU.SCHEDULE_CONFIG);
}

function getScheduleConfigForUi_(spreadsheet) {
  return {
    blockingError: '',
    slots: getScheduleTimeSlots_().map(function(slot) { return Object.assign({}, slot); }),
    activities: getScheduleActivities_().map(function(activity) { return Object.assign({}, activity); }),
    sessions: getWeeklySchedule_().map(function(session) { return Object.assign({}, session); }),
    days: CP_SCHEDULE_DAYS,
    slotTypes: CP_SCHEDULE_SLOT_TYPES,
    categories: CP_SCHEDULE_ACTIVITY_CATEGORIES,
    activityDefaults: CP_SCHEDULE_ACTIVITY_DEFAULTS,
    teachingTypes: CP_SCHEDULE_TEACHING_TYPE_IDS,
    supportMaxLength: CP_SCHEDULE_SUPPORT_MAX_LENGTH,
  };
}

function guardarConfiguracionHorario(input) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  assertScheduleStructureReady_(spreadsheet);
  const normalized = normalizeAndValidateScheduleConfig_(input);
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('No se ha podido bloquear el cuaderno para guardar. Inténtalo de nuevo.');
  const snapshots = captureScheduleSnapshots_(spreadsheet);
  try {
    persistScheduleConfig_(spreadsheet, normalized);
  } catch (error) {
    try { restoreScheduleSnapshots_(spreadsheet, snapshots); } catch (rollbackError) {
      throw new Error('No se ha podido guardar el horario ni restaurar las tablas técnicas.');
    }
    throw error;
  } finally {
    lock.releaseLock();
  }
  try {
    createOrRepairScheduleSheet_();
  } catch (error) {
    throw new Error(
      'La configuración se ha guardado, pero no se ha podido actualizar ' + CP.SHEETS.SCHEDULE + ': ' +
      (error && error.message ? error.message : 'error de renderizado.')
    );
  }
  spreadsheet.toast('Configuración del horario guardada.', CP.PROJECT_NAME, 4);
  return { message: 'La configuración del horario se ha guardado.' };
}

function normalizeAndValidateScheduleConfig_(input) {
  if (!input || typeof input !== 'object') throw new Error('No se han recibido datos válidos del horario.');
  const slots = normalizeScheduleSlots_(input.slots || []);
  const activities = normalizeScheduleActivities_(input.activities || []);
  const slotById = slots.reduce(function(map, slot) { map[slot.id] = slot; return map; }, {});
  const activityById = activities.reduce(function(map, activity) { map[activity.id] = activity; return map; }, {});
  const sessions = normalizeScheduleSessions_(input.sessions || [], slotById, activityById);
  return { slots: slots, activities: activities, sessions: sessions };
}

function normalizeScheduleSlots_(rows) {
  const usedIds = {};
  const slots = rows.map(function(raw) {
    const rawStartTime = normalizeScheduleText_(raw.startTime || raw.hora_inicio);
    const slot = {
      id: normalizeScheduleText_(raw.id || raw.tramo_id) || createCalendarRecordId_('TR'),
      type: normalizeScheduleText_(raw.type || raw.tipo).toUpperCase(),
      name: normalizeScheduleText_(raw.name || raw.nombre),
      startTime: rawStartTime ? normalizeScheduleTime_(rawStartTime) : '',
      durationMinutes: Number(raw.durationMinutes || raw.duracion_minutos),
    };
    if (usedIds[slot.id]) throw new Error('Hay tramos horarios con el mismo ID.');
    validateScheduleSlotDefinition_(slot);
    usedIds[slot.id] = true;
    return slot;
  });
  return normalizeScheduleSlotChain_(sortScheduleSlots_(slots));
}

function validateScheduleSlotDefinition_(slot) {
  if (!slot.id) throw new Error('Todo tramo debe conservar un identificador.');
  if (!CP_SCHEDULE_SLOT_TYPES[slot.type]) throw new Error('El tipo del tramo no es válido.');
  const duration = Number(slot.durationMinutes);
  if (!Number.isInteger(duration) || duration <= 0 || duration % 5 !== 0) {
    throw new Error('La duración de cada tramo debe ser un múltiplo de 5 minutos.');
  }
}

function validateScheduleSlot_(slot) {
  validateScheduleSlotDefinition_(slot);
  normalizeScheduleTime_(slot.startTime);
  if (getTimeSlotEndMinutes_(slot) > 24 * 60) throw new Error('Un tramo no puede finalizar después de las 24:00.');
}

function validateScheduleSlotSet_(slots) {
  const usedIds = {};
  slots.forEach(function(slot, index) {
    if (usedIds[slot.id]) throw new Error('Hay tramos horarios con el mismo ID.');
    usedIds[slot.id] = true;
    validateScheduleSlot_(slot);
    const previous = slots[index - 1];
    if (previous && timeToMinutes_(slot.startTime) !== getTimeSlotEndMinutes_(previous)) {
      throw new Error('El tramo ' + (index + 1) + ' debe comenzar cuando termina el tramo anterior.');
    }
  });
}

function sortScheduleSlots_(slots) {
  return slots.slice().sort(function(first, second) {
    const firstMinutes = first.startTime ? timeToMinutes_(first.startTime) : null;
    const secondMinutes = second.startTime ? timeToMinutes_(second.startTime) : null;
    if (firstMinutes === null && secondMinutes === null) return 0;
    if (firstMinutes === null) return 1;
    if (secondMinutes === null) return -1;
    return firstMinutes - secondMinutes;
  });
}

function normalizeScheduleSlotChain_(slots) {
  if (!slots.length) return [];
  validateScheduleSlotDefinition_(slots[0]);
  normalizeScheduleTime_(slots[0].startTime);
  if (getTimeSlotEndMinutes_(slots[0]) > 24 * 60) throw new Error('Un tramo no puede finalizar después de las 24:00.');
  for (let index = 1; index < slots.length; index += 1) {
    validateScheduleSlotDefinition_(slots[index]);
    const expectedStart = getTimeSlotEndMinutes_(slots[index - 1]);
    if (expectedStart >= 24 * 60) throw new Error('No puede haber tramos después de las 24:00.');
    slots[index].startTime = minutesToTime_(expectedStart);
  }
  validateScheduleSlotSet_(slots);
  return slots;
}

function normalizeScheduleActivities_(rows) {
  const usedIds = {};
  return rows.map(function(raw) {
    const category = normalizeScheduleActivityCategory_(raw.category || raw.categoria);
    const activity = {
      id: normalizeScheduleText_(raw.id || raw.actividad_id) || createCalendarRecordId_('ACT'),
      category: category,
      name: normalizeScheduleText_(raw.name || raw.nombre),
      acronym: normalizeScheduleText_(raw.acronym || raw.sigla).toUpperCase(),
      teachingTypeId: normalizeScheduleText_(raw.teachingTypeId || raw.tipo_ensenanza_id).toUpperCase(),
      group: normalizeScheduleText_(raw.group || raw.grupo),
      classroom: normalizeScheduleText_(raw.classroom || raw.aula),
      color: normalizeScheduleColor_(raw.color),
    };
    if (usedIds[activity.id]) throw new Error('Hay actividades con el mismo ID.');
    if (CP_SCHEDULE_ACTIVITY_CATEGORIES.indexOf(category) === -1) throw new Error('La categoría de una actividad no es válida.');
    if (!activity.name || !activity.acronym) throw new Error('Toda actividad debe tener nombre y sigla.');
    if (!activity.color) throw new Error('Toda actividad debe tener un color válido.');
    if (category === 'MODULO') {
      if (CP_SCHEDULE_TEACHING_TYPE_IDS.indexOf(activity.teachingTypeId) === -1) throw new Error('Las actividades MODULO deben tener un tipo de enseñanza válido.');
      if (!activity.group) throw new Error('Las actividades MODULO deben tener grupo.');
    } else if (activity.teachingTypeId && CP_SCHEDULE_TEACHING_TYPE_IDS.indexOf(activity.teachingTypeId) === -1) {
      throw new Error('El tipo de enseñanza de una actividad no es válido.');
    }
    usedIds[activity.id] = true;
    return activity;
  });
}

function normalizeScheduleSessions_(rows, slotById, activityById) {
  const usedKeys = {};
  return rows.filter(function(raw) { return normalizeScheduleText_(raw.activityId || raw.actividad_id); }).map(function(raw) {
    const day = normalizeScheduleText_(raw.day || raw.dia_semana).toUpperCase();
    const slotId = normalizeScheduleText_(raw.slotId || raw.tramo_id);
    const activityId = normalizeScheduleText_(raw.activityId || raw.actividad_id);
    const support = normalizeScheduleText_(raw.support || raw.apoyo_sigla);
    const slot = slotById[slotId];
    if (!CP_SCHEDULE_DAYS.some(function(item) { return item.id === day; })) throw new Error('El día de una sesión no es válido.');
    if (!slot) throw new Error('Una sesión referencia un tramo inexistente.');
    if (slot.type !== 'SESION') throw new Error('Los descansos no pueden tener actividad asignada.');
    if (!activityById[activityId]) throw new Error('Una sesión referencia una actividad inexistente.');
    if (support.length > CP_SCHEDULE_SUPPORT_MAX_LENGTH) {
      throw new Error('El apoyo de una sesión no puede superar ' + CP_SCHEDULE_SUPPORT_MAX_LENGTH + ' caracteres.');
    }
    const key = day + '|' + slotId;
    if (usedKeys[key]) throw new Error('No puede haber dos actividades en el mismo día y tramo.');
    usedKeys[key] = true;
    return { id: normalizeScheduleText_(raw.id || raw.sesion_id) || createCalendarRecordId_('SES'), day: day, slotId: slotId, activityId: activityId, support: support };
  });
}

function persistScheduleConfig_(spreadsheet, config) {
  writeScheduleTable_(spreadsheet.getSheetByName(CP.SHEETS.SCHEDULE_SLOTS), CP_SCHEDULE_HEADERS.SLOTS, config.slots.map(function(slot) { return [slot.id, slot.type, slot.name, slot.startTime, slot.durationMinutes]; }));
  writeScheduleTable_(spreadsheet.getSheetByName(CP.SHEETS.SCHEDULE_ACTIVITIES), CP_SCHEDULE_HEADERS.ACTIVITIES, config.activities.map(function(activity) { return [activity.id, activity.category, activity.name, activity.acronym, activity.teachingTypeId, activity.group, activity.classroom, activity.color]; }));
  writeScheduleTable_(spreadsheet.getSheetByName(CP.SHEETS.SCHEDULE_SESSIONS), CP_SCHEDULE_HEADERS.SESSIONS, config.sessions.map(function(session) { return [session.id, session.day, session.slotId, session.activityId, session.support]; }));
}

function writeScheduleTable_(sheet, headers, rows) {
  const requiredRows = Math.max(2, rows.length + 1);
  ensureSheetSize_(sheet, requiredRows, headers.length);
  const rowsToClear = Math.max(1, sheet.getLastRow() - 1, rows.length);
  sheet.getRange(2, 1, rowsToClear, headers.length).clearContent();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(2, 1, Math.max(1, rows.length), headers.length).setNumberFormat('@');
}

function clearWeeklyScheduleForNewCourse_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  assertScheduleStructureReady_(spreadsheet);
  writeScheduleTable_(
    spreadsheet.getSheetByName(CP.SHEETS.SCHEDULE_SESSIONS),
    CP_SCHEDULE_HEADERS.SESSIONS,
    []
  );
  return 'Asignaciones semanales y apoyos del curso anterior eliminados.';
}

function captureScheduleSnapshots_(spreadsheet) {
  return [
    [CP.SHEETS.SCHEDULE_SLOTS, CP_SCHEDULE_HEADERS.SLOTS.length],
    [CP.SHEETS.SCHEDULE_ACTIVITIES, CP_SCHEDULE_HEADERS.ACTIVITIES.length],
    [CP.SHEETS.SCHEDULE_SESSIONS, CP_SCHEDULE_HEADERS.SESSIONS.length],
  ].map(function(definition) {
    const sheet = spreadsheet.getSheetByName(definition[0]);
    return { sheetName: definition[0], width: definition[1], values: sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), definition[1]).getValues() };
  });
}

function restoreScheduleSnapshots_(spreadsheet, snapshots) {
  snapshots.forEach(function(snapshot) {
    const sheet = spreadsheet.getSheetByName(snapshot.sheetName);
    const rows = Math.max(sheet.getLastRow(), snapshot.values.length);
    ensureSheetSize_(sheet, rows, snapshot.width);
    sheet.getRange(1, 1, rows, snapshot.width).clearContent();
    sheet.getRange(1, 1, snapshot.values.length, snapshot.width).setValues(snapshot.values);
  });
}

function getScheduleTimeSlots_() {
  const slots = readScheduleRows_(CP.SHEETS.SCHEDULE_SLOTS, CP_SCHEDULE_HEADERS.SLOTS.length).map(function(row) {
    return { id: normalizeScheduleText_(row[0]), type: normalizeScheduleText_(row[1]), name: normalizeScheduleText_(row[2]), startTime: normalizeScheduleTime_(row[3]), durationMinutes: Number(row[4]) };
  });
  return normalizeScheduleSlotChain_(sortScheduleSlots_(slots));
}

function getTeachingTimeSlots_() { return getScheduleTimeSlots_().filter(function(slot) { return slot.type === 'SESION'; }); }

function getScheduleActivities_() {
  return readScheduleRows_(CP.SHEETS.SCHEDULE_ACTIVITIES, CP_SCHEDULE_HEADERS.ACTIVITIES.length).map(function(row) {
    return { id: normalizeScheduleText_(row[0]), category: normalizeScheduleActivityCategory_(row[1]), name: normalizeScheduleText_(row[2]), acronym: normalizeScheduleText_(row[3]), teachingTypeId: normalizeScheduleText_(row[4]), group: normalizeScheduleText_(row[5]), classroom: normalizeScheduleText_(row[6]), color: normalizeScheduleColor_(row[7]) };
  });
}

function getModuleActivities_() {
  return getScheduleActivities_().filter(function(activity) {
    return activity.category === 'MODULO';
  });
}

function getModuleActivityById_(activityId) {
  const normalizedId = normalizeScheduleText_(activityId);
  return getModuleActivities_().find(function(activity) {
    return activity.id === normalizedId;
  }) || null;
}

function getModuleDisplayName_(activity) {
  if (!activity) return '';
  const acronym = normalizeScheduleText_(activity.acronym) || normalizeScheduleText_(activity.name);
  const group = normalizeScheduleText_(activity.group);
  return [acronym, group].filter(Boolean).join(' · ');
}

function getWeeklySchedule_() {
  return readScheduleRows_(CP.SHEETS.SCHEDULE_SESSIONS, CP_SCHEDULE_HEADERS.SESSIONS.length).map(function(row) {
    return { id: normalizeScheduleText_(row[0]), day: normalizeScheduleText_(row[1]), slotId: normalizeScheduleText_(row[2]), activityId: normalizeScheduleText_(row[3]), support: normalizeScheduleText_(row[4]) };
  });
}

function getScheduleAssignmentsForDay_(dayCode) { return getWeeklySchedule_().filter(function(session) { return session.day === normalizeScheduleText_(dayCode).toUpperCase(); }); }
function getScheduleAssignment_(dayCode, slotId) { return getScheduleAssignmentsForDay_(dayCode).find(function(session) { return session.slotId === normalizeScheduleText_(slotId); }) || null; }
function getScheduleSessionsForActivity_(activityId) { return getWeeklySchedule_().filter(function(session) { return session.activityId === normalizeScheduleText_(activityId); }); }
function countWeeklySessionsForActivity_(activityId) { const slots = getTeachingTimeSlots_().reduce(function(map, slot) { map[slot.id] = true; return map; }, {}); return getScheduleSessionsForActivity_(activityId).filter(function(session) { return slots[session.slotId]; }).length; }

function getCurrentScheduleSlot_(date) {
  const now = date || new Date();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const timeZone = spreadsheet.getSpreadsheetTimeZone();
  const dayNumber = Number(Utilities.formatDate(now, timeZone, 'u'));
  const day = CP_SCHEDULE_DAYS[dayNumber - 1];
  if (!day) return null;
  const minutes = Number(Utilities.formatDate(now, timeZone, 'H')) * 60 + Number(Utilities.formatDate(now, timeZone, 'm'));
  return getScheduleTimeSlots_().find(function(slot) { return timeToMinutes_(slot.startTime) <= minutes && minutes < getTimeSlotEndMinutes_(slot); }) || null;
}

function readScheduleRows_(sheetName, width) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues().filter(function(row) { return row.some(function(value) { return normalizeScheduleText_(value); }); });
}
function normalizeScheduleText_(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function normalizeScheduleTime_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'HH:mm');
  const text = normalizeScheduleText_(value);
  if (!CP_SCHEDULE_TIME_PATTERN.test(text)) throw new Error('Las horas deben utilizar el formato HH:mm.');
  return text;
}
function timeToMinutes_(value) { const match = CP_SCHEDULE_TIME_PATTERN.exec(normalizeScheduleText_(value)); if (!match) throw new Error('Las horas deben utilizar el formato HH:mm.'); return Number(match[1]) * 60 + Number(match[2]); }
function minutesToTime_(minutes) {
  const total = Number(minutes);
  if (!Number.isInteger(total) || total < 0 || total > 24 * 60) throw new Error('No se puede representar la hora calculada.');
  if (total === 24 * 60) return '24:00';
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}
function getTimeSlotEndMinutes_(slot) { return timeToMinutes_(slot.startTime) + Number(slot.durationMinutes); }
function getTimeSlotEndTime_(slot) { return minutesToTime_(getTimeSlotEndMinutes_(slot)); }
function normalizeScheduleActivityCategory_(value) { const category = normalizeScheduleText_(value).toUpperCase(); return category === 'COORDINACION' ? 'REUNION' : category; }
function normalizeScheduleColor_(value) { const color = normalizeScheduleText_(value).toUpperCase(); if (!CP_SCHEDULE_COLOR_PATTERN.test(color)) throw new Error('El color de una actividad debe tener el formato #RRGGBB.'); return color; }
