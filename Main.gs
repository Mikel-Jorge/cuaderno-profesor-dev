function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const config = getGeneralConfigValues_(SpreadsheetApp.getActiveSpreadsheet());
  const studentsMenu = ui.createMenu(CP.MENU.STUDENTS);
  if (isTutorEnabled_(config[CP.CONFIG_KEYS.IS_TUTOR])) {
    studentsMenu.addItem(CP.MENU.TUTOR_IMPORT, 'abrirImportadorTutoria').addSeparator();
  }
  studentsMenu
    .addItem(CP.MENU.EDUCA_IMPORT, 'abrirImportadorEduca')
    .addItem(CP.MENU.MODULE_ENROLLMENTS, 'abrirMatriculasModulos')
    .addItem(CP.MENU.CONTACTS_SYNC, 'abrirSincronizacionContactos');

  const modulesMenu = ui.createMenu(CP.MENU.MODULES)
    .addItem(CP.MENU.MODULE_CONFIG_CREATE, 'abrirCreacionConfiguracionModulo')
    .addItem(CP.MENU.MODULE_CONFIG_RECALCULATE, 'recalcularConfiguracionModulo')
    .addItem(CP.MENU.MODULE_TRACKING_CREATE, 'abrirCreacionSeguimientoEvaluacion');

  const configMenu = ui.createMenu(CP.MENU.CONFIG)
    .addItem(CP.MENU.GENERAL_DATA, 'abrirDatosGenerales')
    .addItem(CP.MENU.CALENDAR_CONFIG, 'abrirConfiguracionCalendario')
    .addItem(CP.MENU.SCHEDULE_CONFIG, 'abrirConfiguracionHorario');

  const menu = ui.createMenu(CP.MENU.NAME)
    .addSubMenu(configMenu)
    .addSubMenu(studentsMenu)
    .addSubMenu(modulesMenu)
    .addSeparator();
  menu
    .addItem(CP.MENU.INIT, 'abrirDialogoInicializacion')
    .addSeparator()
    .addItem(CP.MENU.NEW_COURSE, 'abrirPrepararNuevoCurso')
    .addItem(CP.MENU.HELP, 'mostrarAyuda')
    .addToUi();
}

function mostrarAyuda() {
  abrirPanelLateral();
}
