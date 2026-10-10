function abrirDialogoInicializacion() {
  const template = HtmlService.createTemplateFromFile('UiDialogRepair');
  setCommonUiTemplateData_(template);
  const output = template.evaluate()
    .setWidth(CP.UI.REPAIR_DIALOG_WIDTH).setHeight(CP.UI.REPAIR_DIALOG_HEIGHT);
  SpreadsheetApp.getUi().showModalDialog(output, CP.MENU.INIT);
}

function iniciarReparacionSeleccionada(selection) {
  showProgressDialog_(CP.UI.INIT_PROCESS_ID, normalizeRepairSelection_(selection));
}

function abrirPrepararNuevoCurso() {
  abrirAsistenteNuevoCurso();
}

function getCourseWizardSummary_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const config = getGeneralConfigValues_(spreadsheet);
  const activeTypes = getCalendarTeachingTypes_().filter(function(type) { return type.active; });
  const calendarReady = activeTypes.length > 0 && activeTypes.every(function(type) {
    return type.startDate instanceof Date && type.endDate instanceof Date;
  });
  const slots = getScheduleTimeSlots_().length;
  const activities = getScheduleActivities_().length;
  const sessions = getWeeklySchedule_().length;
  return {
    academicYear: config[CP.CONFIG_KEYS.ACADEMIC_YEAR] || 'Pendiente',
    calendar: calendarReady,
    slots: slots,
    activities: activities,
    sessions: sessions,
    reasons: {
      calendar: !activeTypes.length ? 'No hay ningún tipo de enseñanza activo.'
        : !calendarReady ? 'Faltan fechas en los tipos de enseñanza activos.' : '',
      slots: slots ? '' : 'No hay tramos horarios.',
      activities: activities ? '' : 'No hay actividades.',
      sessions: sessions ? '' : 'No hay sesiones asignadas.',
    },
  };
}

function showConfirmationDialog_(confirmationId) {
  const confirmation = getUiConfirmationDefinition_(confirmationId);
  const template = HtmlService.createTemplateFromFile('UiDialogConfirmation');
  template.confirmation = confirmation;
  setCommonUiTemplateData_(template);

  const output = template.evaluate()
    .setWidth(CP.UI.CONFIRMATION_DIALOG_WIDTH)
    .setHeight(CP.UI.CONFIRMATION_DIALOG_HEIGHT);

  SpreadsheetApp.getUi().showModalDialog(output, confirmation.title);
}

function ejecutarAccionConfirmadaUi(actionId) {
  if (actionId === CP.UI.INIT_ACTION_ID) {
    abrirDialogoInicializacion();
    return;
  }

  throw new Error('La acci\u00f3n confirmada no existe.');
}

function showProgressDialog_(processId, processInput) {
  const process = getUiProcessDefinition_(processId, processInput);
  const template = HtmlService.createTemplateFromFile('UiDialogProgress');
  template.uiProcess = {
    id: process.id,
    title: process.title,
    successMessage: process.successMessage,
    afterSuccessAction: '',
    steps: process.steps.map(function(step) {
      return { label: step.label };
    }),
  };
  template.processInput = process.input || {};
  setCommonUiTemplateData_(template);

  const output = template.evaluate()
    .setWidth(CP.UI.PROGRESS_DIALOG_WIDTH)
    .setHeight(CP.UI.PROGRESS_DIALOG_HEIGHT);

  // Apps Script controls the native dialog frame. Its X cannot be hidden or disabled.
  SpreadsheetApp.getUi().showModalDialog(output, process.title);
}

function getUiConfirmationDefinition_(confirmationId) {
  if (confirmationId === CP.UI.INIT_CONFIRMATION_ID) {
    return validateUiConfirmation_({
      id: CP.UI.INIT_CONFIRMATION_ID,
      title: CP.MENU.INIT,
      message: 'Se comprobar\u00e1 y reparar\u00e1 la estructura base del cuaderno.',
      helperText: 'Los datos existentes no se eliminar\u00e1n.',
      confirmText: 'Continuar',
      variant: CP.UI.CONFIRMATION_VARIANTS.NORMAL,
      actionId: CP.UI.INIT_ACTION_ID,
    });
  }

  throw new Error('La confirmacion solicitada no existe.');
}

function validateUiConfirmation_(confirmation) {
  const variants = CP.UI.CONFIRMATION_VARIANTS;
  const allowedVariants = [variants.NORMAL, variants.WARNING, variants.DANGER];
  if (allowedVariants.indexOf(confirmation.variant) === -1) {
    throw new Error('La variante de confirmaci\u00f3n no es v\u00e1lida.');
  }
  if (!confirmation.title || !confirmation.message || !confirmation.confirmText || !confirmation.actionId) {
    throw new Error('La configuraci\u00f3n de confirmaci\u00f3n est\u00e1 incompleta.');
  }
  return confirmation;
}

function setCommonUiTemplateData_(template) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const theme = getActiveTheme_(spreadsheet);
  template.branding = getUiBranding_();
  template.uiThemeCss = createUiThemeCss_(theme);
  template.uiConfig = {
    projectName: CP.PROJECT_NAME,
    versionLabel: 'v' + CP.NOTEBOOK_VERSION,
    author: CP.UI.AUTHOR,
    authorEmail: CP.UI.AUTHOR_EMAIL,
  };
}

function ejecutarPasoProcesoUi(processId, stepIndex, processInput) {
  const process = getUiProcessDefinition_(processId, processInput);
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= process.steps.length) {
    throw new Error('El paso solicitado no es valido.');
  }

  const step = process.steps[stepIndex];
  const previousSkip = CP_REPAIR_SKIP_COVER;
  if (processId === CP.UI.INIT_PROCESS_ID) CP_REPAIR_SKIP_COVER = !process.input.cover;
  let resultMessage;
  try {
    resultMessage = step.run(process.input);
  } finally {
    CP_REPAIR_SKIP_COVER = previousSkip;
  }

  return buildUiStepResponse_(
    stepIndex,
    process.steps.length,
    resultMessage,
    step.completedMessage
  );
}

function buildUiStepResponse_(stepIndex, totalSteps, resultMessage, completedMessage) {
  const message = typeof resultMessage === 'string' && resultMessage.trim()
    ? resultMessage
    : completedMessage;

  return {
    completedStep: stepIndex + 1,
    totalSteps: totalSteps,
    message: String(message || ''),
  };
}

function getUiProcessDefinition_(processId, processInput) {
  if (processId === CP.UI.NEW_COURSE_PROCESS_ID) {
    return getNewCourseProcessDefinition_(processInput);
  }

  if (processId === CP.UI.INIT_PROCESS_ID) {
    const selection = normalizeRepairSelection_(processInput);
    const steps = [
      { label: 'Comprobando estructura técnica...', completedMessage: 'Estructura técnica comprobada.', run: function() {
        initializeConfigStructure_();
        initializeCalendarStructure_();
        ensureScheduleTechnicalStructure_();
        ensureModuleConfigTechnicalStructure_();
        cleanupOrphanModuleConfigsWithLock_();
      } },
    ];
    [
      ['cover', 'Reparando Portada...', 'Portada reparada.', initializeCoverStructure_],
      ['calendar', 'Reparando Calendario...', 'Calendario reparado.', createOrRepairCalendarSheet_],
      ['schedule', 'Reparando Horario...', 'Horario reparado.', createOrRepairScheduleSheet_],
      ['students', 'Reparando Alumnado...', 'Alumnado reparado.', createOrRepairStudentsSheet_],
      ['config', 'Reparando hojas 4 Config...', 'Hojas de Configuración reparadas.', repairExistingModuleConfigSheets_],
      ['tracking', 'Reparando hojas 5 Seg...', 'Hojas de Seguimiento reparadas.', repairTrackingSheets_],
      ['evaluation', 'Reparando hojas 6 Eval...', 'Hojas de Evaluación reparadas.', repairEvaluationSheets_],
    ].forEach(function(item) {
      if (selection[item[0]]) steps.push({
        label: item[1], completedMessage: item[2], run: item[3],
      });
    });
    steps.push({
      label: 'Actualizando metadatos...', completedMessage: 'Metadatos actualizados.',
      run: initializeMetaStructure_,
    });
    steps.push({
      label: 'Finalizando mantenimiento...', completedMessage: 'Mantenimiento finalizado.',
      run: finishSelectiveRepair_,
    });
    return {
      id: CP.UI.INIT_PROCESS_ID,
      title: CP.MENU.INIT,
      successMessage: 'La reparación ha finalizado.',
      input: selection,
      steps: steps,
    };
  }

  throw new Error('El proceso solicitado no existe.');
}

function normalizeRepairSelection_(input) {
  const keys = ['cover', 'calendar', 'schedule', 'students', 'config', 'tracking', 'evaluation'];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Selecciona los bloques que deseas reparar.');
  }
  return keys.reduce(function(selection, key) {
    if (typeof input[key] !== 'boolean') throw new Error('Selección de reparación no válida.');
    selection[key] = input[key];
    return selection;
  }, {});
}

function includeUiFile_(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}
