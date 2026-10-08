const CP_EVAL_COLORS = Object.freeze({
  pending: '#FFF8E1',
  red: '#C62828', blue: '#1565C0', green: '#2E7D32', gold: '#B26A00',
});

function getEvaluationConfig_(configSheet, context) {
  const units = readAndNormalizeModuleUnits_(configSheet, context.evaluations,
    { writeBack: false }).filter(function(unit) { return unit.hours > 0; });
  const weights = configSheet.getRange(28, 13, 15, 1).getValues();
  const finalWeights = configSheet.getRange(29, 34, context.evaluations.length, 1).getValues();
  const byEvaluation = context.evaluations.map(function(evaluation, index) {
    return {
      id: evaluation.id,
      name: evaluation.name,
      finalWeight: finalWeights[index][0],
      finalWeightRow: 29 + index,
      units: units.filter(function(unit) { return unit.evaluationId === evaluation.id; })
        .map(function(unit) {
          return Object.assign({}, unit, { weight: weights[unit.sourceRow - 28][0] });
        }),
    };
  });
  return byEvaluation;
}

function isEvaluationConfigComplete_(configSheet, context) {
  const blocks = getEvaluationConfig_(configSheet, context);
  if (!blocks.some(function(block) { return block.units.length; })) return false;
  if (blocks.some(function(block) {
    return block.units.some(function(unit) { return unit.weight === '' || unit.weight === null ||
      !Number.isFinite(Number(unit.weight)) || Number(unit.weight) < 0 ||
      Number(unit.weight) > 100; }) ||
      (block.units.length && Math.abs(block.units.reduce(function(total, unit) {
        return total + Number(unit.weight);
      }, 0) - 100) > 0.00001) ||
      block.finalWeight === '' || block.finalWeight === null ||
      !Number.isFinite(Number(block.finalWeight)) ||
      Number(block.finalWeight) < 0 || Number(block.finalWeight) > 100;
  })) return false;
  return Math.abs(blocks.reduce(function(total, block) {
    return total + Number(block.finalWeight);
  }, 0) - 100) < 0.00001;
}

function getEvaluationLayout_(blocks) {
  let column = 4;
  const groups = blocks.map(function(block) {
    const start = column;
    const units = block.units.map(function(unit) {
      return Object.assign({}, unit, { column: column++ });
    });
    const mediaColumn = column++;
    const educaColumn = column++;
    return Object.assign({}, block, { start: start, units: units,
      mediaColumn: mediaColumn, educaColumn: educaColumn, end: column - 1 });
  });
  const finalStart = column;
  return { groups: groups, finalStart: finalStart, finalMediaColumn: column,
    finalEducaColumn: column + 1, idColumn: column + 2,
    lastVisibleColumn: column + 1 };
}

function getEvaluationHeaders_(layout) {
  const headers = ['Apellidos', 'Nombre', 'Medidas'];
  layout.groups.forEach(function(group, index) {
    group.units.forEach(function(unit) { headers.push(unit.code); });
    const label = getEvaluationOrdinal_(index + 1);
    headers.push('Media ' + label, 'Educa ' + label);
  });
  headers.push('Media final', 'Educa final', 'alumno_id');
  return headers;
}

function getEvaluationOrdinal_(number) {
  return number + 'ª';
}

function compareEvaluationStudents_(first, second) {
  const normalized = function(value) { return String(value || '').trim().replace(/\s+/g, ' '); };
  return normalized(first[0]).localeCompare(normalized(second[0]),
    'es', { sensitivity: 'base' }) ||
    normalized(first[1]).localeCompare(normalized(second[1]),
      'es', { sensitivity: 'base' });
}

function getEvaluationMeasuresDisplay_(student) {
  return student.reaca ? 'REACA' : '';
}

function getEvaluationStudents_(spreadsheet, group) {
  const sheet = spreadsheet.getSheetByName(CP.SHEETS.STUDENTS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const target = normalizeScheduleText_(group).replace(/\s+/g, ' ').toLocaleUpperCase();
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues()
    .filter(function(row) {
      return String(row[6]).trim() &&
        normalizeScheduleText_(row[2]).replace(/\s+/g, ' ').toLocaleUpperCase() === target;
    }).map(function(row) {
      return { surname: row[0], name: row[1], reaca: row[4] === true,
        measures: String(row[5] || ''), id: String(row[6]) };
    });
}

function quoteEvaluationSheetName_(name) {
  return "'" + String(name).replace(/'/g, "''") + "'";
}

function buildEvaluationMediaFormula_(row, group, configName, separator) {
  const source = quoteEvaluationSheetName_(configName);
  const terms = group.units.map(function(unit) {
    return 'N(' + columnToLetter_(unit.column) + row + ')*' +
      source + '!$M$' + unit.sourceRow + '/100';
  });
  return '=ROUND(' + (terms.length ? terms.join('+') : '0') + separator + '2)';
}

function buildEvaluationWeightFormula_(unit, configName, separator) {
  const cell = quoteEvaluationSheetName_(configName) + '!$M$' + unit.sourceRow;
  return '=IF(' + cell + '=""' + separator + '""' + separator + cell + ')';
}

function buildEvaluationFinalFormula_(row, layout, configName, separator) {
  const source = quoteEvaluationSheetName_(configName);
  const terms = layout.groups.map(function(group) {
    return columnToLetter_(group.mediaColumn) + row + '*' +
      source + '!$AH$' + group.finalWeightRow + '/100';
  });
  return '=ROUND(' + terms.join('+') + separator + '2)';
}

function buildEvaluationStudentRows_(values, formulas, notes, students, width) {
  const byId = {};
  const items = [];
  for (let index = 0; index < values.length; index += 1) {
    const original = values[index];
    const id = String(original[width - 1] || '').trim();
    if (!id) {
      if (original.some(function(value) { return value !== '' && value !== null; })) {
        return { warning: 'Hay una fila de Evaluación con datos y sin alumno_id. No se ha reordenado.' };
      }
      continue;
    }
    if (byId[id]) return { warning: 'Hay alumno_id repetidos en Evaluación. No se ha reordenado.' };
    const row = original.map(function(value, column) {
      return formulas[index][column] || value;
    });
    const item = { id: id, values: row, notes: notes[index] };
    items.push(item);
    byId[id] = item;
  }
  let additions = 0;
  students.forEach(function(student) {
    let item = byId[student.id];
    if (!item) {
      item = { id: student.id, values: Array(width).fill(''), notes: Array(width).fill('') };
      item.values[width - 1] = student.id;
      items.push(item);
      byId[student.id] = item;
      additions += 1;
    }
    item.values[0] = student.surname;
    item.values[1] = student.name;
    item.values[2] = getEvaluationMeasuresDisplay_(student);
    item.notes[2] = student.measures;
  });
  items.sort(function(first, second) {
    return compareEvaluationStudents_(first.values, second.values);
  });
  return { items: items, additions: additions };
}

function repairEvaluationSheet_(sheet, configSheet, context, activity) {
  const spreadsheet = sheet.getParent();
  const layout = getEvaluationLayout_(getEvaluationConfig_(configSheet, context));
  const headers = getEvaluationHeaders_(layout);
  const provisional = sheet.getLastRow() < 2;
  let legacy = false;
  if (!provisional) {
    const existing = sheet.getRange(2, 1, 1, headers.length).getDisplayValues()[0];
    legacy = existing[2] === 'REACA';
    if (legacy) existing[2] = 'Medidas';
    if (existing.some(function(value, index) { return value !== headers[index]; })) {
      const warning = 'La estructura de UT de ' + sheet.getName() +
        ' no coincide con 4 Config. Se conservan todas sus notas; revisa la hoja manualmente.';
      console.warn(warning);
      spreadsheet.toast(warning, CP.PROJECT_NAME, 12);
      return warning;
    }
  }
  if (legacy) sheet.insertRowsBefore(3, 1);
  const lastExistingRow = sheet.getLastRow();
  const hasFooter = !provisional && !legacy && lastExistingRow >= 4 &&
    sheet.getRange(lastExistingRow, 1).getDisplayValue() === 'MEDIA DEL GRUPO';
  const existingCount = provisional ? 0 : Math.max(0, lastExistingRow - 3 - (hasFooter ? 1 : 0));
  const existingRange = existingCount ? sheet.getRange(4, 1, existingCount, layout.idColumn) : null;
  const values = existingRange ? existingRange.getValues() : [];
  if (legacy) values.forEach(function(row) {
    if (row[2] === 'Sí') row[2] = 'REACA';
    else if (row[2] === 'No') row[2] = '';
  });
  const formulas = existingRange ? existingRange.getFormulas() : [];
  const notes = existingRange ? existingRange.getNotes() : [];
  const students = getEvaluationStudents_(spreadsheet, activity.group);
  const rows = buildEvaluationStudentRows_(values, formulas, notes, students, layout.idColumn);
  if (rows.warning) {
    console.warn(rows.warning);
    spreadsheet.toast(rows.warning, CP.PROJECT_NAME, 12);
    return rows.warning;
  }
  const footerRow = 4 + rows.items.length;
  ensureSheetSize_(sheet, footerRow, layout.idColumn);
  if (hasFooter) sheet.getRange(lastExistingRow, 1, 1, 3).breakApart();
  sheet.getRange(1, 1, 3, layout.idColumn).breakApart().clearContent();
  sheet.getRange(2, 1, 1, layout.idColumn).setValues([headers]);
  sheet.getRange(1, 1, 1, 3).merge().setValue('ALUMNADO');
  layout.groups.forEach(function(group) {
    sheet.getRange(1, group.start, 1, group.end - group.start + 1)
      .merge().setValue(String(group.name).toLocaleUpperCase());
  });
  sheet.getRange(1, layout.finalStart, 1, 2).merge().setValue('FINAL');
  [1, 2, 3].forEach(function(column) {
    sheet.getRange(2, column, 2, 1).merge();
  });
  layout.groups.forEach(function(group) {
    [group.mediaColumn, group.educaColumn].forEach(function(column) {
      sheet.getRange(2, column, 2, 1).merge();
    });
    group.units.forEach(function(unit) {
      sheet.getRange(3, unit.column)
        .setFormula(buildEvaluationWeightFormula_(unit, configSheet.getName(),
          getModuleFormulaSeparator_(spreadsheet)))
        .setNumberFormat('0.##" %"');
    });
  });
  [layout.finalMediaColumn, layout.finalEducaColumn].forEach(function(column) {
    sheet.getRange(2, column, 2, 1).merge();
  });
  if (rows.items.length) {
    sheet.getRange(4, 1, rows.items.length, layout.idColumn)
      .setValues(rows.items.map(function(item) { return item.values; }));
    sheet.getRange(4, 1, rows.items.length, layout.idColumn)
      .setNotes(rows.items.map(function(item) { return item.notes; }));
    installEvaluationRows_(sheet, configSheet, layout, rows.items.length);
  }
  sheet.getRange(footerRow, 1, 1, layout.idColumn).breakApart().clearContent().clearNote();
  sheet.getRange(footerRow, 1, 1, 3).merge().setValue('MEDIA DEL GRUPO');
  installEvaluationGroupAverages_(sheet, layout, rows.items.length, footerRow);
  styleEvaluationSheet_(sheet, layout, rows.items.length, footerRow);
  sheet.setFrozenRows(3);
  sheet.setFrozenColumns(3);
  sheet.setHiddenGridlines(true);
  sheet.setTabColor(CP.TAB_COLORS.EVALUATION);
  sheet.hideColumns(layout.idColumn);
  trimSheetToBounds_(sheet, footerRow, layout.idColumn);
  installManagedSheetProtections_(sheet, 'EVALUATION');
  return sheet.getName() + ': ' + rows.additions + ' alumnos añadidos.';
}

function installEvaluationRows_(sheet, configSheet, layout, count) {
  const separator = getModuleFormulaSeparator_(sheet.getParent());
  const educaValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'MH'], true)
    .setAllowInvalid(false).build();
  layout.groups.forEach(function(group) {
    group.units.forEach(function(unit) {
      const range = sheet.getRange(4, unit.column, count, 1);
      // Relative validation must be anchored on the actual UT column.
      const cell = columnToLetter_(unit.column) + '4';
      range.setDataValidation(SpreadsheetApp.newDataValidation()
        .requireFormulaSatisfied('=AND(ISNUMBER(' + cell + ')' + separator + cell + '>=0' +
          separator + cell + '<=10' + separator + 'ROUND(' + cell + separator + '2)=' + cell + ')')
        .setAllowInvalid(false).build());
      range.setNumberFormat('0.00');
    });
    const formulas = Array.from({ length: count }, function(_, index) {
      return [buildEvaluationMediaFormula_(index + 4, group, configSheet.getName(), separator)];
    });
    sheet.getRange(4, group.mediaColumn, count, 1).setFormulas(formulas).setNumberFormat('0.00');
    sheet.getRange(4, group.educaColumn, count, 1).setDataValidation(educaValidation);
  });
  sheet.getRange(4, layout.finalMediaColumn, count, 1)
    .setFormulas(Array.from({ length: count }, function(_, index) {
      return [buildEvaluationFinalFormula_(index + 4, layout, configSheet.getName(), separator)];
    })).setNumberFormat('0.00');
  sheet.getRange(4, layout.finalEducaColumn, count, 1).setDataValidation(educaValidation);
}

function buildEvaluationGroupFormula_(column, count, kind, separator) {
  if (!count) return '';
  const range = columnToLetter_(column) + '4:' + columnToLetter_(column) + (count + 3);
  if (kind === 'EDUCA') {
    return '=IF(COUNTA(' + range + ')=0' + separator + '""' + separator +
      'ROUND((SUMPRODUCT(IFERROR(' + range + '*1' + separator + '0))+10*COUNTIF(' +
      range + separator + '"MH"))/COUNTA(' + range + ')' + separator + '2))';
  }
  if (kind === 'UT') return '=ROUND(SUM(' + range + ')/' + count + separator + '2)';
  return '=ROUND(AVERAGE(' + range + ')' + separator + '2)';
}

function installEvaluationGroupAverages_(sheet, layout, count, footerRow) {
  if (!count) return;
  const separator = getModuleFormulaSeparator_(sheet.getParent());
  layout.groups.forEach(function(group) {
    group.units.forEach(function(unit) {
      sheet.getRange(footerRow, unit.column)
        .setFormula(buildEvaluationGroupFormula_(unit.column, count, 'UT', separator));
    });
    sheet.getRange(footerRow, group.mediaColumn)
      .setFormula(buildEvaluationGroupFormula_(group.mediaColumn, count, 'MEDIA', separator));
    sheet.getRange(footerRow, group.educaColumn)
      .setFormula(buildEvaluationGroupFormula_(group.educaColumn, count, 'EDUCA', separator));
  });
  sheet.getRange(footerRow, layout.finalMediaColumn)
    .setFormula(buildEvaluationGroupFormula_(layout.finalMediaColumn, count, 'MEDIA', separator));
  sheet.getRange(footerRow, layout.finalEducaColumn)
    .setFormula(buildEvaluationGroupFormula_(layout.finalEducaColumn, count, 'EDUCA', separator));
  sheet.getRange(footerRow, 4, 1, layout.lastVisibleColumn - 3).setNumberFormat('0.00');
}

function styleEvaluationSheet_(sheet, layout, count, footerRow) {
  const last = layout.lastVisibleColumn;
  const colors = getActiveTheme_(sheet.getParent()).colors;
  sheet.getRange(1, 1, 3, last).setBackground(colors.secondary)
    .setFontColor(colors.onSecondary).setFontWeight('bold').setVerticalAlignment('middle')
    .setHorizontalAlignment('center');
  sheet.getRange(1, 1, 1, last).setBackground(colors.primary).setFontColor(colors.onPrimary);
  sheet.getRange(1, layout.finalStart, 1, 2)
    .setBackground(colors.accent).setFontColor(colors.onAccent);
  sheet.setRowHeights(1, 3, 30);
  [190, 150, 76].forEach(function(width, index) { sheet.setColumnWidth(index + 1, width); });
  if (count) {
    sheet.getRange(4, 1, count, last).setBackground(colors.surface)
      .setFontColor(colors.text).setFontWeight('normal').setVerticalAlignment('middle');
    sheet.getRange(4, 3, count, 1).setBackground(colors.muted)
      .setHorizontalAlignment('center');
    sheet.getRange(4, 4, count, last - 3).setHorizontalAlignment('center');
  }
  layout.groups.forEach(function(group) {
    group.units.forEach(function(unit) {
      sheet.getRange(2, unit.column).setBackground(unit.color)
        .setFontColor(getAccessibleTextColor_(unit.color)).setNote(unit.name);
      sheet.getRange(3, unit.column).setBackground(colors.muted)
        .setFontColor(colors.text);
      sheet.setColumnWidth(unit.column, 54);
    });
    if (count) {
      sheet.getRange(4, group.mediaColumn, count, 1).setBackground(colors.muted);
      sheet.getRange(4, group.educaColumn, count, 1)
        .setBackground(CP_EVAL_COLORS.pending).setFontWeight('bold');
    }
    sheet.setColumnWidth(group.mediaColumn, 69);
    sheet.setColumnWidth(group.educaColumn, 57);
  });
  if (count) {
    sheet.getRange(4, layout.finalMediaColumn, count, 1).setBackground(colors.muted);
    sheet.getRange(4, layout.finalEducaColumn, count, 1)
      .setBackground(CP_EVAL_COLORS.pending).setFontWeight('bold');
  }
  sheet.setColumnWidth(layout.finalMediaColumn, 72);
  sheet.setColumnWidth(layout.finalEducaColumn, 59);
  sheet.getRange(footerRow, 1, 1, last).setBackground(colors.muted)
    .setFontColor(colors.text).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(4, 1, count + 1, last).setBorder(true, true, true, true, true, true,
    colors.border, SpreadsheetApp.BorderStyle.SOLID);
  layout.groups.map(function(group) { return group.start; }).concat([layout.finalStart])
    .forEach(function(column) {
      sheet.getRange(1, column, footerRow, 1).setBorder(null, true, null, null, null,
        null, colors.border, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    });
  installEvaluationFormatting_(sheet, layout, count, footerRow);
}

function installEvaluationFormatting_(sheet, layout, count, footerRow) {
  const columns = [];
  layout.groups.forEach(function(group) {
    group.units.forEach(function(unit) { columns.push(unit.column); });
    columns.push(group.mediaColumn, group.educaColumn);
  });
  columns.push(layout.finalMediaColumn, layout.finalEducaColumn);
  const ranges = columns.map(function(column) { return sheet.getRange(4, column, count + 1, 1); });
  const rules = [
    { formula: '=AND(D3<>"",IFERROR(VALUE(D3)<5,FALSE))', color: CP_EVAL_COLORS.red },
    { formula: '=AND(D3<>"",IFERROR(VALUE(D3)>=5,FALSE),IFERROR(VALUE(D3)<7,FALSE))', color: CP_EVAL_COLORS.blue },
    { formula: '=AND(D3<>"",IFERROR(VALUE(D3)>=7,FALSE),IFERROR(VALUE(D3)<9,FALSE))', color: CP_EVAL_COLORS.green },
    { formula: '=OR(D3="MH",AND(D3<>"",IFERROR(VALUE(D3)>=9,FALSE)))', color: CP_EVAL_COLORS.gold },
  ];
  // Each column needs its own relative reference.
  const result = [];
  columns.forEach(function(column, index) {
    const cell = columnToLetter_(column) + '4';
    rules.forEach(function(rule) {
      const formula = rule.formula.replace(/D3/g, cell)
        .replace(/,/g, getModuleFormulaSeparator_(sheet.getParent()));
      result.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(formula).setFontColor(rule.color)
        .setRanges([ranges[index]]).build());
    });
  });
  sheet.setConditionalFormatRules(result);
}
