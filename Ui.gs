function abrirDialogoInicializacion() {
  showConfirmationDialog_(CP.UI.INIT_CONFIRMATION_ID);
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
  if (actionId !== CP.UI.INIT_ACTION_ID) {
    throw new Error('La acci\u00f3n confirmada no existe.');
  }

  showProgressDialog_(CP.UI.INIT_PROCESS_ID);
}

function showProgressDialog_(processId) {
  const process = getUiProcessDefinition_(processId);
  const template = HtmlService.createTemplateFromFile('UiDialogProgress');
  template.uiProcess = {
    id: process.id,
    title: process.title,
    successMessage: process.successMessage,
    steps: process.steps.map(function(step) {
      return { label: step.label };
    }),
  };
  setCommonUiTemplateData_(template);

  const output = template.evaluate()
    .setWidth(CP.UI.PROGRESS_DIALOG_WIDTH)
    .setHeight(CP.UI.PROGRESS_DIALOG_HEIGHT);

  // Apps Script controls the native dialog frame. Its X cannot be hidden or disabled.
  SpreadsheetApp.getUi().showModalDialog(output, process.title);
}

function getUiConfirmationDefinition_(confirmationId) {
  if (confirmationId !== CP.UI.INIT_CONFIRMATION_ID) {
    throw new Error('La confirmacion solicitada no existe.');
  }

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

function ejecutarPasoProcesoUi(processId, stepIndex) {
  const process = getUiProcessDefinition_(processId);
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= process.steps.length) {
    throw new Error('El paso solicitado no es valido.');
  }

  const step = process.steps[stepIndex];
  step.run();

  return {
    completedStep: stepIndex + 1,
    totalSteps: process.steps.length,
    message: step.completedMessage,
  };
}

function getUiProcessDefinition_(processId) {
  if (processId !== CP.UI.INIT_PROCESS_ID) {
    throw new Error('El proceso solicitado no existe.');
  }

  return {
    id: CP.UI.INIT_PROCESS_ID,
    title: CP.MENU.INIT,
    successMessage: 'La estructura del cuaderno esta lista.',
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

function includeUiFile_(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}
