function abrirAsistenteNuevoCurso() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const currentConfig = getGeneralConfigValues_(spreadsheet);
  const currentLocation = getNotebookDriveLocation_();
  const currentFileName = spreadsheet.getName();
  const proposedAcademicYear = proponerCursoAcademico_(
    new Date(),
    spreadsheet.getSpreadsheetTimeZone()
  );
  const wizardConfig = Object.assign({}, currentConfig);
  wizardConfig[CP.CONFIG_KEYS.ACADEMIC_YEAR] = proposedAcademicYear;

  const template = HtmlService.createTemplateFromFile('UiDialogNewCourse');
  template.currentAcademicYear = currentConfig[CP.CONFIG_KEYS.ACADEMIC_YEAR] || '';
  template.currentLocation = currentLocation;
  template.currentFileName = currentFileName;
  template.wizardConfig = wizardConfig;
  template.themeConfig = getThemeConfigForUi_(spreadsheet, currentConfig);
  template.courseDraft = getNewCourseDraft_();
  template.courseSummary = getNewCourseDraftSummary_(template.courseDraft);
  setCommonUiTemplateData_(template);

  const output = template.evaluate()
    .setWidth(CP.UI.NEW_COURSE_DIALOG_WIDTH)
    .setHeight(CP.UI.NEW_COURSE_DIALOG_HEIGHT);

  SpreadsheetApp.getUi().showModalDialog(output, CP.MENU.NEW_COURSE);
}

function validarPreparacionNuevoCurso(input) {
  const processInput = normalizeNewCourseProcessInput_(input);
  validateNotebookOriginalLocation_(processInput);
  return processInput;
}

function iniciarPreparacionNuevoCurso(input) {
  const draft = getNewCourseDraft_();
  if (!draft.reviewed[0]) throw new Error('Completa el paso Seguridad antes de generar.');
  if (draft.generationPhase >= 1) return getNewCourseDraftSummary_(draft);
  const processInput = normalizeNewCourseProcessInput_({
    config: draft.config,
    originalFileName: draft.originalFileName,
    originalFolderId: draft.originalFolderId,
    destinationFolderId: draft.destinationFolderId,
  });
  validateNotebookOriginalLocation_(processInput);
  processInput.previousConfig = getGeneralConfigValues_(
    SpreadsheetApp.getActiveSpreadsheet()
  );
  const process = getNewCourseProcessDefinition_(processInput);
  process.steps.forEach(function(step) { step.run(process.input); });
  draft.generationPhase = 1;
  saveNewCourseDraft_(draft);
  return getNewCourseDraftSummary_(draft);
}

function guardarDatosGeneralesNuevoCurso(input) {
  const values = normalizeGeneralConfigInput_(input);
  validateThemeConfig_(values);
  validateAcademicYear_(values[CP.CONFIG_KEYS.ACADEMIC_YEAR]);
  const draft = getNewCourseDraft_();
  assertNewCourseDraftEditable_(draft);
  draft.config = values;
  draft.reviewed[1] = true;
  saveNewCourseDraft_(draft);
  return { values: values, summary: getNewCourseDraftSummary_(draft) };
}

function guardarCalendarioNuevoCurso(input) {
  if (!input || !Array.isArray(input.types) || !Array.isArray(input.events)) {
    throw new Error('Revisa los datos del calendario.');
  }
  const draft = getNewCourseDraft_();
  assertNewCourseDraftEditable_(draft);
  draft.calendar = input;
  draft.reviewed[2] = true;
  saveNewCourseDraft_(draft);
  return getNewCourseDraftSummary_(draft);
}

function guardarHorarioNuevoCurso(input, step) {
  const section = { 3: 'slots', 4: 'activities', 5: 'sessions' }[step];
  if (!section) throw new Error('El paso de horario no existe.');
  const draft = getNewCourseDraft_();
  assertNewCourseDraftEditable_(draft);
  const normalized = normalizeAndValidateScheduleConfig_(input);
  draft.schedule = normalized;
  draft.reviewed[step] = true;
  saveNewCourseDraft_(draft);
  return getNewCourseDraftSummary_(draft);
}

function guardarSeguridadNuevoCurso(input) {
  const draft = getNewCourseDraft_();
  assertNewCourseDraftEditable_(draft);
  const processInput = normalizeNewCourseProcessInput_(input);
  validateNotebookOriginalLocation_(processInput);
  if (draft.config[CP.CONFIG_KEYS.ACADEMIC_YEAR] !==
      processInput.config[CP.CONFIG_KEYS.ACADEMIC_YEAR]) {
    draft.calendar = createDefaultNewCourseCalendarConfig_(
      SpreadsheetApp.getActiveSpreadsheet(), processInput.config[CP.CONFIG_KEYS.ACADEMIC_YEAR]);
    draft.reviewed[1] = false;
    draft.reviewed[2] = false;
  }
  draft.config = processInput.config;
  draft.originalFileName = processInput.originalFileName;
  draft.originalFolderId = processInput.originalFolderId;
  draft.destinationFolderId = processInput.destinationFolderId;
  draft.visited[0] = true;
  draft.reviewed[0] = true;
  saveNewCourseDraft_(draft);
  return getNewCourseDraftSummary_(draft);
}

function guardarVisitaNuevoCurso(step) {
  if (!Number.isInteger(step) || step < 0 || step > 6) throw new Error('Paso no válido.');
  const draft = getNewCourseDraft_();
  assertNewCourseDraftEditable_(draft);
  draft.visited[step] = true;
  saveNewCourseDraft_(draft);
}

function assertNewCourseDraftEditable_(draft) {
  if (draft.generationPhase) {
    throw new Error('La generación ya ha comenzado. Continúa desde Resumen.');
  }
}

const CP_NEW_COURSE_DRAFT_PREFIX = 'CP_NEW_COURSE_DRAFT_';
function getNewCourseDraft_() {
  const properties = PropertiesService.getDocumentProperties();
  const count = Number(properties.getProperty(CP_NEW_COURSE_DRAFT_PREFIX + 'COUNT') || 0);
  if (count) {
    let json = '';
    for (let index = 0; index < count; index += 1) {
      const chunk = properties.getProperty(CP_NEW_COURSE_DRAFT_PREFIX + index);
      if (chunk === null) throw new Error('El borrador del curso está incompleto.');
      json += chunk;
    }
    return JSON.parse(json);
  }
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const config = Object.assign({}, getGeneralConfigValues_(spreadsheet));
  config[CP.CONFIG_KEYS.ACADEMIC_YEAR] = proponerCursoAcademico_(new Date(), spreadsheet.getSpreadsheetTimeZone());
  const calendar = createDefaultNewCourseCalendarConfig_(
    spreadsheet, config[CP.CONFIG_KEYS.ACADEMIC_YEAR]);
  const schedule = getScheduleConfigForUi_(spreadsheet);
  schedule.sessions = [];
  return { config: config, calendar: calendar, schedule: schedule,
    visited: [true, false, false, false, false, false, false],
    reviewed: [false, false, false, false, false, false, false] };
}

function createDefaultNewCourseCalendarConfig_(spreadsheet, academicYear) {
  const calendar = getCalendarConfigForUi_(spreadsheet);
  calendar.academicYear = academicYear;
  calendar.types.forEach(function(type) {
    type.active = false;
    ['startDate', 'endDate', 'practicesStart', 'practicesEnd', 'reviewStart', 'reviewEnd']
      .forEach(function(key) { type[key] = ''; });
    type.configurePractices = false;
    type.configureReview = false;
    type.evaluations.forEach(function(item) { item.endDate = ''; });
  });
  calendar.events = buildDefaultCalendarEventsForAcademicYear_(
    calendar.academicYear, spreadsheet.getSpreadsheetTimeZone()).map(function(event) {
      return {
        id: event.id,
        startDate: formatCalendarDateForUi_(event.startDate, spreadsheet.getSpreadsheetTimeZone()),
        endDate: formatCalendarDateForUi_(event.endDate, spreadsheet.getSpreadsheetTimeZone()),
        isRange: event.startDate.getTime() !== event.endDate.getTime(),
        category: event.category,
        appliesToAll: true,
        typeIds: [],
        description: event.description,
      };
    });
  return calendar;
}

function saveNewCourseDraft_(draft) {
  const properties = PropertiesService.getDocumentProperties();
  const json = JSON.stringify(draft);
  const chunks = json.match(/[\s\S]{1,2000}/g) || [''];
  if (chunks.length > 150) throw new Error('El borrador es demasiado grande para guardarlo.');
  const previous = Number(properties.getProperty(CP_NEW_COURSE_DRAFT_PREFIX + 'COUNT') || 0);
  chunks.forEach(function(chunk, index) { properties.setProperty(CP_NEW_COURSE_DRAFT_PREFIX + index, chunk); });
  for (let index = chunks.length; index < previous; index += 1) {
    properties.deleteProperty(CP_NEW_COURSE_DRAFT_PREFIX + index);
  }
  properties.setProperty(CP_NEW_COURSE_DRAFT_PREFIX + 'COUNT', String(chunks.length));
}

function clearNewCourseDraft_() {
  const properties = PropertiesService.getDocumentProperties();
  const count = Number(properties.getProperty(CP_NEW_COURSE_DRAFT_PREFIX + 'COUNT') || 0);
  for (let index = 0; index < count; index += 1) properties.deleteProperty(CP_NEW_COURSE_DRAFT_PREFIX + index);
  properties.deleteProperty(CP_NEW_COURSE_DRAFT_PREFIX + 'COUNT');
}

function getNewCourseDraftSummary_(draft) {
  const types = draft.calendar.types.filter(function(type) { return type.active; });
  const calendarReady = types.length > 0 && types.every(function(type) { return type.startDate && type.endDate; });
  const slots = draft.schedule.slots.length;
  const activities = draft.schedule.activities.length;
  const sessions = draft.schedule.sessions.length;
  return { academicYear: draft.config[CP.CONFIG_KEYS.ACADEMIC_YEAR], calendar: calendarReady,
    slots: slots, activities: activities, sessions: sessions,
    visited: draft.visited, reviewed: draft.reviewed,
    reasons: {
      calendar: !types.length ? 'No hay ningún tipo de enseñanza activo.' :
        calendarReady ? '' : 'Faltan fechas en los tipos de enseñanza activos.',
      slots: slots ? '' : 'No hay tramos horarios.',
      activities: activities ? '' : 'No hay actividades.',
      sessions: sessions ? '' : 'No hay sesiones asignadas.',
    } };
}

function aplicarBorradorNuevoCurso() {
  const draft = getNewCourseDraft_();
  if (!draft.reviewed[0]) throw new Error('Completa el paso Seguridad antes de generar.');
  if (draft.generationPhase >= 2) return 'Datos del borrador aplicados.';
  if (draft.generationPhase !== 1) throw new Error('Primero debe crearse la copia de seguridad.');
  saveGeneralConfig_(draft.config, { updateCover: false, showToast: false, includeTheme: true });
  guardarConfiguracionCalendario_(draft.calendar, { renderViews: false, showToast: false });
  guardarConfiguracionHorario_(draft.schedule, { renderViews: false, showToast: false });
  draft.generationPhase = 2;
  saveNewCourseDraft_(draft);
  return 'Datos del borrador aplicados.';
}

function finalizarCalendarioNuevoCurso() {
  const draft = getNewCourseDraft_();
  if (draft.generationPhase >= 3) return 'Calendario preparado.';
  if (draft.generationPhase !== 2) throw new Error('Primero deben aplicarse los datos del nuevo curso.');
  createOrRepairCalendarSheet_({ skipIndex: true, showToast: false });
  draft.generationPhase = 3;
  saveNewCourseDraft_(draft);
  return 'Calendario preparado.';
}

function finalizarHorarioNuevoCurso() {
  const draft = getNewCourseDraft_();
  if (draft.generationPhase >= 4) return 'Horario preparado.';
  if (draft.generationPhase !== 3) throw new Error('Primero debe generarse el calendario.');
  createOrRepairScheduleSheet_({ skipIndex: true });
  draft.generationPhase = 4;
  saveNewCourseDraft_(draft);
  return 'Horario preparado.';
}

function finalizarEstructuraNuevoCurso() {
  const draft = getNewCourseDraft_();
  if (draft.generationPhase !== 4) throw new Error('Primero debe generarse el horario.');
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  hideTechnicalSheets_(spreadsheet);
  reorderManagedVisibleSheets_(spreadsheet);
  initializeCoverStructure_();
  initializeMetaStructure_();
  installAllManagedProtections_();
  clearNewCourseDraft_();
  spreadsheet.toast('Nuevo curso preparado.', CP.PROJECT_NAME, 5);
  return 'Cuaderno preparado.';
}

function obtenerResumenNuevoCurso() {
  return getNewCourseDraftSummary_(getNewCourseDraft_());
}

function obtenerFormularioPasoNuevoCurso(step) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const draft = getNewCourseDraft_();
  const isCalendar = step === 2;
  if (!isCalendar && [3, 4, 5].indexOf(step) === -1) {
    throw new Error('El paso solicitado no existe.');
  }
  const template = HtmlService.createTemplateFromFile(
    isCalendar ? 'UiDialogCalendarConfig' : 'UiDialogScheduleConfig');
  if (isCalendar) {
    template.calendarConfig = Object.assign({}, getCalendarConfigForUi_(spreadsheet),
      draft.calendar, { academicYear: draft.config[CP.CONFIG_KEYS.ACADEMIC_YEAR] });
    template.wizardStep = 0;
  } else {
    template.scheduleConfig = Object.assign({}, getScheduleConfigForUi_(spreadsheet), draft.schedule);
    template.wizardStep = step;
  }
  setCommonUiTemplateData_(template);
  let html = template.evaluate().getContent();
  const bridge = '<style>html,body,.app,.config-form,.config-scroll{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}' +
    '.brand-header,.author-footer,.config-feedback,.save-loading,.wizard-progress,.app>.form-help{display:none!important}.app{padding:4px!important}' +
    (isCalendar ? '' : '.schedule-accordion-toggle{display:none!important}.schedule-accordion-panel{display:block!important;border-top:0!important;padding:0!important}' +
      '.schedule-accordion{border:0!important}.schedule-accordion.is-hidden{display:none!important}') + '</style>' +
    '<script>document.addEventListener("submit",function(event){event.preventDefault();event.stopImmediatePropagation()},true);' +
    'var heightObserver=new ResizeObserver(function(){parent.postMessage({type:"course-wizard-height",step:' + step + ',height:document.documentElement.scrollHeight},"*")});' +
    'heightObserver.observe(document.body);window.addEventListener("load",function(){parent.postMessage({type:"course-wizard-ready",step:' + step + ',height:document.documentElement.scrollHeight},"*")});' +
    'window.addEventListener("message",function(event){if(event.source!==parent||!event.data)return;if(event.data.type==="course-wizard-measure"){parent.postMessage({type:"course-wizard-height",step:' + step + ',height:document.documentElement.scrollHeight},"*");return}if(event.data.type!=="course-wizard-request")return;' +
    'var error="";if(isBlocked)error=blockingErrorElement.textContent;' +
    'else if(isDirty()&&!form.reportValidity())error="Revisa los campos obligatorios.";' +
    (isCalendar ? 'else if(isDirty()&&!validateEventScopes())error="Revisa las fechas especiales.";' : 'else if(isDirty())error=validateSlots()||"";') +
    'parent.postMessage({type:"course-wizard-response",requestId:event.data.requestId,step:' + step +
    ',error:error,dirty:isDirty(),payload:error?null:' +
    (isCalendar ? 'getCalendarPayloadData()' : 'getPayload()') + '},"*")});<\/script>';
  html = html.replace('</body>', bridge + '</body>');
  return html;
}

function normalizeNewCourseProcessInput_(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('No se han recibido los datos del nuevo curso.');
  }

  const config = normalizeGeneralConfigInput_(input.config);
  validateAcademicYear_(config[CP.CONFIG_KEYS.ACADEMIC_YEAR]);
  validateThemeConfig_(config);

  const originalFolder = getDriveFolderById_(input.originalFolderId);
  const destinationFolder = getDriveFolderById_(input.destinationFolderId);
  getMyDriveFolderPath_(originalFolder);
  getMyDriveFolderPath_(destinationFolder);

  const processInput = {
    config: config,
    originalFileName: normalizeNewCourseFileName_(input.originalFileName),
    newFileName: buildNotebookNameFromAcademicYear_(
      config[CP.CONFIG_KEYS.ACADEMIC_YEAR]
    ),
    originalFolderId: originalFolder.getId(),
    originalFolderName: getDriveFolderDisplayName_(originalFolder),
    destinationFolderId: destinationFolder.getId(),
    destinationFolderName: getDriveFolderDisplayName_(destinationFolder),
    moveNotebook: originalFolder.getId() !== destinationFolder.getId(),
  };

  if (input.previousConfig) {
    processInput.previousConfig = normalizeGeneralConfigInput_(input.previousConfig);
  }
  return processInput;
}

function validateNotebookOriginalLocation_(processInput) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const file = DriveApp.getFileById(spreadsheet.getId());
  if (!isFileInFolder_(file, processInput.originalFolderId)) {
    throw new Error(
      'La ubicación actual del cuaderno ha cambiado. Vuelve a abrir el asistente.'
    );
  }
  if (file.getName() !== processInput.originalFileName) {
    throw new Error(
      'El nombre actual del cuaderno ha cambiado. Vuelve a abrir el asistente.'
    );
  }
}

function normalizeNewCourseFileName_(value) {
  const fileName = value === null || value === undefined ? '' : String(value);
  if (!fileName.trim()) {
    throw new Error('No se ha podido determinar el nombre original del cuaderno.');
  }
  return fileName;
}

function buildNotebookNameFromAcademicYear_(academicYear) {
  const academicYears = parseAcademicYear_(academicYear);
  const suffix = [academicYears.startYear, academicYears.endYear].map(function(year) {
    return String(year % 100).padStart(2, '0');
  }).join('');
  return 'CuadernoProfesor_' + suffix;
}

function getNewCourseProcessDefinition_(input) {
  const processInput = normalizeNewCourseProcessInput_(input);
  const steps = [];

  steps.push({
    label: 'Creando copia de seguridad...',
    completedMessage: 'Copia de seguridad creada.',
    run: createNewCourseBackup_,
  });

  if (processInput.moveNotebook) {
    steps.push({
      label: 'Moviendo cuaderno...',
      completedMessage: 'Cuaderno movido a la carpeta seleccionada.',
      run: moveNewCourseNotebook_,
    });
  }

  steps.push({
    label: 'Renombrando cuaderno activo...',
    completedMessage: 'Cuaderno activo renombrado.',
    run: renameNewCourseNotebook_,
  });

  steps.push(
    {
      label: 'Actualizando curso académico...',
      completedMessage: 'Curso académico actualizado.',
      run: updateNewCourseAcademicYear_,
    },
    {
      label: 'Reiniciando datos anuales...',
      completedMessage: 'Datos anuales reiniciados.',
      run: prepareNewCourseAnnualData_,
    }
  );

  return {
    id: CP.UI.NEW_COURSE_PROCESS_ID,
    title: CP.MENU.NEW_COURSE,
    successMessage: 'La copia está creada y los datos anuales se han preparado.',
    input: processInput,
    steps: steps,
  };
}

function createNewCourseBackup_(processInput) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sourceFile = DriveApp.getFileById(spreadsheet.getId());
  if (!isFileInFolder_(sourceFile, processInput.originalFolderId)) {
    throw new Error(
      'No se ha creado la copia porque el cuaderno ya no está en su carpeta original.'
    );
  }

  const backupFolder = getDriveFolderById_(processInput.destinationFolderId);
  const backupFile = sourceFile.makeCopy(processInput.originalFileName, backupFolder);
  if (!backupFile || backupFile.isTrashed() ||
      backupFile.getName() !== processInput.originalFileName ||
      !isFileInFolder_(backupFile, processInput.destinationFolderId)) {
    throw new Error('No se ha podido verificar la copia de seguridad en la carpeta elegida.');
  }
  return 'Copia de seguridad creada en ' + processInput.destinationFolderName + '.';
}

function moveNewCourseNotebook_(processInput) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const file = DriveApp.getFileById(spreadsheet.getId());
  if (!isFileInFolder_(file, processInput.originalFolderId)) {
    throw new Error('El cuaderno ya no se encuentra en su carpeta original.');
  }

  const destinationFolder = getDriveFolderById_(processInput.destinationFolderId);
  try {
    file.moveTo(destinationFolder);
    if (!isFileInFolder_(file, processInput.destinationFolderId)) {
      throw new Error('Drive no ha confirmado la nueva ubicación.');
    }
  } catch (error) {
    const restored = restoreNewCourseFileIdentity_(processInput);
    const locationMessage = restored
      ? ' El cuaderno conserva su nombre y ubicación originales.'
      : ' No se han podido restaurar completamente el nombre y la ubicación originales; revísalos manualmente.';
    throw new Error(
      'No se ha podido mover el cuaderno a la carpeta seleccionada.' +
      ' La copia de seguridad se conserva.' + locationMessage
    );
  }
}

function renameNewCourseNotebook_(processInput) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const file = DriveApp.getFileById(spreadsheet.getId());
  try {
    file.setName(processInput.newFileName);
    if (file.getName() !== processInput.newFileName) {
      throw new Error('Drive no ha confirmado el nuevo nombre.');
    }
  } catch (error) {
    const restored = restoreNewCourseFileIdentity_(processInput);
    const rollbackMessage = restored
      ? ' Se han restaurado el nombre y la ubicación originales.'
      : ' No se han podido restaurar completamente el nombre y la ubicación originales; revísalos manualmente.';
    throw new Error(
      'No se ha podido renombrar el cuaderno activo.' +
      ' La copia de seguridad se conserva.' + rollbackMessage
    );
  }
}

function updateNewCourseAcademicYear_(processInput) {
  applyNewCourseConfigKeys_(processInput, [CP.CONFIG_KEYS.ACADEMIC_YEAR]);
}

function applyNewCourseConfigKeys_(processInput, keys, options) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const values = getGeneralConfigValues_(spreadsheet);
    keys.forEach(function(key) {
      values[key] = processInput.config[key];
    });
    saveGeneralConfig_(values, Object.assign({
      updateCover: false,
      showToast: false,
    }, options || {}));
  } catch (error) {
    rollbackNewCoursePreparation_(processInput, error);
  }
}

function prepareNewCourseAnnualData_(processInput) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    initializeCalendarStructure_();
    ensureScheduleTechnicalStructure_();
    assertScheduleStructureReady_(spreadsheet);
    assertCalendarStructureReady_(spreadsheet);
    const snapshots = captureNewCourseAnnualSnapshots_(spreadsheet);

    try {
      clearStudentsForNewCourse_();
      clearWeeklyScheduleForNewCourse_();
      resetCalendarForNewCourse_(processInput.config[CP.CONFIG_KEYS.ACADEMIC_YEAR]);
      archiveTrackingAndDeleteModuleSheetsForNewCourse_(spreadsheet);
    } catch (error) {
      let annualDataRestored = true;
      try {
        restoreNewCourseAnnualSnapshots_(spreadsheet, snapshots);
      } catch (restoreError) {
        annualDataRestored = false;
      }
      const detail = error && error.message
        ? error.message
        : 'No se han podido reiniciar los datos anuales.';
      const recovery = annualDataRestored
        ? ' Se han restaurado los datos anuales anteriores en el cuaderno activo.'
        : ' No se han podido restaurar completamente los datos anuales en el cuaderno activo.';
      rollbackNewCoursePreparation_(
        processInput,
        new Error(detail + recovery),
        { rebuildDerivedViews: annualDataRestored }
      );
    }
  } catch (error) {
    if (error && error.newCourseRollbackHandled) {
      throw error;
    }
    rollbackNewCoursePreparation_(processInput, error);
  }
  return 'Datos anuales reiniciados; las vistas se aplicarán al finalizar.';
}

function captureNewCourseAnnualSnapshots_(spreadsheet) {
  const studentsSheet = spreadsheet.getSheetByName(CP.SHEETS.STUDENTS);
  const studentsRows = studentsSheet ? Math.max(1, studentsSheet.getLastRow()) : 0;
  return {
    students: {
      existed: Boolean(studentsSheet),
      values: studentsSheet
        ? studentsSheet.getRange(1, 1, studentsRows, CP_STUDENT_HEADERS.length).getValues()
        : [],
    },
    schedule: captureScheduleSnapshots_(spreadsheet),
    calendar: captureCalendarTableSnapshots_(spreadsheet),
  };
}

function restoreNewCourseAnnualSnapshots_(spreadsheet, snapshots) {
  let failed = false;
  [
    function() { restoreNewCourseStudentsSnapshot_(spreadsheet, snapshots.students); },
    function() { restoreScheduleSnapshots_(spreadsheet, snapshots.schedule); },
    function() { restoreCalendarTableSnapshots_(spreadsheet, snapshots.calendar); },
  ].forEach(function(restore) {
    try {
      restore();
    } catch (error) {
      failed = true;
    }
  });
  if (failed) {
    throw new Error('No se han podido restaurar todos los datos anuales.');
  }
}

function restoreNewCourseStudentsSnapshot_(spreadsheet, snapshot) {
  const currentSheet = spreadsheet.getSheetByName(CP.SHEETS.STUDENTS);
  if (!snapshot.existed) {
    if (currentSheet) spreadsheet.deleteSheet(currentSheet);
    return;
  }
  const sheet = currentSheet || spreadsheet.insertSheet(CP.SHEETS.STUDENTS);
  const rowCount = Math.max(1, sheet.getLastRow(), snapshot.values.length);
  ensureSheetSize_(sheet, rowCount, CP_STUDENT_HEADERS.length);
  sheet.getRange(1, 1, rowCount, CP_STUDENT_HEADERS.length).clearContent();
  sheet.getRange(1, 1, snapshot.values.length, CP_STUDENT_HEADERS.length)
    .setValues(snapshot.values);
  createOrRepairStudentsSheet_();
}

function rebuildNewCourseDerivedViews_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  createOrRepairCalendarSheet_();
  createOrRepairScheduleSheet_();
  initializeCoverStructure_();
  initializeMetaStructure_();
  hideTechnicalSheets_(spreadsheet);
  reorderManagedVisibleSheets_(spreadsheet);
  actualizarIndicePortada();
}

function rollbackNewCoursePreparation_(processInput, originalError, options) {
  const rollbackOptions = options || {};
  const outcomes = [];
  let rollbackFailed = false;

  if (processInput.previousConfig) {
    let workbookStateRestored = true;
    try {
      saveGeneralConfig_(processInput.previousConfig, {
        updateCover: false,
        showToast: false,
        includeTheme: true,
      });
    } catch (error) {
      workbookStateRestored = false;
    }

    try {
      initializeCoverStructure_();
    } catch (error) {
      workbookStateRestored = false;
    }

    try {
      initializeMetaStructure_();
    } catch (error) {
      workbookStateRestored = false;
    }

    if (workbookStateRestored) {
      outcomes.push('Se ha restaurado la configuración anterior.');
    } else {
      rollbackFailed = true;
      outcomes.push('No se ha podido restaurar completamente la configuración anterior.');
    }
  }

  if (restoreNewCourseFileIdentity_(processInput)) {
    outcomes.push('Se han restaurado el nombre y la ubicación originales.');
  } else {
    rollbackFailed = true;
    outcomes.push('No se han podido restaurar completamente el nombre y la ubicación originales.');
  }

  if (rollbackOptions.rebuildDerivedViews && !rollbackFailed) {
    try {
      rebuildNewCourseDerivedViews_();
      outcomes.push('Se han regenerado las vistas con los datos restaurados.');
    } catch (error) {
      rollbackFailed = true;
      outcomes.push('No se han podido regenerar completamente las vistas restauradas.');
    }
  }

  outcomes.push('La copia de seguridad se conserva.');

  const prefix = originalError && originalError.message
    ? originalError.message
    : 'No se ha podido completar la preparación del curso.';
  const suffix = rollbackFailed
    ? ' Revisa manualmente el cuaderno antes de continuar.'
    : '';
  const rollbackError = new Error(prefix + ' ' + outcomes.join(' ') + suffix);
  rollbackError.newCourseRollbackHandled = true;
  throw rollbackError;
}

function restoreNewCourseFileIdentity_(processInput) {
  let file;
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    file = DriveApp.getFileById(spreadsheet.getId());
  } catch (error) {
    return false;
  }
  let restored = true;

  try {
    if (file.getName() !== processInput.originalFileName) {
      file.setName(processInput.originalFileName);
    }
    restored = restored && file.getName() === processInput.originalFileName;
  } catch (error) {
    restored = false;
  }

  try {
    if (!isFileInFolder_(file, processInput.originalFolderId)) {
      file.moveTo(getDriveFolderById_(processInput.originalFolderId));
    }
    restored = restored && isFileInFolder_(file, processInput.originalFolderId);
  } catch (error) {
    restored = false;
  }

  return restored;
}
