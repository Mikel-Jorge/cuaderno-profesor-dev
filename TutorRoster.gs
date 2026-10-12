const CP_TUTOR_ROSTER_HEADERS = Object.freeze(['alumno_id', 'curso', 'grupo', 'activo']);

function ensureTutorRosterStructure_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet_(book, CP.SHEETS.TUTOR_ROSTER);
  ensureSheetSize_(sheet, 2, CP_TUTOR_ROSTER_HEADERS.length);
  const header = sheet.getRange(1, 1, 1, CP_TUTOR_ROSTER_HEADERS.length).getValues()[0];
  if (header.every(function(value) { return !value; })) {
    sheet.getRange(1, 1, 1, CP_TUTOR_ROSTER_HEADERS.length).setValues([CP_TUTOR_ROSTER_HEADERS]);
  } else if (header.some(function(value, index) { return value !== CP_TUTOR_ROSTER_HEADERS[index]; })) {
    throw new Error('La estructura de _TUT_ALUMNADO no coincide con el esquema 14. Usa «Reparar estructura».');
  }
  sheet.hideSheet();
  installManagedSheetProtections_(sheet, 'TECNICA');
  return sheet;
}

function readTutorRosterRows_(book) {
  const sheet = book.getSheetByName(CP.SHEETS.TUTOR_ROSTER);
  if (!sheet) return [];
  const header = sheet.getRange(1, 1, 1, CP_TUTOR_ROSTER_HEADERS.length).getValues()[0];
  if (header.some(function(value, index) { return value !== CP_TUTOR_ROSTER_HEADERS[index]; })) {
    throw new Error('Repara la estructura de _TUT_ALUMNADO antes de sincronizar Tutoría.');
  }
  return sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, CP_TUTOR_ROSTER_HEADERS.length).getValues()
      .filter(function(row) { return row[0] && row[1] && row[2]; })
      .map(function(row) { return { studentId: String(row[0]), course: String(row[1]),
        group: String(row[2]), active: row[3] === true || String(row[3]).toUpperCase() === 'TRUE' }; })
    : [];
}

function writeTutorRosterRows_(book, rows) {
  const sheet = ensureTutorRosterStructure_();
  const oldCount = Math.max(0, sheet.getLastRow() - 1);
  ensureSheetSize_(sheet, Math.max(2, rows.length + 1), CP_TUTOR_ROSTER_HEADERS.length);
  if (oldCount) sheet.getRange(2, 1, oldCount, CP_TUTOR_ROSTER_HEADERS.length).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, CP_TUTOR_ROSTER_HEADERS.length)
    .setValues(rows.map(function(row) { return [row.studentId, row.course, row.group, row.active === true]; }));
}

function getActiveTutorRoster_(book, config) {
  const settings = config || getGeneralConfigValues_(book);
  if (!isTutorEnabled_(settings[CP.CONFIG_KEYS.IS_TUTOR])) return [];
  const group = settings[CP.CONFIG_KEYS.TUTOR_GROUP];
  const course = settings[CP.CONFIG_KEYS.ACADEMIC_YEAR];
  if (!group || !course) return [];
  return readTutorRosterRows_(book).filter(function(row) {
    return row.active && row.course === course &&
      normalizeTutorText_(row.group) === normalizeTutorText_(group);
  });
}

function deactivateTutorRoster_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const rows = readTutorRosterRows_(book);
  const course = getGeneralConfigValues_(book)[CP.CONFIG_KEYS.ACADEMIC_YEAR];
  if (!rows.some(function(row) { return row.active && row.course === course; })) return;
  rows.forEach(function(row) { if (row.course === course) row.active = false; });
  writeTutorRosterRows_(book, rows);
}

function clearTutorRosterForNewCourse_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureTutorRosterStructure_();
  const count = Math.max(0, sheet.getLastRow() - 1);
  if (count) sheet.getRange(2, 1, count, CP_TUTOR_ROSTER_HEADERS.length).clearContent();
}

function captureTutorRosterSnapshot_(book) {
  const sheet = book.getSheetByName(CP.SHEETS.TUTOR_ROSTER);
  return { existed: Boolean(sheet), values: sheet
    ? sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), CP_TUTOR_ROSTER_HEADERS.length).getValues()
    : [] };
}

function restoreTutorRosterSnapshot_(book, snapshot) {
  const sheet = book.getSheetByName(CP.SHEETS.TUTOR_ROSTER);
  if (!snapshot.existed) {
    if (sheet) book.deleteSheet(sheet);
    return;
  }
  const target = sheet || ensureTutorRosterStructure_();
  const count = Math.max(target.getLastRow(), snapshot.values.length);
  target.getRange(1, 1, count, CP_TUTOR_ROSTER_HEADERS.length).clearContent();
  target.getRange(1, 1, snapshot.values.length, CP_TUTOR_ROSTER_HEADERS.length)
    .setValues(snapshot.values);
}
