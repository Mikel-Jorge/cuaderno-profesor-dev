function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const modulesMenu = ui.createMenu(CP.MENU.MODULES)
    .addItem(CP.MENU.MODULE_CONFIG_CREATE, 'abrirCreacionConfiguracionModulo')
    .addItem(CP.MENU.MODULE_CONFIG_RECALCULATE, 'recalcularConfiguracionModulo')
    .addItem(CP.MENU.MODULE_TRACKING_CREATE, 'abrirCreacionSeguimientoEvaluacion');

  const configMenu = ui.createMenu(CP.MENU.CONFIG)
    .addItem(CP.MENU.GENERAL_DATA, 'abrirDatosGenerales')
    .addItem(CP.MENU.CALENDAR_CONFIG, 'abrirConfiguracionCalendario')
    .addItem(CP.MENU.SCHEDULE_CONFIG, 'abrirConfiguracionHorario');

  ui
    .createMenu(CP.MENU.NAME)
    .addSubMenu(configMenu)
    .addSubMenu(modulesMenu)
    .addSeparator()
    .addItem(CP.MENU.INIT, 'abrirDialogoInicializacion')
    .addSeparator()
    .addItem(CP.MENU.NEW_COURSE, 'abrirPrepararNuevoCurso')
    .addItem(CP.MENU.HELP, 'mostrarAyuda')
    .addToUi();
}

function mostrarAyuda() {
  abrirPanelLateral();
}
