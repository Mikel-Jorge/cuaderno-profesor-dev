function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const configMenu = ui.createMenu(CP.MENU.CONFIG)
    .addItem(CP.MENU.GENERAL_DATA, 'abrirDatosGenerales');

  ui
    .createMenu(CP.MENU.NAME)
    .addItem(CP.MENU.INIT, 'abrirDialogoInicializacion')
    .addSubMenu(configMenu)
    .addSeparator()
    .addItem(CP.MENU.HELP, 'mostrarAyuda')
    .addToUi();
}

function mostrarAyuda() {
  SpreadsheetApp.getUi().alert(
    CP.MENU.HELP,
    'El panel de ayuda se implementara en una tarea posterior.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
