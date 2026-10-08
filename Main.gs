function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const modulesMenu = ui.createMenu(CP.MENU.MODULES)
    .addItem(CP.MENU.MODULE_CONFIG_CREATE, 'abrirCreacionConfiguracionModulo')
    .addItem(CP.MENU.MODULE_CONFIG_RECALCULATE, 'recalcularConfiguracionModulo')
    .addItem(CP.MENU.MODULE_TRACKING_CREATE, 'abrirCreacionSeguimientoEvaluacion');

  ui
    .createMenu(CP.MENU.NAME)
    .addItem(CP.MENU.GENERAL_DATA, 'abrirDatosGenerales')
    .addItem(CP.MENU.CALENDAR_CONFIG, 'abrirConfiguracionCalendario')
    .addItem(CP.MENU.SCHEDULE_CONFIG, 'abrirConfiguracionHorario')
    .addItem(CP.MENU.COURSE_WIZARD, 'abrirAsistenteConfiguracionCurso')
    .addSeparator()
    .addItem(CP.MENU.INIT, 'abrirDialogoInicializacion')
    .addItem(CP.MENU.HELP, 'mostrarAyuda')
    .addSeparator()
    .addItem(CP.MENU.NEW_COURSE, 'abrirPrepararNuevoCurso')
    .addToUi();
  modulesMenu
    .addToUi();
}

function mostrarAyuda() {
  abrirPanelLateral();
}
