function abrirImportadorTutoria() {
  assertTutorImportEnabled_();
  const template = HtmlService.createTemplateFromFile('UiDialogTutorImport');
  setCommonUiTemplateData_(template);
  SpreadsheetApp.getUi().showModalDialog(template.evaluate()
    .setWidth(CP.UI.TUTOR_IMPORT_DIALOG_WIDTH)
    .setHeight(CP.UI.TUTOR_IMPORT_DIALOG_HEIGHT), CP.MENU.TUTOR_IMPORT);
}

function assertTutorImportEnabled_() {
  const config = getGeneralConfigValues_(SpreadsheetApp.getActiveSpreadsheet());
  if (!isTutorEnabled_(config[CP.CONFIG_KEYS.IS_TUTOR]) ||
      !String(config[CP.CONFIG_KEYS.TUTOR_GROUP] || '').trim()) {
    throw new Error('Activa «Soy tutor/a» y configura tu Grupo de tutoría en Datos del docente y centro.');
  }
  return config;
}

function readTutorImportReport_(form, config) {
  if (!form || !form.archivo) throw new Error(CP_TUTOR_FILE_ERROR);
  const report = parseTutorEducaFile_(form.archivo);
  const configured = config[CP.CONFIG_KEYS.TUTOR_GROUP];
  if (normalizeTutorText_(report.group) !== normalizeTutorText_(configured)) {
    throw new Error('El informe pertenece al grupo «' + report.group +
      '», pero el Cuaderno está configurado como Tutoría de «' + configured +
      '». Revisa Datos del docente y centro o descarga el informe correcto.');
  }
  return report;
}

function buildTutorImportPlan_(book, report) {
  const existingByKey = {};
  const wanted = {};
  report.students.forEach(function(student) { wanted[student.key] = true; });
  getEnrollmentStudents_(book).forEach(function(student) {
    const key = tutorStudentKey_(student.surname, student.name, student.group);
    if (!wanted[key]) return;
    if (existingByKey[key]) throw new Error('Hay alumnado con identidad ambigua en 3 Alumnado. Revisa los duplicados.');
    existingByKey[key] = student;
  });
  return report.students.map(function(student) {
    const existing = existingByKey[student.key];
    return { key: student.key, surname: student.surname, name: student.name,
      group: report.group, email: existing ? String(existing.email || '').trim() : '',
      studentId: existing ? existing.id : '', rowNumber: existing ? existing.rowNumber : 0 };
  });
}

function analizarArchivoTutorEduca(form) {
  const config = assertTutorImportEnabled_();
  const report = readTutorImportReport_(form, config);
  const students = buildTutorImportPlan_(SpreadsheetApp.getActiveSpreadsheet(), report);
  return { group: report.group, sheetCount: report.sheetCount, students: students };
}

function validateTutorEmails_(plan, raw) {
  let provided;
  try { provided = JSON.parse(String(raw || '')); }
  catch (error) { throw new Error('Revisa los correos de todo el alumnado antes de importar.'); }
  if (!provided || typeof provided !== 'object' || Array.isArray(provided) ||
      Object.keys(provided).length !== plan.length) {
    throw new Error('La lista de correos ha cambiado. Analiza de nuevo el archivo.');
  }
  const emails = {};
  plan.forEach(function(student) {
    if (!Object.prototype.hasOwnProperty.call(provided, student.key) ||
        typeof provided[student.key] !== 'string') {
      throw new Error('La lista de correos ha cambiado. Analiza de nuevo el archivo.');
    }
    const email = provided[student.key].trim();
    if (!isValidContactEmail_(normalizeContactEmail_(email))) {
      throw new Error('Todos los alumnos deben tener un Email válido antes de importar.');
    }
    emails[student.key] = email;
  });
  return emails;
}

function applyTutorStudents_(book, plan, emails) {
  const sheet = book.getSheetByName(CP.SHEETS.STUDENTS);
  if (!sheet) throw new Error('Falta 3 Alumnado. Usa «Reparar estructura».');
  const count = Math.max(0, sheet.getLastRow() - 1);
  const rows = count ? sheet.getRange(2, 1, count, CP_STUDENT_HEADERS.length).getValues() : [];
  const ids = {};
  plan.forEach(function(student) {
    const email = emails[student.key];
    if (student.rowNumber) {
      const row = rows[student.rowNumber - 2];
      if (!row || String(row[6] || '') !== student.studentId) {
        throw new Error('El alumnado ha cambiado. Analiza de nuevo el archivo.');
      }
      row[0] = student.surname;
      row[1] = student.name;
      row[2] = student.group;
      row[3] = email;
      if (!student.studentId) row[6] = Utilities.getUuid();
      ids[student.key] = String(row[6]);
    } else {
      const id = Utilities.getUuid();
      const empty = rows.findIndex(function(row) { return isStudentRowEmpty_(row); });
      if (empty < 0) rows.push([student.surname, student.name, student.group, email, false, '', id]);
      else rows[empty] = [student.surname, student.name, student.group, email, false, '', id];
      ids[student.key] = id;
    }
  });
  ensureSheetSize_(sheet, Math.max(2, rows.length + 1), CP_STUDENT_HEADERS.length);
  if (rows.length) sheet.getRange(2, 1, rows.length, CP_STUDENT_HEADERS.length).setValues(rows);
  return ids;
}

function applyTutorRoster_(book, report, course, ids) {
  const rows = readTutorRosterRows_(book);
  const byId = {};
  rows.forEach(function(row) {
    if (row.course === course && normalizeTutorText_(row.group) === normalizeTutorText_(report.group)) {
      row.active = false;
      byId[row.studentId] = row;
    }
  });
  report.students.forEach(function(student) {
    const id = ids[student.key];
    if (byId[id]) {
      byId[id].group = report.group;
      byId[id].active = true;
    } else {
      rows.push({ studentId: id, course: course, group: report.group, active: true });
    }
  });
  writeTutorRosterRows_(book, rows);
}

function captureTutorImportSnapshots_(book) {
  const students = book.getSheetByName(CP.SHEETS.STUDENTS);
  if (!students) throw new Error('Falta 3 Alumnado. Usa «Reparar estructura».');
  const roster = book.getSheetByName(CP.SHEETS.TUTOR_ROSTER);
  return {
    students: { count: students.getLastRow(),
      rows: students.getRange(1, 1, Math.max(1, students.getLastRow()), CP_STUDENT_HEADERS.length).getValues() },
    roster: { existed: Boolean(roster), count: roster ? roster.getLastRow() : 0,
      rows: roster ? roster.getRange(1, 1, Math.max(1, roster.getLastRow()),
        CP_TUTOR_ROSTER_HEADERS.length).getValues() : [] },
  };
}

function restoreTutorImportSnapshots_(book, snapshot) {
  const students = book.getSheetByName(CP.SHEETS.STUDENTS);
  const count = Math.max(students.getLastRow(), snapshot.students.count);
  students.getRange(1, 1, count, CP_STUDENT_HEADERS.length).clearContent();
  students.getRange(1, 1, snapshot.students.rows.length, CP_STUDENT_HEADERS.length)
    .setValues(snapshot.students.rows);
  const roster = book.getSheetByName(CP.SHEETS.TUTOR_ROSTER);
  if (!snapshot.roster.existed) {
    if (roster) book.deleteSheet(roster);
  } else {
    const size = Math.max(roster.getLastRow(), snapshot.roster.count);
    roster.getRange(1, 1, size, CP_TUTOR_ROSTER_HEADERS.length).clearContent();
    roster.getRange(1, 1, snapshot.roster.rows.length, CP_TUTOR_ROSTER_HEADERS.length)
      .setValues(snapshot.roster.rows);
  }
}

function importarAlumnadoTutoria(form) {
  const lock = LockService.getDocumentLock();
  if (!lock || !lock.tryLock(30000)) throw new Error('Hay otra importación en curso. Inténtalo de nuevo.');
  let result;
  let stage = 'VALIDATION';
  try {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    const config = assertTutorImportEnabled_();
    const report = readTutorImportReport_(form, config);
    const plan = buildTutorImportPlan_(book, report);
    const emails = validateTutorEmails_(plan, form.emails);
    const snapshot = captureTutorImportSnapshots_(book);
    try {
      stage = 'STUDENTS';
      const ids = applyTutorStudents_(book, plan, emails);
      stage = 'ROSTER';
      applyTutorRoster_(book, report, config[CP.CONFIG_KEYS.ACADEMIC_YEAR], ids);
      normalizeStudentsAfterManagedImport_(book);
      if (config[CP.CONFIG_KEYS.TUTOR_GROUP] !== report.group) {
        stage = 'TUTOR_CONFIG';
        config[CP.CONFIG_KEYS.TUTOR_GROUP] = report.group;
        saveGeneralConfig_(config, { showToast: false, updateCover: true });
      }
      result = { ok: true, academicImported: true, contactsOk: false,
        contactsWarning: '', imported: plan.length };
    } catch (error) {
      try { restoreTutorImportSnapshots_(book, snapshot); }
      catch (restoreError) { console.warn('No se pudieron restaurar todos los datos de Tutoría.'); }
      try { createOrRepairStudentsSheet_(); }
      catch (repairError) { console.warn('No se pudo restaurar el formato de Alumnado.'); }
      throw error;
    }
  } catch (error) {
    console.warn('TUTOR_IMPORT_STAGE=' + stage);
    return { ok: false, academicImported: false, contactsOk: false,
      contactsWarning: '', message: tutorImportErrorMessage_(error) };
  } finally { lock.releaseLock(); }
  try {
    stage = 'CONTACTS';
    const sync = executeContactsSync_(null, null, null, true);
    if (sync.incidents) throw new Error('Sincronización parcial');
    const book = SpreadsheetApp.getActiveSpreadsheet();
    const values = {};
    values[CP.CONFIG_KEYS.CONTACTS_SYNC_COURSE] = getGeneralConfigValues_(book)[CP.CONFIG_KEYS.ACADEMIC_YEAR];
    updateConfigValues_(book.getSheetByName(CP.SHEETS.CONFIG), values, [CP.CONFIG_KEYS.CONTACTS_SYNC_COURSE]);
    result.contactsOk = true;
  } catch (error) {
    console.warn('TUTOR_IMPORT_STAGE=' + stage);
    result.contactsWarning = 'No se ha podido actualizar Google Contacts.';
    try { SpreadsheetApp.getActiveSpreadsheet().toast(
      'Alumnado de tutoría importado. No se ha podido actualizar Google Contacts; puedes reintentarlo desde Alumnado → Sincronizar Google Contacts.'); }
    catch (toastError) { console.warn('No se pudo mostrar el aviso de Google Contacts.'); }
  }
  return result;
}

function tutorImportErrorMessage_(error) {
  const message = error && error.message ? String(error.message).split('\n')[0] : '';
  return /informe|archivo|correo|Email|grupo|Tutoría|Alumnado|Reparar|importación/.test(message)
    ? message : 'No se ha podido completar la importación de Tutoría. Revisa el archivo y vuelve a intentarlo.';
}
