const CP_EVAL_COLORS = Object.freeze({
  header: '#BF360C', block: '#E65100', final: '#6D4C41',
  muted: '#F1F3F4', pending: '#FFF8E1', line: '#B0BEC5',
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
  const headers = ['Apellidos', 'Nombre', 'REACA'];
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

function buildEvaluationFinalFormula_(row, layout, configName, separator) {
  const source = quoteEvaluationSheetName_(configName);
  const terms = layout.groups.map(function(group) {
    return columnToLetter_(group.mediaColumn) + row + '*' +
      source + '!$AH$' + group.finalWeightRow + '/100';
  });
  return '=ROUND(' + terms.join('+') + separator + '2)';
}

function repairEvaluationSheet_(sheet, configSheet, context, activity) {
  const spreadsheet = sheet.getParent();
  const layout = getEvaluationLayout_(getEvaluationConfig_(configSheet, context));
  const headers = getEvaluationHeaders_(layout);
  const provisional = sheet.getLastRow() === 0 ||
    (sheet.getLastRow() === 1 && !sheet.getRange(1, 1).getDisplayValue());
  if (!provisional) {
    const existing = sheet.getRange(2, 1, 1, Math.min(sheet.getLastColumn(), headers.length))
      .getDisplayValues()[0];
    if (existing.length !== headers.length || existing.some(function(value, index) {
      return value !== headers[index];
    })) {
      const warning = 'La estructura de UT de ' + sheet.getName() +
        ' no coincide con 4 Config. Se conservan todas sus notas; revisa la hoja manualmente.';
      console.warn(warning);
      spreadsheet.toast(warning, CP.PROJECT_NAME, 12);
      return warning;
    }
  }
  const existingRows = provisional ? 0 : Math.max(0, sheet.getLastRow() - 2);
  const ids = existingRows ? sheet.getRange(3, layout.idColumn, existingRows, 1)
    .getValues().map(function(row) { return String(row[0] || ''); }) : [];
  const known = {};
  ids.forEach(function(id) { if (id) known[id] = true; });
  const students = getEvaluationStudents_(spreadsheet, activity.group);
  const additions = students.filter(function(student) { return !known[student.id]; });
  if (provisional) additions.sort(function(a, b) {
    return (String(a.surname) + '\u0000' + String(a.name)).localeCompare(
      String(b.surname) + '\u0000' + String(b.name), 'es');
  });
  const lastRow = 2 + existingRows + additions.length;
  const requiredRows = Math.max(3, lastRow);
  ensureSheetSize_(sheet, requiredRows, layout.idColumn);
  if (provisional) sheet.getRange(1, 1, 2, layout.idColumn).breakApart();
  sheet.getRange(2, 1, 1, layout.idColumn).setValues([headers]);
  sheet.getRange(1, 1, 1, 3).merge().setValue('ALUMNADO');
  layout.groups.forEach(function(group) {
    sheet.getRange(1, group.start, 1, group.end - group.start + 1)
      .merge().setValue(String(group.name).toLocaleUpperCase());
  });
  sheet.getRange(1, layout.finalStart, 1, 2).merge().setValue('FINAL');
  const additionsStart = 3 + existingRows;
  if (additions.length) {
    const values = additions.map(function(student) {
      const row = Array(layout.idColumn).fill('');
      row[0] = student.surname;
      row[1] = student.name;
      row[2] = student.reaca ? 'Sí' : 'No';
      row[layout.idColumn - 1] = student.id;
      return row;
    });
    sheet.getRange(additionsStart, 1, additions.length, layout.idColumn).setValues(values);
  }
  const byId = {};
  students.forEach(function(student) { byId[student.id] = student; });
  const allIds = ids.concat(additions.map(function(student) { return student.id; }));
  if (allIds.length) {
    const names = sheet.getRange(3, 1, allIds.length, 3).getValues();
    const notes = sheet.getRange(3, 3, allIds.length, 1).getNotes();
    allIds.forEach(function(id, index) {
      const student = byId[id];
      if (!student) return;
      names[index] = [student.surname, student.name, student.reaca ? 'Sí' : 'No'];
      notes[index] = [student.measures];
    });
    sheet.getRange(3, 1, allIds.length, 3).setValues(names);
    sheet.getRange(3, 3, allIds.length, 1).setNotes(notes);
    installEvaluationRows_(sheet, configSheet, layout, allIds.length);
  }
  styleEvaluationSheet_(sheet, layout, Math.max(1, allIds.length));
  sheet.setFrozenRows(2);
  sheet.setFrozenColumns(3);
  sheet.setHiddenGridlines(true);
  sheet.setTabColor(CP.TAB_COLORS.EVALUATION);
  sheet.hideColumns(layout.idColumn);
  trimSheetToBounds_(sheet, requiredRows, layout.idColumn);
  return sheet.getName() + ': ' + additions.length + ' alumnos añadidos.';
}

function installEvaluationRows_(sheet, configSheet, layout, count) {
  const separator = getModuleFormulaSeparator_(sheet.getParent());
  const educaValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'MH'], true)
    .setAllowInvalid(false).build();
  layout.groups.forEach(function(group) {
    group.units.forEach(function(unit) {
      const range = sheet.getRange(3, unit.column, count, 1);
      // Relative validation must be anchored on the actual UT column.
      const cell = columnToLetter_(unit.column) + '3';
      range.setDataValidation(SpreadsheetApp.newDataValidation()
        .requireFormulaSatisfied('=AND(ISNUMBER(' + cell + ')' + separator + cell + '>=0' +
          separator + cell + '<=10' + separator + 'ROUND(' + cell + separator + '2)=' + cell + ')')
        .setAllowInvalid(false).build());
      range.setNumberFormat('0.00');
    });
    const formulas = Array.from({ length: count }, function(_, index) {
      return [buildEvaluationMediaFormula_(index + 3, group, configSheet.getName(), separator)];
    });
    sheet.getRange(3, group.mediaColumn, count, 1).setFormulas(formulas).setNumberFormat('0.00');
    sheet.getRange(3, group.educaColumn, count, 1).setDataValidation(educaValidation);
  });
  sheet.getRange(3, layout.finalMediaColumn, count, 1)
    .setFormulas(Array.from({ length: count }, function(_, index) {
      return [buildEvaluationFinalFormula_(index + 3, layout, configSheet.getName(), separator)];
    })).setNumberFormat('0.00');
  sheet.getRange(3, layout.finalEducaColumn, count, 1).setDataValidation(educaValidation);
}

function styleEvaluationSheet_(sheet, layout, count) {
  const last = layout.lastVisibleColumn;
  sheet.getRange(1, 1, 2, last).setBackground(CP_EVAL_COLORS.header)
    .setFontColor('#FFFFFF').setFontWeight('bold').setVerticalAlignment('middle');
  sheet.getRange(1, 1, 1, last).setHorizontalAlignment('center');
  sheet.getRange(2, 3, 1, last - 2).setHorizontalAlignment('center');
  sheet.setRowHeights(1, 2, 32);
  [190, 150, 66].forEach(function(width, index) { sheet.setColumnWidth(index + 1, width); });
  sheet.getRange(3, 3, count, 1).setBackground(CP_EVAL_COLORS.muted)
    .setHorizontalAlignment('center');
  layout.groups.forEach(function(group) {
    sheet.getRange(1, group.start, 1, group.end - group.start + 1)
      .setBackground(CP_EVAL_COLORS.block);
    group.units.forEach(function(unit) {
      const header = sheet.getRange(2, unit.column);
      header.setBackground(unit.color).setFontColor(getAccessibleTextColor_(unit.color))
        .setNote(unit.name + '\nPeso en la evaluación: ' + unit.weight + ' %');
      sheet.setColumnWidth(unit.column, 75);
    });
    sheet.getRange(3, group.mediaColumn, count, 1).setBackground(CP_EVAL_COLORS.muted);
    sheet.setColumnWidth(group.mediaColumn, 95);
    sheet.setColumnWidth(group.educaColumn, 83);
  });
  sheet.getRange(1, layout.finalStart, 1, 2).setBackground(CP_EVAL_COLORS.final);
  sheet.getRange(3, layout.finalMediaColumn, count, 1).setBackground(CP_EVAL_COLORS.muted);
  sheet.setColumnWidth(layout.finalMediaColumn, 100);
  sheet.setColumnWidth(layout.finalEducaColumn, 85);
  sheet.getRange(3, 1, count, last).setVerticalAlignment('middle');
  sheet.getRange(3, 4, count, last - 3).setHorizontalAlignment('center');
  sheet.getRange(3, 1, count, last).setBorder(true, true, true, true, true, true,
    CP_EVAL_COLORS.line, SpreadsheetApp.BorderStyle.SOLID);
  layout.groups.map(function(group) { return group.start; }).concat([layout.finalStart])
    .forEach(function(column) {
      sheet.getRange(1, column, count + 2, 1).setBorder(null, true, null, null, null,
        null, '#78909C', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    });
  installEvaluationFormatting_(sheet, layout, count);
}

function installEvaluationFormatting_(sheet, layout, count) {
  const columns = [];
  layout.groups.forEach(function(group) {
    group.units.forEach(function(unit) { columns.push(unit.column); });
    columns.push(group.mediaColumn, group.educaColumn);
  });
  columns.push(layout.finalMediaColumn, layout.finalEducaColumn);
  const ranges = columns.map(function(column) { return sheet.getRange(3, column, count, 1); });
  const rules = [
    { formula: '=AND(D3<>"",IFERROR(VALUE(D3)<5,FALSE))', color: CP_EVAL_COLORS.red },
    { formula: '=AND(D3<>"",IFERROR(VALUE(D3)>=5,FALSE),IFERROR(VALUE(D3)<7,FALSE))', color: CP_EVAL_COLORS.blue },
    { formula: '=AND(D3<>"",IFERROR(VALUE(D3)>=7,FALSE),IFERROR(VALUE(D3)<9,FALSE))', color: CP_EVAL_COLORS.green },
    { formula: '=OR(D3="MH",AND(D3<>"",IFERROR(VALUE(D3)>=9,FALSE)))', color: CP_EVAL_COLORS.gold },
  ];
  // Each column needs its own relative reference.
  const result = [];
  columns.forEach(function(column, index) {
    const cell = columnToLetter_(column) + '3';
    rules.forEach(function(rule) {
      const formula = rule.formula.replace(/D3/g, cell)
        .replace(/,/g, getModuleFormulaSeparator_(sheet.getParent()));
      result.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(formula).setFontColor(rule.color)
        .setRanges([ranges[index]]).build());
    });
    if (layout.groups.some(function(group) { return group.educaColumn === column; }) ||
        column === layout.finalEducaColumn) {
      result.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=' + cell + '=""')
        .setBackground(CP_EVAL_COLORS.pending).setRanges([ranges[index]]).build());
    }
  });
  sheet.setConditionalFormatRules(result);
}
