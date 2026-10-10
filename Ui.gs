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
  if (processId === CP.UI.INIT_PROCESS_ID) {
    CP_REPAIR_SKIP_COVER = stepIndex < process.steps.length - 1;
  }
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
    ].forEach(function(item) {
      if (selection[item[0]]) steps.push({
        label: item[1], completedMessage: item[2], run: item[3],
      });
    });
    if (selection.tracking || selection.evaluation) {
      const consumerLabel = selection.tracking && selection.evaluation
        ? 'Reparando Seguimiento y Evaluación...'
        : selection.tracking ? 'Reparando Seguimiento...' : 'Reparando Evaluación...';
      steps.push({
        label: consumerLabel,
        completedMessage: 'Reparación de Seguimiento y Evaluación finalizada.',
        run: function() {
          return formatRepairConsumerResult_(
            repairManagedModuleConsumerSheets_({
              tracking: selection.tracking,
              evaluation: selection.evaluation,
            }), selection);
        },
      });
    }
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

function formatRepairConsumerResult_(result, selection) {
  const parts = [];
  if (selection.tracking && result.trackingRepaired) {
    parts.push(result.trackingRepaired + ' ' +
      (result.trackingRepaired === 1 ? 'Seguimiento reparado' : 'Seguimientos reparados'));
  }
  if (selection.evaluation && result.evaluationsRepaired) {
    parts.push(result.evaluationsRepaired + ' ' +
      (result.evaluationsRepaired === 1 ? 'Evaluación reparada' : 'Evaluaciones reparadas'));
  }
  if (selection.evaluation && result.evaluationsRecreated) {
    parts.push(result.evaluationsRecreated + ' ' +
      (result.evaluationsRecreated === 1 ? 'Evaluación recreada' : 'Evaluaciones recreadas'));
  }
  if (parts.length) return parts.join('; ') + '.';
  if (selection.tracking && selection.evaluation) {
    return 'No hay Seguimientos ni Evaluaciones que reparar.';
  }
  return selection.tracking
    ? 'No hay Seguimientos que reparar.' : 'No hay Evaluaciones que reparar.';
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
