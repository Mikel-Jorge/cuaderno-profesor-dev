function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const configMenu = ui.createMenu(CP.MENU.CONFIG)
    .addItem(CP.MENU.GENERAL_DATA, 'abrirDatosGenerales')
    .addItem(CP.MENU.CALENDAR_CONFIG, 'abrirConfiguracionCalendario');

  ui
    .createMenu(CP.MENU.NAME)
    .addItem(CP.MENU.NEW_COURSE, 'abrirPrepararNuevoCurso')
    .addItem(CP.MENU.INIT, 'abrirDialogoInicializacion')
    .addItem(CP.MENU.CALENDAR_UPDATE, 'actualizarCalendario')
    .addSubMenu(configMenu)
    .addSeparator()
    .addItem(CP.MENU.HELP, 'mostrarAyuda')
    .addToUi();
}

function mostrarAyuda() {
  abrirPanelLateral();
}
