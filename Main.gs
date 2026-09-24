function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(CP.MENU.NAME)
    .addItem(CP.MENU.INIT, 'abrirDialogoInicializacion')
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
