function testClaspSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ss.toast(
    'clasp conectado correctamente',
    'CP_DEV',
    5
  );
}