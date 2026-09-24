function abrirAsistenteNuevoCurso() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const currentConfig = getGeneralConfigValues_(spreadsheet);
  const currentLocation = getNotebookDriveLocation_();
  const proposedAcademicYear = proponerCursoAcademico_(
    new Date(),
    spreadsheet.getSpreadsheetTimeZone()
  );
  const wizardConfig = Object.assign({}, currentConfig);
  wizardConfig[CP.CONFIG_KEYS.ACADEMIC_YEAR] = proposedAcademicYear;

  const template = HtmlService.createTemplateFromFile('UiDialogNewCourse');
  template.currentAcademicYear = currentConfig[CP.CONFIG_KEYS.ACADEMIC_YEAR] || '';
  template.currentLocation = currentLocation;
  template.wizardConfig = wizardConfig;
  template.themeConfig = getThemeConfigForUi_(spreadsheet, currentConfig);
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
  const processInput = normalizeNewCourseProcessInput_(input);
  validateNotebookOriginalLocation_(processInput);
  processInput.previousConfig = getGeneralConfigValues_(
    SpreadsheetApp.getActiveSpreadsheet()
  );
  showProgressDialog_(CP.UI.NEW_COURSE_PROCESS_ID, processInput);
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
    createBackup: input.createBackup === true,
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

  if (processInput.moveNotebook) {
    steps.push({
      label: 'Moviendo cuaderno...',
      completedMessage: 'Cuaderno movido a la carpeta seleccionada.',
      run: moveNewCourseNotebook_,
    });
  }

  steps.push(
    {
      label: 'Actualizando curso académico...',
      completedMessage: 'Curso académico actualizado.',
      run: updateNewCourseAcademicYear_,
    },
    {
      label: 'Actualizando profesor y centro...',
      completedMessage: 'Datos del profesor y del centro actualizados.',
      run: updateNewCoursePeopleAndSchool_,
    },
    {
      label: 'Aplicando apariencia...',
      completedMessage: 'Apariencia actualizada.',
      run: updateNewCourseAppearance_,
    },
    {
      label: 'Actualizando la portada...',
      completedMessage: 'Portada e índice actualizados.',
      run: updateNewCourseCover_,
    },
    {
      label: 'Finalizando...',
      completedMessage: 'Metadatos sincronizados y nuevo curso preparado.',
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
  if (!isFileInFolder_(sourceFile, processInput.originalFolderId)) {
    throw new Error(
      'No se ha creado la copia porque el cuaderno ya no está en su carpeta original.'
    );
  }

  const originalFolder = getDriveFolderById_(processInput.originalFolderId);
  const academicYear = processInput.config[CP.CONFIG_KEYS.ACADEMIC_YEAR];
  const timestamp = Utilities.formatDate(
    new Date(),
    spreadsheet.getSpreadsheetTimeZone(),
    'yyyy-MM-dd HH-mm'
  );
  const backupName = spreadsheet.getName() + ' - Backup ' + academicYear + ' - ' + timestamp;

  const backupFile = sourceFile.makeCopy(backupName, originalFolder);
  if (!backupFile || backupFile.isTrashed() ||
      !isFileInFolder_(backupFile, processInput.originalFolderId)) {
    throw new Error('No se ha podido verificar la copia de seguridad en la carpeta original.');
  }
  return 'Copia de seguridad creada en ' + processInput.originalFolderName + '.';
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
    let restoredToOriginal = isFileInFolder_(file, processInput.originalFolderId);
    if (!restoredToOriginal) {
      try {
        file.moveTo(getDriveFolderById_(processInput.originalFolderId));
        restoredToOriginal = isFileInFolder_(file, processInput.originalFolderId);
      } catch (rollbackError) {
        restoredToOriginal = false;
      }
    }
    const backupMessage = processInput.createBackup
      ? ' La copia de seguridad se ha creado correctamente.'
      : '';
    const locationMessage = restoredToOriginal
      ? ' El cuaderno permanece en su carpeta original y no se ha modificado.'
      : ' No se ha podido confirmar el regreso del cuaderno a su carpeta original; revisa su ubicación.';
    throw new Error(
      'No se ha podido mover el cuaderno a la carpeta seleccionada.' +
      backupMessage + locationMessage
    );
  }
}

function updateNewCourseAcademicYear_(processInput) {
  applyNewCourseConfigKeys_(processInput, [CP.CONFIG_KEYS.ACADEMIC_YEAR]);
}

function updateNewCoursePeopleAndSchool_(processInput) {
  applyNewCourseConfigKeys_(processInput, [
    CP.CONFIG_KEYS.TEACHER,
    CP.CONFIG_KEYS.TEACHER_EMAIL,
    CP.CONFIG_KEYS.SCHOOL,
    CP.CONFIG_KEYS.SCHOOL_ADDRESS,
    CP.CONFIG_KEYS.SCHOOL_PHONE,
    CP.CONFIG_KEYS.SCHOOL_EMAIL,
    CP.CONFIG_KEYS.SCHOOL_WEB,
  ]);
}

function updateNewCourseAppearance_(processInput) {
  applyNewCourseConfigKeys_(processInput, [
    CP.CONFIG_KEYS.THEME_PRESET,
    CP.CONFIG_KEYS.THEME_PRIMARY,
    CP.CONFIG_KEYS.THEME_SECONDARY,
    CP.CONFIG_KEYS.THEME_ACCENT,
  ]);
}

function applyNewCourseConfigKeys_(processInput, keys) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const values = getGeneralConfigValues_(spreadsheet);
    keys.forEach(function(key) {
      values[key] = processInput.config[key];
    });
    saveGeneralConfig_(values, {
      updateCover: false,
      showToast: false,
    });
  } catch (error) {
    rollbackNewCoursePreparation_(processInput, error);
  }
}

function updateNewCourseCover_(processInput) {
  try {
    initializeCoverStructure_();
  } catch (error) {
    rollbackNewCoursePreparation_(processInput, error);
  }
}

function finishNewCoursePreparation_(processInput) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    initializeMetaStructure_();
    hideTechnicalSheets_(spreadsheet);
    actualizarIndicePortada();
    spreadsheet.toast('Nuevo curso preparado.', CP.PROJECT_NAME, 5);
  } catch (error) {
    rollbackNewCoursePreparation_(processInput, error);
  }
}

function rollbackNewCoursePreparation_(processInput, originalError) {
  const outcomes = [];
  let rollbackFailed = false;

  if (processInput.previousConfig) {
    try {
      saveGeneralConfig_(processInput.previousConfig, {
        updateCover: false,
        showToast: false,
      });
      initializeCoverStructure_();
      initializeMetaStructure_();
      outcomes.push('Se ha restaurado la configuración anterior.');
    } catch (error) {
      rollbackFailed = true;
      outcomes.push('No se ha podido restaurar completamente la configuración anterior.');
    }
  }

  if (processInput.moveNotebook) {
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const file = DriveApp.getFileById(spreadsheet.getId());
      if (!isFileInFolder_(file, processInput.originalFolderId)) {
        file.moveTo(getDriveFolderById_(processInput.originalFolderId));
      }
      outcomes.push('El cuaderno ha vuelto a su carpeta original.');
    } catch (error) {
      rollbackFailed = true;
      outcomes.push('No se ha podido devolver el cuaderno a su carpeta original.');
    }
  }

  if (processInput.createBackup) {
    outcomes.push('La copia de seguridad se conserva.');
  }

  const prefix = originalError && originalError.message
    ? originalError.message
    : 'No se ha podido completar la preparación del curso.';
  const suffix = rollbackFailed
    ? ' Revisa manualmente el cuaderno antes de continuar.'
    : '';
  throw new Error(prefix + ' ' + outcomes.join(' ') + suffix);
}
