function abrirDialogoInicializacion() {
  showConfirmationDialog_(CP.UI.INIT_CONFIRMATION_ID);
}

function abrirPrepararNuevoCurso() {
  showConfirmationDialog_(CP.UI.NEW_COURSE_CONFIRMATION_ID);
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
    showProgressDialog_(CP.UI.INIT_PROCESS_ID);
    return;
  }

  if (actionId === CP.UI.NEW_COURSE_ACTION_ID) {
    abrirAsistenteNuevoCurso();
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

  if (confirmationId === CP.UI.NEW_COURSE_CONFIRMATION_ID) {
    return validateUiConfirmation_({
      id: CP.UI.NEW_COURSE_CONFIRMATION_ID,
      title: CP.MENU.NEW_COURSE,
      message: 'Esta operaci\u00f3n prepara el cuaderno para un nuevo curso acad\u00e9mico.',
      helperText: 'Puede sustituir informaci\u00f3n del curso actual cuando existan datos espec\u00edficos del curso.',
      confirmText: 'Preparar nuevo curso',
      variant: CP.UI.CONFIRMATION_VARIANTS.DANGER,
      actionId: CP.UI.NEW_COURSE_ACTION_ID,
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
  const resultMessage = step.run(process.input);

  return {
    completedStep: stepIndex + 1,
    totalSteps: process.steps.length,
    message: resultMessage || step.completedMessage,
  };
}

function getUiProcessDefinition_(processId, processInput) {
  if (processId === CP.UI.NEW_COURSE_PROCESS_ID) {
    return getNewCourseProcessDefinition_(processInput);
  }

  if (processId === CP.UI.INIT_PROCESS_ID) {
    return {
      id: CP.UI.INIT_PROCESS_ID,
      title: CP.MENU.INIT,
      successMessage: 'La estructura del cuaderno esta lista.',
      input: {},
      steps: [
        {
          label: 'Preparando la portada...',
          completedMessage: 'Portada creada o reparada.',
          run: initializeCoverStructure_,
        },
        {
          label: 'Preparando la configuracion...',
          completedMessage: 'Configuracion comprobada.',
          run: initializeConfigStructure_,
        },
        {
          label: 'Preparando el calendario...',
          completedMessage: 'Estructura tecnica del calendario comprobada.',
          run: initializeCalendarStructure_,
        },
        {
          label: 'Actualizando metadatos...',
          completedMessage: 'Metadatos actualizados.',
          run: initializeMetaStructure_,
        },
        {
          label: 'Finalizando la estructura...',
          completedMessage: 'Hojas tecnicas ocultas y portada situada en primer lugar.',
          run: finishStructureInitialization_,
        },
      ],
    };
  }

  throw new Error('El proceso solicitado no existe.');
}

function includeUiFile_(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}
