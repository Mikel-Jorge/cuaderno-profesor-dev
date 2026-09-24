function abrirDialogoInicializacion() {
  showProgressDialog_(CP.UI.INIT_PROCESS_ID);
}

function showProgressDialog_(processId) {
  const process = getUiProcessDefinition_(processId);
  const template = HtmlService.createTemplateFromFile('UiDialogProgress');
  template.uiProcess = {
    id: process.id,
    title: process.title,
    initialStatus: process.initialStatus,
    successMessage: process.successMessage,
    steps: process.steps.map(function(step) {
      return { label: step.label };
    }),
  };
  template.branding = getUiBranding_();
  template.uiConfig = {
    projectName: CP.PROJECT_NAME,
    environment: CP.ENVIRONMENT,
    author: CP.UI.AUTHOR,
    authorEmail: CP.UI.AUTHOR_EMAIL,
  };

  const output = template.evaluate()
    .setWidth(CP.UI.PROGRESS_DIALOG_WIDTH)
    .setHeight(CP.UI.PROGRESS_DIALOG_HEIGHT);

  // Apps Script controls the native dialog frame. Its X cannot be hidden or disabled.
  SpreadsheetApp.getUi().showModalDialog(output, process.title);
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
    title: 'Inicializar cuaderno',
    initialStatus: 'Preparando la estructura base...',
    successMessage: 'La estructura del cuaderno esta lista.',
    steps: [
      {
        label: 'Preparando la portada',
        completedMessage: 'Portada creada o reparada.',
        run: initializeCoverStructure_,
      },
      {
        label: 'Preparando la configuracion',
        completedMessage: 'Configuracion comprobada.',
        run: initializeConfigStructure_,
      },
      {
        label: 'Actualizando metadatos',
        completedMessage: 'Metadatos actualizados.',
        run: initializeMetaStructure_,
      },
      {
        label: 'Finalizando la estructura',
        completedMessage: 'Hojas tecnicas ocultas y portada situada en primer lugar.',
        run: finishStructureInitialization_,
      },
    ],
  };
}

function includeUiFile_(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}
