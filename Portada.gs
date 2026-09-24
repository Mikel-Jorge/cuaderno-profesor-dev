function renderPortada_(sheet) {
  sheet.setHiddenGridlines(true);
  sheet.setTabColor(CP_COLORS.PRIMARY);
  sheet.setFrozenRows(0);
  sheet.setFrozenColumns(0);

  sheet.setColumnWidths(1, 1, 28);
  sheet.setColumnWidths(2, 1, 190);
  sheet.setColumnWidths(3, 1, 320);
  sheet.setColumnWidths(4, 1, 36);
  sheet.setColumnWidths(5, 1, 150);
  sheet.setColumnWidths(6, 1, 180);

  sheet.setRowHeights(1, 1, 28);
  sheet.setRowHeights(2, 1, 54);
  sheet.setRowHeights(3, 1, 28);
  sheet.setRowHeights(4, 5, 34);

  setMergedRangeValue_(sheet.getRange('B2:F2'), 'CUADERNO DEL PROFESOR')
    .setBackground(CP_COLORS.DARK)
    .setFontColor(CP_COLORS.WHITE)
    .setFontWeight('bold')
    .setFontSize(22)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  setMergedRangeValue_(sheet.getRange('E3:F3'), 'ENTORNO DEV')
    .setBackground(CP_COLORS.DEV)
    .setFontColor(CP_COLORS.WHITE)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  const fields = [
    ['Curso academico'],
    ['Profesor'],
    ['Centro'],
  ];

  sheet.getRange(4, 2, fields.length, 1).setValues(fields);
  sheet.getRange(4, 2, fields.length, 1)
    .setBackground(CP_COLORS.PRIMARY_LIGHT)
    .setFontWeight('bold');
  sheet.getRange(4, 3, fields.length, 1)
    .setBackground(CP_COLORS.WHITE)
    .setBorder(true, true, true, true, true, true, CP_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  setMergedRangeValue_(sheet.getRange('B8:F8'), 'Estructura base inicial. El calendario, horario, modulos, alumnado, seguimiento y evaluacion se implementaran en tareas posteriores.')
    .setBackground(CP_COLORS.MUTED)
    .setFontColor(CP_COLORS.DARK)
    .setWrap(true)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(8, 48);
}
