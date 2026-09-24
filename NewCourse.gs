function abrirAsistenteNuevoCurso() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const currentConfig = getGeneralConfigValues_(spreadsheet);
  const proposedAcademicYear = proponerCursoAcademico_(
    new Date(),
    spreadsheet.getSpreadsheetTimeZone()
  );
  const wizardConfig = Object.assign({}, currentConfig);
  wizardConfig[CP.CONFIG_KEYS.ACADEMIC_YEAR] = proposedAcademicYear;

  const template = HtmlService.createTemplateFromFile('UiDialogNewCourse');
  template.currentAcademicYear = currentConfig[CP.CONFIG_KEYS.ACADEMIC_YEAR] || '';
  template.wizardConfig = wizardConfig;
  template.themeConfig = getThemeConfigForUi_(spreadsheet, currentConfig);
  setCommonUiTemplateData_(template);

  const output = template.evaluate()
    .setWidth(CP.UI.NEW_COURSE_DIALOG_WIDTH)
    .setHeight(CP.UI.NEW_COURSE_DIALOG_HEIGHT);

  SpreadsheetApp.getUi().showModalDialog(output, CP.MENU.NEW_COURSE);
}

function validarPreparacionNuevoCurso(input) {
  return normalizeNewCourseProcessInput_(input);
}

function iniciarPreparacionNuevoCurso(input) {
  const processInput = normalizeNewCourseProcessInput_(input);
  showProgressDialog_(CP.UI.NEW_COURSE_PROCESS_ID, processInput);
}

function normalizeNewCourseProcessInput_(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('No se han recibido los datos del nuevo curso.');
  }

  const config = normalizeGeneralConfigInput_(input.config);
  validateAcademicYear_(config[CP.CONFIG_KEYS.ACADEMIC_YEAR]);
  validateThemeConfig_(config);

  return {
    config: config,
    createBackup: input.createBackup === true,
  };
}

function getNewCourseProcessDefinition_(input) {
  const processInput = normalizeNewCourseProcessInput_(input);
  const steps = [];

  if (processInput.createBackup) {
    steps.push({
      label: 'Creando copia de seguridad...',
      completedMessage: 'Copia de seguridad creada.',
      run: createNewCourseBackup_,
    });
  }

  steps.push(
    {
      label: 'Actualizando los datos del curso...',
      completedMessage: 'Curso, profesor, centro y apariencia actualizados.',
      run: saveNewCourseConfig_,
    },
    {
      label: 'Actualizando la portada...',
      completedMessage: 'Portada e índice actualizados.',
      run: updateNewCourseCover_,
    },
    {
      label: 'Sincronizando metadatos...',
      completedMessage: 'Metadatos sincronizados.',
      run: updateNewCourseMetadata_,
    },
    {
      label: 'Finalizando...',
      completedMessage: 'Nuevo curso preparado con la funcionalidad disponible actualmente.',
      run: finishNewCoursePreparation_,
    }
  );

  return {
    id: CP.UI.NEW_COURSE_PROCESS_ID,
    title: CP.MENU.NEW_COURSE,
    successMessage: 'El curso se ha preparado y la portada está actualizada.',
    input: processInput,
    steps: steps,
  };
}

function createNewCourseBackup_(processInput) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sourceFile = DriveApp.getFileById(spreadsheet.getId());
  const parents = sourceFile.getParents();
  if (!parents.hasNext()) {
    throw new Error('No se ha podido determinar la carpeta del archivo para crear la copia de seguridad.');
  }

  const academicYear = processInput.config[CP.CONFIG_KEYS.ACADEMIC_YEAR];
  const timestamp = Utilities.formatDate(
    new Date(),
    spreadsheet.getSpreadsheetTimeZone(),
    'yyyy-MM-dd HH-mm'
  );
  const backupName = spreadsheet.getName() + ' - Backup ' + academicYear + ' - ' + timestamp;

  sourceFile.makeCopy(backupName, parents.next());
  return 'Copia de seguridad creada: ' + backupName;
}

function saveNewCourseConfig_(processInput) {
  saveGeneralConfig_(processInput.config, {
    updateCover: false,
    showToast: false,
  });
}

function updateNewCourseCover_() {
  initializeCoverStructure_();
}

function updateNewCourseMetadata_() {
  initializeMetaStructure_();
}

function finishNewCoursePreparation_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  hideTechnicalSheets_(spreadsheet);
  actualizarIndicePortada();
  spreadsheet.toast('Nuevo curso preparado.', CP.PROJECT_NAME, 5);
}
