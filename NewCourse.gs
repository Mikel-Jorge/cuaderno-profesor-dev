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

function iniciarPreparacionNuevoCurso(input) {
  const draft = getNewCourseDraft_();
  if (!draft.reviewed[0]) throw new Error('Completa el paso Seguridad antes de generar.');
  if (draft.generationPhase >= 1) return getNewCourseDraftSummary_(draft);
  draft.finalPlan = validateNewCourseDraftBeforeApply_(draft);
  saveNewCourseDraft_(draft);
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
  const draft = getNewCourseDraft_();
  const merged = Object.assign({}, draft.config, input);
  const values = normalizeGeneralConfigInput_(merged);
  validateThemeConfig_(values);
  validateAcademicYear_(values[CP.CONFIG_KEYS.ACADEMIC_YEAR]);
  assertNewCourseDraftEditable_(draft);
  if (isTutorEnabled_(draft.config[CP.CONFIG_KEYS.IS_TUTOR]) &&
      !isTutorEnabled_(values[CP.CONFIG_KEYS.IS_TUTOR]) && input.confirmedTutorRemoval !== true) {
    throw new Error('Confirma que deseas dejar de ser tutor/a en el nuevo curso.');
  }
  draft.config = values;
  reconcileNewCourseTutorDraft_(draft);
  delete draft.finalPlan;
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
  delete draft.finalPlan;
  draft.reviewed[2] = true;
  saveNewCourseDraft_(draft);
  return getNewCourseDraftSummary_(draft);
}

function guardarHorarioNuevoCurso(input, step) {
  const section = { 3: 'slots', 4: 'activities', 5: 'sessions' }[step];
  if (!section) throw new Error('El paso de horario no existe.');
  const draft = getNewCourseDraft_();
  assertNewCourseDraftEditable_(draft);
  assertNoManualTutorActivities_(input.activities, draft.managedTutorActivity);
  const inputActivities = (input.activities || []).concat(
    draft.managedTutorActivity && !(input.activities || []).some(function(activity) {
      return activity.id === draft.managedTutorActivity.id;
    }) ? [draft.managedTutorActivity] : []);
  const previousActivities = getNewCourseDraftActivities_(draft);
  const normalized = normalizeAndValidateScheduleConfig_(Object.assign({}, input,
    { activities: inputActivities }), previousActivities);
  assertManagedTutorActivity_(normalized.activities, draft.config, previousActivities);
  if (section === 'activities') {
    const activeIds = draft.calendar.types.filter(function(type) { return type.active; })
      .map(function(type) { return type.id; });
    const previous = previousActivities.reduce(function(map, activity) {
      map[activity.id] = activity.teachingTypeId;
      return map;
    }, {});
    normalized.activities.forEach(function(activity) {
      if (activity.category === 'MODULO' && activeIds.indexOf(activity.teachingTypeId) === -1 &&
          previous[activity.id] !== activity.teachingTypeId) {
        throw new Error('El tipo de enseñanza de un módulo nuevo debe estar activo.');
      }
    });
  }
  draft.schedule = normalized;
  splitManagedTutorActivityFromDraft_(draft);
  if (section === 'activities') draft.schedule.activities = addMissingBaseActivities_(draft.schedule.activities, true);
  reconcileNewCourseTutorDraft_(draft);
  delete draft.finalPlan;
  draft.reviewed[step] = true;
  saveNewCourseDraft_(draft);
  return getNewCourseDraftSummary_(draft);
}

function guardarSeguridadNuevoCurso(input) {
  const draft = getNewCourseDraft_();
  assertNewCourseDraftEditable_(draft);
  const processInput = normalizeNewCourseProcessInput_(input);
  validateNotebookOriginalLocation_(processInput);
  if (isTutorEnabled_(draft.config[CP.CONFIG_KEYS.IS_TUTOR]) &&
      !isTutorEnabled_(processInput.config[CP.CONFIG_KEYS.IS_TUTOR]) &&
      input.confirmedTutorRemoval !== true) {
    throw new Error('Confirma que deseas dejar de ser tutor/a en el nuevo curso.');
  }
  if (draft.config[CP.CONFIG_KEYS.ACADEMIC_YEAR] !==
      processInput.config[CP.CONFIG_KEYS.ACADEMIC_YEAR]) {
    draft.calendar = createDefaultNewCourseCalendarConfig_(
      SpreadsheetApp.getActiveSpreadsheet(), processInput.config[CP.CONFIG_KEYS.ACADEMIC_YEAR]);
    draft.reviewed[1] = false;
    draft.reviewed[2] = false;
  }
  const tutorActivityId = draft.config[CP.CONFIG_KEYS.TUTOR_ACTIVITY_ID];
  draft.config = processInput.config;
  draft.config[CP.CONFIG_KEYS.TUTOR_ACTIVITY_ID] = normalizeConfigValue_(tutorActivityId);
  draft.originalFileName = processInput.originalFileName;
  draft.originalFolderId = processInput.originalFolderId;
  draft.destinationFolderId = processInput.destinationFolderId;
  delete draft.finalPlan;
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
  return getNewCourseDraftSummary_(draft);
}

function assertNewCourseDraftEditable_(draft) {
  if (draft.generationPhase > 1) {
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
    const draft = JSON.parse(json);
    draft.config = normalizeGeneralConfigInput_(draft.config);
    draft.schedule.activities = addMissingBaseActivities_(draft.schedule.activities, true);
    sanitizeLegacyNewCourseTutorDraft_(draft);
    splitManagedTutorActivityFromDraft_(draft);
    reconcileNewCourseTutorDraft_(draft);
    return draft;
  }
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const config = Object.assign({}, getGeneralConfigValues_(spreadsheet));
  config[CP.CONFIG_KEYS.ACADEMIC_YEAR] = proponerCursoAcademico_(new Date(), spreadsheet.getSpreadsheetTimeZone());
  const calendar = createDefaultNewCourseCalendarConfig_(
    spreadsheet, config[CP.CONFIG_KEYS.ACADEMIC_YEAR]);
  const schedule = getScheduleConfigForUi_(spreadsheet);
  schedule.sessions = [];
  schedule.activities = addMissingBaseActivities_(schedule.activities, true);
  const draft = { config: config, calendar: calendar, schedule: schedule,
    visited: [true, false, false, false, false, false, false],
    reviewed: [false, false, false, false, false, false, false] };
  splitManagedTutorActivityFromDraft_(draft);
  reconcileNewCourseTutorDraft_(draft);
  return draft;
}

function sanitizeLegacyNewCourseTutorDraft_(draft) {
  const enabled = isTutorEnabled_(draft.config[CP.CONFIG_KEYS.IS_TUTOR]);
  const group = normalizeConfigValue_(draft.config[CP.CONFIG_KEYS.TUTOR_GROUP]);
  const configuredId = normalizeConfigValue_(draft.config[CP.CONFIG_KEYS.TUTOR_ACTIVITY_ID]);
  const manualTutors = draft.schedule.activities.filter(function(activity) {
    return activity.category === 'TUTORIA';
  });
  let managed = draft.managedTutorActivity || null;
  if (!managed && configuredId) {
    managed = manualTutors.find(function(activity) { return activity.id === configuredId; }) || null;
  }
  if (managed && (managed.category !== 'TUTORIA' || managed.name !== 'Tutoría' ||
      managed.acronym !== 'T' || managed.teachingTypeId ||
      (configuredId && managed.id !== configuredId))) {
    throw new Error('El borrador anterior contiene una Tutoría ambigua. Reinicia el borrador del nuevo curso.');
  }
  const canonicalCandidates = manualTutors.filter(function(activity) {
    return activity.name === 'Tutoría' && activity.acronym === 'T' && activity.group === group &&
      !activity.teachingTypeId;
  });
  if (!managed && enabled && canonicalCandidates.length === 1 && manualTutors.length === 1) {
    managed = canonicalCandidates[0];
  }
  if (managed) {
    const duplicates = manualTutors.filter(function(activity) { return activity.id !== managed.id; });
    const safeDuplicates = duplicates.filter(function(activity) {
      return activity.name === 'Tutoría' && activity.acronym === 'T' && activity.group === group &&
        !activity.teachingTypeId;
    });
    if (duplicates.length !== safeDuplicates.length || safeDuplicates.length > 1) {
      throw new Error('El borrador anterior contiene varias Tutorías ambiguas. Reinicia el borrador del nuevo curso.');
    }
    draft.managedTutorActivity = managed;
    draft.schedule.activities = draft.schedule.activities.filter(function(activity) {
      return activity.id !== managed.id && !safeDuplicates.some(function(item) { return item.id === activity.id; });
    });
  } else if (manualTutors.length) {
    throw new Error('El borrador anterior contiene una Tutoría manual ambigua. Reinicia el borrador del nuevo curso.');
  }
}

function reconcileNewCourseTutorDraft_(draft) {
  const next = reconcileTutorActivityInModel_(getNewCourseDraftActivities_(draft),
    draft.schedule.sessions, draft.config);
  draft.managedTutorActivity = next.id ? next.activities.find(function(activity) {
    return activity.id === next.id;
  }) || null : null;
  draft.schedule.activities = next.activities.filter(function(activity) {
    return activity.id !== next.id;
  });
  draft.schedule.sessions = next.sessions;
  draft.config[CP.CONFIG_KEYS.TUTOR_ACTIVITY_ID] = next.id;
  draft.schedule.managedTutorActivityId = next.id;
}

function splitManagedTutorActivityFromDraft_(draft) {
  const configuredId = normalizeConfigValue_(draft.config[CP.CONFIG_KEYS.TUTOR_ACTIVITY_ID]);
  const managed = draft.managedTutorActivity || draft.schedule.activities.find(function(activity) {
    return configuredId && activity.id === configuredId && activity.category === 'TUTORIA';
  }) || null;
  draft.managedTutorActivity = managed;
  draft.schedule.activities = draft.schedule.activities.filter(function(activity) {
    return !managed || activity.id !== managed.id;
  });
}

function getNewCourseDraftActivities_(draft) {
  return draft.schedule.activities.concat(draft.managedTutorActivity ? [draft.managedTutorActivity] : []);
}

function assertNoManualTutorActivities_(activities, managedTutorActivity) {
  const managedId = managedTutorActivity && managedTutorActivity.id;
  if ((activities || []).some(function(activity) {
    return activity.category === 'TUTORIA' && activity.id !== managedId;
  })) {
    throw new Error('La actividad Tutoría se gestiona desde Datos del docente y centro.');
  }
}

function validateNewCourseDraftBeforeApply_(draft) {
  const plan = buildFinalNewCoursePlan_(draft);
  if (!plan.calendar || !Array.isArray(plan.calendar.types) || !Array.isArray(plan.calendar.events)) {
    throw new Error('Revisa los datos del calendario.');
  }
  return plan;
}

function buildFinalNewCoursePlan_(draft) {
  const config = normalizeGeneralConfigInput_(draft.config);
  validateAcademicYear_(config[CP.CONFIG_KEYS.ACADEMIC_YEAR]);
  validateThemeConfig_(config);
  assertNoManualTutorActivities_(draft.schedule.activities, draft.managedTutorActivity);
  const reconciled = reconcileTutorActivityInModel_(getNewCourseDraftActivities_(draft),
    draft.schedule.sessions, config);
  config[CP.CONFIG_KEYS.TUTOR_ACTIVITY_ID] = reconciled.id;
  const schedule = normalizeAndValidateScheduleConfig_({ slots: draft.schedule.slots,
    activities: reconciled.activities, sessions: reconciled.sessions }, reconciled.activities);
  assertManagedTutorActivityForNewCourse_(schedule.activities, config, []);
  return { config: config, calendar: JSON.parse(JSON.stringify(draft.calendar)), schedule: schedule };
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
    type.evaluations = [];
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
  const general = getGeneralConfigCompletion_(draft.config);
  const types = draft.calendar.types.filter(function(type) { return type.active; });
  const calendarReady = types.length > 0 && types.every(function(type) { return type.startDate && type.endDate; });
  const slots = draft.schedule.slots.length;
  const activities = getNewCourseDraftActivities_(draft).length;
  const sessions = draft.schedule.sessions.length;
  const reasons = {
    general: general.reason,
    calendar: !types.length ? 'No hay ningún tipo de enseñanza activo.' :
      calendarReady ? '' : 'Faltan fechas en los tipos de enseñanza activos.',
    slots: slots ? '' : 'No hay tramos horarios.',
    activities: activities ? '' : 'No hay actividades.',
    sessions: sessions ? '' : 'No hay sesiones asignadas.',
  };
  const complete = [Boolean(draft.reviewed[0] && draft.destinationFolderId),
    general.complete, calendarReady, slots > 0, activities > 0, sessions > 0, false];
  const keys = ['', 'general', 'calendar', 'slots', 'activities', 'sessions', ''];
  const steps = complete.map(function(value, index) {
    const reviewed = Boolean(draft.reviewed[index]);
    return { visited: Boolean(draft.visited[index]), reviewed: reviewed,
      complete: reviewed && value,
      reason: reviewed && !value ? reasons[keys[index]] || '' : '' };
  });
  return { academicYear: draft.config[CP.CONFIG_KEYS.ACADEMIC_YEAR],
    tutorGroup: isTutorEnabled_(draft.config[CP.CONFIG_KEYS.IS_TUTOR])
      ? draft.config[CP.CONFIG_KEYS.TUTOR_GROUP] : '', calendar: calendarReady,
    slots: slots, activities: activities, sessions: sessions,
    steps: steps, reasons: reasons };
}

function aplicarBorradorNuevoCurso() {
  const draft = getNewCourseDraft_();
  if (!draft.reviewed[0]) throw new Error('Completa el paso Seguridad antes de generar.');
  if (draft.generationPhase >= 2) return 'Datos del borrador aplicados.';
  if (draft.generationPhase !== 1) throw new Error('Primero debe crearse la copia de seguridad.');
  const plan = draft.finalPlan || validateNewCourseDraftBeforeApply_(draft);
  draft.finalPlan = plan;
  saveNewCourseDraft_(draft);
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const snapshots = { config: getGeneralConfigValues_(spreadsheet),
    calendar: captureCalendarTableSnapshots_(spreadsheet),
    schedule: captureScheduleSnapshots_(spreadsheet) };
  let stage = 'CONFIG';
  try {
    saveGeneralConfig_(plan.config, { updateCover: false, showToast: false,
      includeTheme: true, confirmedTutorRemoval: true, updateScheduleView: false,
      deactivateRoster: false, refreshMenu: false,
      newCourseManagedTutorId: plan.config[CP.CONFIG_KEYS.TUTOR_ACTIVITY_ID] });
    stage = 'CALENDAR';
    guardarConfiguracionCalendario_(plan.calendar, { renderViews: false, showToast: false });
    stage = 'SCHEDULE';
    guardarConfiguracionHorarioNuevoCurso_(plan.schedule, plan.config);
    stage = 'POSTCONDITIONS';
    assertNewCourseApplyPostconditions_(spreadsheet, plan, snapshots.config);
  } catch (error) {
    console.warn('NEW_COURSE_APPLY_STAGE=' + stage);
    let restored = true;
    try {
      saveGeneralConfig_(snapshots.config, { updateCover: false, showToast: false,
        includeTheme: true, confirmedTutorRemoval: true, updateScheduleView: false,
        deactivateRoster: false, refreshMenu: false,
        newCourseManagedTutorId: snapshots.config[CP.CONFIG_KEYS.TUTOR_ACTIVITY_ID] });
      restoreCalendarTableSnapshots_(spreadsheet, snapshots.calendar);
      restoreScheduleSnapshots_(spreadsheet, snapshots.schedule);
      assertNewCourseRollbackRestored_(spreadsheet, snapshots);
    } catch (restoreError) {
      restored = false;
      console.warn('NEW_COURSE_APPLY_ROLLBACK=FAILED');
    }
    const message = error && error.message
      ? error.message : 'No se ha podido preparar el nuevo curso. Revisa los datos e inténtalo de nuevo.';
    throw new Error(message + (restored
      ? ' No se han aplicado cambios parciales; puedes revisar el borrador y volver a intentarlo.'
      : ' No se han podido restaurar completamente los datos; revisa el cuaderno antes de continuar.'));
  }
  draft.generationPhase = 2;
  saveNewCourseDraft_(draft);
  return 'Datos del borrador aplicados.';
}

function assertNewCourseApplyPostconditions_(spreadsheet, plan, previousConfig) {
  const storedConfig = getGeneralConfigValues_(spreadsheet);
  const activities = getScheduleActivities_(spreadsheet);
  const sessions = getWeeklySchedule_(spreadsheet);
  const activityIds = activities.reduce(function(map, activity) { map[activity.id] = true; return map; }, {});
  if (sessions.some(function(session) { return !activityIds[session.activityId]; })) {
    throw new Error('El Horario semanal conserva referencias a actividades inexistentes.');
  }
  [CP.CONFIG_KEYS.IS_TUTOR, CP.CONFIG_KEYS.TUTOR_GROUP, CP.CONFIG_KEYS.TUTOR_ACTIVITY_ID]
    .forEach(function(key) {
      if (normalizeConfigValue_(storedConfig[key]) !== normalizeConfigValue_(plan.config[key])) {
        throw new Error('La configuración de Tutoría no coincide con el plan final del nuevo curso.');
      }
    });
  assertManagedTutorActivityForNewCourse_(activities, storedConfig, activities);
  if (isTutorEnabled_(plan.config[CP.CONFIG_KEYS.IS_TUTOR])) {
    const id = plan.config[CP.CONFIG_KEYS.TUTOR_ACTIVITY_ID];
    if (storedConfig[CP.CONFIG_KEYS.TUTOR_ACTIVITY_ID] !== id ||
        sessions.some(function(session) {
          return session.activityId === id && !activities.some(function(activity) { return activity.id === id; });
        })) {
      throw new Error('La identidad de Tutoría no ha quedado sincronizada tras aplicar el nuevo curso.');
    }
  } else {
    const previousId = normalizeConfigValue_(previousConfig[CP.CONFIG_KEYS.TUTOR_ACTIVITY_ID]);
    if (storedConfig[CP.CONFIG_KEYS.TUTOR_ACTIVITY_ID] ||
        activities.some(function(activity) { return activity.category === 'TUTORIA'; }) ||
        (previousId && sessions.some(function(session) { return session.activityId === previousId; }))) {
      throw new Error('La Tutoría desactivada conserva referencias tras aplicar el nuevo curso.');
    }
  }
}

function assertNewCourseRollbackRestored_(spreadsheet, snapshots) {
  const restoredConfig = getGeneralConfigValues_(spreadsheet);
  Object.keys(snapshots.config).forEach(function(key) {
    if (normalizeConfigValue_(restoredConfig[key]) !== normalizeConfigValue_(snapshots.config[key])) {
      throw new Error('La configuración no se ha restaurado completamente.');
    }
  });
  const currentSchedule = captureScheduleSnapshots_(spreadsheet);
  if (JSON.stringify(currentSchedule) !== JSON.stringify(snapshots.schedule)) {
    throw new Error('Las tablas de Horario no se han restaurado completamente.');
  }
  const currentCalendar = captureCalendarTableSnapshots_(spreadsheet);
  if (JSON.stringify(currentCalendar) !== JSON.stringify(snapshots.calendar)) {
    throw new Error('Las tablas de Calendario no se han restaurado completamente.');
  }
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
  syncStudentGroupValidation_(spreadsheet);
  clearNewCourseDraft_();
  spreadsheet.toast('Nuevo curso preparado.', CP.PROJECT_NAME, 5);
  onOpen();
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
    template.scheduleConfig = Object.assign({}, getScheduleConfigForUi_(spreadsheet), draft.schedule,
      { activities: getNewCourseDraftActivities_(draft) });
    template.scheduleConfig.managedTutorActivityId = draft.config[CP.CONFIG_KEYS.TUTOR_ACTIVITY_ID];
    template.scheduleConfig.teachingTypes = draft.calendar.types.map(function(type) {
      return { id: type.id, label: type.name, active: type.active };
    });
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

  const backupFolder = getDriveFolderById_(processInput.originalFolderId);
  const backupFile = sourceFile.makeCopy(processInput.originalFileName, backupFolder);
  if (!backupFile || backupFile.isTrashed() ||
      backupFile.getName() !== processInput.originalFileName ||
      !isFileInFolder_(backupFile, processInput.originalFolderId)) {
    throw new Error('No se ha podido verificar la copia histórica en la carpeta original.');
  }
  const backupBook = SpreadsheetApp.openById(backupFile.getId());
  const backupCover = backupBook.getSheetByName(CP.SHEETS.COVER);
  if (backupCover) {
    const firstRow = 7;
    const count = Math.max(0, backupCover.getLastRow() - firstRow + 1);
    const labels = count ? backupCover.getRange(firstRow, 7, count, 1).getDisplayValues() : [];
    try {
      renderCoverIndex_(backupCover);
    } catch (error) {
      if (count) {
        const index = backupCover.getRange(firstRow, 7, count, 1);
        index.setRichTextValues(labels.map(function(row) {
          return [SpreadsheetApp.newRichTextValue().setText(row[0]).build()];
        }));
      }
    }
  }
  return 'Copia histórica creada en ' + processInput.originalFolderName + '.';
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
      deactivateRoster: false,
      refreshMenu: false,
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
      clearEnrollmentsForNewCourse_();
      clearTutorRosterForNewCourse_();
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
    enrollments: captureNewCourseEnrollmentSnapshots_(spreadsheet),
    tutorRoster: captureTutorRosterSnapshot_(spreadsheet),
    calendar: captureCalendarTableSnapshots_(spreadsheet),
  };
}

function restoreNewCourseAnnualSnapshots_(spreadsheet, snapshots) {
  let failed = false;
  [
    function() { restoreNewCourseStudentsSnapshot_(spreadsheet, snapshots.students); },
    function() { restoreScheduleSnapshots_(spreadsheet, snapshots.schedule); },
    function() { restoreNewCourseEnrollmentSnapshots_(spreadsheet, snapshots.enrollments); },
    function() { restoreTutorRosterSnapshot_(spreadsheet, snapshots.tutorRoster); },
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
