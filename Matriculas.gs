const CP_ENROLLMENT_HEADERS = Object.freeze(['alumno_id', 'actividad_id', 'activo', 'origen']);
const CP_ENROLLMENT_META_HEADERS = Object.freeze(['actividad_id', 'modo']);

function normalizeEnrollmentKey_(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase();
}

function normalizeEnrollmentGroupHint_(value) {
  return normalizeEnrollmentKey_(value).replace(/\bONLINE\b/g, 'VIRTUAL')
    .replace(/[\s\-_–—]+/g, '');
}

function studentImportKey_(student) {
  return [student.surname, student.name, student.group].map(normalizeEnrollmentKey_).join('\n');
}

function studentImportIdentityKey_(student) {
  return [normalizeEnrollmentKey_(student.surname), normalizeEnrollmentKey_(student.name),
    normalizeEnrollmentGroupHint_(student.group)].join('\n');
}

function ensureEnrollmentStructure_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  [[CP.SHEETS.ENROLLMENTS, CP_ENROLLMENT_HEADERS],
    [CP.SHEETS.ENROLLMENT_META, CP_ENROLLMENT_META_HEADERS]].forEach(function(entry) {
    const sheet = getOrCreateSheet_(book, entry[0]);
    ensureSheetSize_(sheet, 2, entry[1].length);
    const current = sheet.getRange(1, 1, 1, entry[1].length).getValues()[0];
    if (current.every(function(value) { return !value; })) {
      sheet.getRange(1, 1, 1, entry[1].length).setValues([entry[1]]);
    } else if (current.some(function(value, index) { return value !== entry[1][index]; })) {
      throw new Error('La estructura de ' + entry[0] + ' no coincide con el esquema 13.');
    }
    sheet.hideSheet();
    installManagedSheetProtections_(sheet, 'TECNICA');
  });
  normalizeEnrollmentStorage_(book);
}

function readEnrollmentRows_(book) {
  const sheet = book.getSheetByName(CP.SHEETS.ENROLLMENTS);
  return sheet && sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues()
      .filter(function(row) { return row[0] && row[1]; })
      .map(function(row) { return { studentId: String(row[0]), activityId: String(row[1]),
        active: row[2] === true || String(row[2]).toUpperCase() === 'TRUE',
        origin: String(row[3] || '') }; }) : [];
}

function readEnrollmentModes_(book) {
  const sheet = book.getSheetByName(CP.SHEETS.ENROLLMENT_META);
  const rows = sheet && sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues() : [];
  return rows.reduce(function(map, row) {
    if (row[0] && row[1] === 'EXPLICITA') map[String(row[0])] = true;
    return map;
  }, {});
}

function writeEnrollmentTable_(book, sheetName, headers, rows) {
  const sheet = book.getSheetByName(sheetName);
  if (!sheet) throw new Error('Falta la hoja técnica ' + sheetName + '. Usa «Reparar estructura».');
  const oldCount = Math.max(0, sheet.getLastRow() - 1);
  ensureSheetSize_(sheet, Math.max(2, rows.length + 1), headers.length);
  if (oldCount) sheet.getRange(2, 1, oldCount, headers.length).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function writeEnrollmentState_(book, enrollments, modes) {
  writeEnrollmentTable_(book, CP.SHEETS.ENROLLMENTS, CP_ENROLLMENT_HEADERS,
    enrollments.map(function(item) { return [item.studentId, item.activityId,
      item.active === true, item.origin]; }));
  writeEnrollmentTable_(book, CP.SHEETS.ENROLLMENT_META, CP_ENROLLMENT_META_HEADERS,
    Object.keys(modes).filter(function(id) { return modes[id]; })
      .map(function(id) { return [id, 'EXPLICITA']; }));
}

function getEnrollmentStudents_(book) {
  const sheet = book.getSheetByName(CP.SHEETS.STUDENTS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, CP_STUDENT_HEADERS.length)
    .getValues().map(function(row, index) { return {
      rowNumber: index + 2, surname: String(row[0] || '').trim(),
      name: String(row[1] || '').trim(), group: String(row[2] || '').trim(),
      email: String(row[3] || ''), reaca: row[4] === true,
      measures: String(row[5] || ''), id: String(row[6] || '').trim(),
    }; }).filter(function(student) { return student.surname && student.name && student.group; });
}

function getModuleActivitiesForEnrollment_() {
  return getScheduleActivities_().filter(function(activity) { return activity.category === 'MODULO'; });
}

function getStudentsForModuleActivity_(book, activity) {
  if (!readEnrollmentModes_(book)[activity.id]) return getEvaluationStudents_(book, activity.group);
  const active = readEnrollmentRows_(book).reduce(function(map, row) {
    if (row.activityId === activity.id) map[row.studentId] = row.active;
    return map;
  }, {});
  return getEnrollmentStudents_(book).filter(function(student) { return active[student.id] === true; })
    .map(function(student) { return { id: student.id, surname: student.surname,
      name: student.name, reaca: student.reaca, measures: student.measures }; });
}

function normalizeEnrollmentStorage_(book) {
  const students = getEnrollmentStudents_(book);
  const byId = students.reduce(function(map, student) { if (student.id) map[student.id] = student; return map; }, {});
  const activities = getModuleActivitiesForEnrollment_().reduce(function(map, activity) {
    map[activity.id] = activity; return map;
  }, {});
  const original = readEnrollmentRows_(book);
  const byPair = {};
  original.forEach(function(row) {
    const student = byId[row.studentId], activity = activities[row.activityId];
    if (!student || !activity) return;
    const key = row.studentId + '\n' + row.activityId;
    if (byPair[key]) {
      byPair[key].active = byPair[key].active && row.active;
    } else {
      byPair[key] = Object.assign({}, row);
    }
  });
  const modes = readEnrollmentModes_(book);
  const originalModes = Object.assign({}, modes);
  Object.keys(modes).forEach(function(id) { if (!activities[id]) delete modes[id]; });
  const normalized = Object.keys(byPair).map(function(key) { return byPair[key]; });
  const metaSheet = book.getSheetByName(CP.SHEETS.ENROLLMENT_META);
  const metaCount = Math.max(0, metaSheet.getLastRow() - 1);
  if (JSON.stringify(normalized) !== JSON.stringify(original) ||
      JSON.stringify(modes) !== JSON.stringify(originalModes) ||
      metaCount !== Object.keys(modes).length) {
    writeEnrollmentState_(book, normalized, modes);
  }
}

function getModuleEnrollmentCandidates_(students, activity, enrollments) {
  const group = normalizeEnrollmentGroupHint_(activity.group);
  const related = {};
  enrollments.forEach(function(row) {
    if (row.activityId === activity.id) related[row.studentId] = true;
  });
  return students.filter(function(student) {
    return normalizeEnrollmentGroupHint_(student.group) === group || related[student.id];
  });
}

function getModuleEnrollmentManagerData_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const modules = getModuleActivitiesForEnrollment_();
  const students = getEnrollmentStudents_(book);
  const rows = readEnrollmentRows_(book);
  const modes = readEnrollmentModes_(book);
  const candidatesByModule = {};
  modules.forEach(function(module) {
    candidatesByModule[module.id] = getModuleEnrollmentCandidates_(students, module, rows)
      .map(function(student) { return student.rowNumber; });
  });
  return { modules: modules.map(function(module) { return {
    id: module.id, name: module.name, acronym: module.acronym, group: module.group,
  }; }), students: students.map(function(student) { return {
    id: student.id, rowNumber: student.rowNumber, surname: student.surname,
    name: student.name, group: student.group,
  }; }), enrollments: rows.map(function(row) { return {
    studentId: row.studentId, activityId: row.activityId, active: row.active,
  }; }), modes: modes, candidatesByModule: candidatesByModule };
}

function saveModuleEnrollments(input) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('Hay otra operación en curso. Inténtalo de nuevo.');
  try {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    const activity = getModuleActivitiesForEnrollment_().find(function(item) {
      return item.id === String(input && input.activityId || '');
    });
    if (!activity) throw new Error('Selecciona un módulo válido.');
    if (!Array.isArray(input.studentIds)) throw new Error('La selección de alumnado no es válida.');
    const candidates = getModuleEnrollmentCandidates_(getEnrollmentStudents_(book), activity,
      readEnrollmentRows_(book));
    if (candidates.some(function(student) { return !student.id; })) {
      throw new Error('Hay alumnado sin alumno_id. Repara primero 3 Alumnado.');
    }
    const allowed = candidates.reduce(function(map, student) { map[student.id] = true; return map; }, {});
    const selected = {};
    input.studentIds.forEach(function(id) {
      if (!allowed[id] || selected[id]) throw new Error('La matrícula contiene un alumno no disponible para este módulo o repetido.');
      selected[id] = true;
    });
    ensureEnrollmentStructure_();
    const previous = readEnrollmentRows_(book);
    const rows = previous.filter(function(row) {
      return row.activityId !== activity.id || !allowed[row.studentId];
    }).map(function(row) {
      return row.activityId === activity.id ? Object.assign({}, row, { active: false }) : row;
    });
    candidates.forEach(function(student) { rows.push({ studentId: student.id,
      activityId: activity.id, active: Boolean(selected[student.id]), origin: 'MANUAL' }); });
    const modes = readEnrollmentModes_(book);
    modes[activity.id] = true;
    writeEnrollmentState_(book, rows, modes);
    repairEvaluationsForActivities_([activity.id]);
    return { selected: input.studentIds.length, total: candidates.length };
  } finally { lock.releaseLock(); }
}

function repairEvaluationsForActivities_(activityIds) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const wanted = activityIds.reduce(function(map, id) { map[id] = true; return map; }, {});
  readModuleConfigRegistry_(book).forEach(function(record) {
    if (!wanted[record.activityId] || !record.evaluationSheetId) return;
    const activity = getModuleActivityById_(record.activityId);
    const sheet = getSheetById_(book, record.evaluationSheetId);
    const configSheet = getSheetById_(book, record.sheetId);
    if (activity && sheet && configSheet) {
      repairEvaluationSheet_(sheet, configSheet,
        validateModuleConfigPrerequisites_(book, activity), activity);
    }
  });
}

function clearEnrollmentsForNewCourse_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  ensureEnrollmentStructure_();
  writeEnrollmentState_(book, [], {});
}

function captureNewCourseEnrollmentSnapshots_(book) {
  return [CP.SHEETS.ENROLLMENTS, CP.SHEETS.ENROLLMENT_META].map(function(name) {
    const sheet = book.getSheetByName(name);
    const width = name === CP.SHEETS.ENROLLMENTS ? 4 : 2;
    return { name: name, existed: Boolean(sheet), width: width,
      values: sheet ? sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), width).getValues() : [] };
  });
}

function restoreNewCourseEnrollmentSnapshots_(book, snapshots) {
  (snapshots || []).forEach(function(snapshot) {
    let sheet = book.getSheetByName(snapshot.name);
    if (!snapshot.existed) {
      if (sheet) book.deleteSheet(sheet);
      return;
    }
    if (!sheet) sheet = book.insertSheet(snapshot.name);
    const count = Math.max(1, sheet.getLastRow(), snapshot.values.length);
    ensureSheetSize_(sheet, count, snapshot.width);
    sheet.getRange(1, 1, count, snapshot.width).clearContent();
    sheet.getRange(1, 1, snapshot.values.length, snapshot.width).setValues(snapshot.values);
    sheet.hideSheet();
  });
}

function abrirMatriculasModulos() {
  const template = HtmlService.createTemplateFromFile('UiDialogMatriculas');
  setCommonUiTemplateData_(template);
  SpreadsheetApp.getUi().showModalDialog(template.evaluate()
    .setWidth(CP.UI.MODULE_ENROLLMENTS_DIALOG_WIDTH)
    .setHeight(CP.UI.MODULE_ENROLLMENTS_DIALOG_HEIGHT), CP.MENU.MODULE_ENROLLMENTS);
}

function obtenerDatosMatriculasModulos() { return getModuleEnrollmentManagerData_(); }
