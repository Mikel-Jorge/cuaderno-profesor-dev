const CP_EDUCA_MAX_FILE_BYTES = 5 * 1024 * 1024;
const CP_EDUCA_MAX_EXPANDED_BYTES = 30 * 1024 * 1024;
const CP_EDUCA_MAX_ZIP_ENTRIES = 120;
const CP_EDUCA_MAX_WORKSHEETS = 60;
const CP_EDUCA_FORMAT_ERROR = 'Este archivo no tiene el formato esperado del informe «Listado mi alumnado» de EDUCA. Descárgalo desde Alumnado → Informes → Listado mi alumnado → Por profesor → Excel → Asignatura.';
const CP_EDUCA_OLD_XLS_ERROR = 'No se reconoce el formato actual de «Listado mi alumnado» de EDUCA. Vuelve a descargarlo desde: Alumnado → Informes → Listado mi alumnado → Por profesor → Excel.';
const CP_EDUCA_EMAIL_NOTICE = 'El informe de EDUCA no incluye el correo electrónico del alumnado. Después de importar, completa manualmente la columna Email de 3 Alumnado.';

function abrirImportadorEduca() {
  const template = HtmlService.createTemplateFromFile('UiDialogEducaImport');
  template.hasModules = getModuleActivitiesForEnrollment_().length > 0;
  setCommonUiTemplateData_(template);
  SpreadsheetApp.getUi().showModalDialog(template.evaluate()
    .setWidth(CP.UI.EDUCA_IMPORT_DIALOG_WIDTH)
    .setHeight(CP.UI.EDUCA_IMPORT_DIALOG_HEIGHT), CP.MENU.EDUCA_IMPORT);
}

function readZipUnsigned16_(bytes, offset) {
  return (bytes[offset] & 255) | ((bytes[offset + 1] & 255) << 8);
}

function readZipUnsigned32_(bytes, offset) {
  return (readZipUnsigned16_(bytes, offset) +
    readZipUnsigned16_(bytes, offset + 2) * 65536) >>> 0;
}

function validateEducaZipDirectory_(bytes) {
  if (bytes.length < 22 || readZipUnsigned32_(bytes, 0) !== 0x04034b50) {
    if (bytes.length >= 8 && readZipUnsigned32_(bytes, 0) === 0xe011cfd0) {
      throw new Error(CP_EDUCA_OLD_XLS_ERROR);
    }
    throw new Error(CP_EDUCA_FORMAT_ERROR);
  }
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) {
    if (readZipUnsigned32_(bytes, index) === 0x06054b50) { end = index; break; }
  }
  if (end < 0) throw new Error(CP_EDUCA_FORMAT_ERROR);
  const count = readZipUnsigned16_(bytes, end + 10);
  const offset = readZipUnsigned32_(bytes, end + 16);
  if (!count || count > CP_EDUCA_MAX_ZIP_ENTRIES ||
      count === 65535 || offset === 0xffffffff) throw new Error(CP_EDUCA_FORMAT_ERROR);
  let position = offset, total = 0;
  for (let index = 0; index < count; index += 1) {
    if (position + 46 > bytes.length || readZipUnsigned32_(bytes, position) !== 0x02014b50) {
      throw new Error(CP_EDUCA_FORMAT_ERROR);
    }
    const flags = readZipUnsigned16_(bytes, position + 8);
    const method = readZipUnsigned16_(bytes, position + 10);
    const size = readZipUnsigned32_(bytes, position + 24);
    const nameLength = readZipUnsigned16_(bytes, position + 28);
    const extraLength = readZipUnsigned16_(bytes, position + 30);
    const commentLength = readZipUnsigned16_(bytes, position + 32);
    if ((flags & 1) || (method !== 0 && method !== 8) || size === 0xffffffff ||
        size > 10 * 1024 * 1024) throw new Error(CP_EDUCA_FORMAT_ERROR);
    total += size;
    if (total > CP_EDUCA_MAX_EXPANDED_BYTES) throw new Error(CP_EDUCA_FORMAT_ERROR);
    position += 46 + nameLength + extraLength + commentLength;
  }
  if (position > bytes.length) throw new Error(CP_EDUCA_FORMAT_ERROR);
}

function readEducaPackage_(blob) {
  if (!blob || typeof blob.getBytes !== 'function') throw new Error('Selecciona el archivo Excel de EDUCA.');
  const bytes = blob.getBytes();
  if (bytes.length > CP_EDUCA_MAX_FILE_BYTES) throw new Error('El archivo supera el límite de 5 MB.');
  validateEducaZipDirectory_(bytes);
  let parts;
  try {
    const zipBlob = Utilities.newBlob(bytes, 'application/zip', 'educa-import.zip');
    parts = Utilities.unzip(zipBlob);
  } catch (error) { throw new Error(CP_EDUCA_FORMAT_ERROR); }
  if (parts.length > CP_EDUCA_MAX_ZIP_ENTRIES) throw new Error(CP_EDUCA_FORMAT_ERROR);
  const files = {};
  let total = 0;
  parts.forEach(function(part) {
    const name = part.getName().replace(/\\/g, '/');
    if (name.endsWith('/')) return;
    if (name.includes('..') || name.startsWith('/') || files[name] ||
        /vbaProject|macroEnabled|externalLinks|embeddings|\.bin$/i.test(name)) {
      throw new Error(CP_EDUCA_FORMAT_ERROR);
    }
    total += part.getBytes().length;
    if (total > CP_EDUCA_MAX_EXPANDED_BYTES) throw new Error(CP_EDUCA_FORMAT_ERROR);
    files[name] = part;
  });
  if (!files['[Content_Types].xml'] || !files['xl/workbook.xml'] ||
      !files['xl/_rels/workbook.xml.rels']) throw new Error(CP_EDUCA_FORMAT_ERROR);
  if (parseEducaXml_(files['[Content_Types].xml']).getName() !== 'Types') {
    throw new Error(CP_EDUCA_FORMAT_ERROR);
  }
  if (/macroEnabled|vbaProject/i.test(files['[Content_Types].xml'].getDataAsString('UTF-8'))) {
    throw new Error(CP_EDUCA_FORMAT_ERROR);
  }
  return files;
}

function parseEducaXml_(blob) {
  const source = blob.getDataAsString('UTF-8');
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error(CP_EDUCA_FORMAT_ERROR);
  try { return XmlService.parse(source).getRootElement(); }
  catch (error) { throw new Error(CP_EDUCA_FORMAT_ERROR); }
}

function educaChildren_(element, name) {
  return element ? element.getChildren().filter(function(child) { return child.getName() === name; }) : [];
}

function educaChild_(element, name) { return educaChildren_(element, name)[0] || null; }

function educaAttribute_(element, name) {
  const attribute = element && element.getAttributes().find(function(item) {
    return item.getName() === name;
  });
  return attribute ? attribute.getValue() : '';
}

function collectEducaText_(element) {
  if (!element) return '';
  if (element.getName() === 't') return element.getText();
  return element.getChildren().map(collectEducaText_).join('');
}

function readEducaSharedStrings_(files) {
  if (!files['xl/sharedStrings.xml']) return [];
  const root = parseEducaXml_(files['xl/sharedStrings.xml']);
  if (root.getName() !== 'sst') throw new Error(CP_EDUCA_FORMAT_ERROR);
  return educaChildren_(root, 'si').map(collectEducaText_);
}

function readEducaWorksheetRows_(blob, strings) {
  const root = parseEducaXml_(blob);
  if (root.getName() !== 'worksheet') throw new Error(CP_EDUCA_FORMAT_ERROR);
  const data = educaChild_(root, 'sheetData');
  if (!data) throw new Error(CP_EDUCA_FORMAT_ERROR);
  const sheetRows = educaChildren_(data, 'row');
  if (sheetRows.length > 5000) throw new Error(CP_EDUCA_FORMAT_ERROR);
  return sheetRows.map(function(row) {
    const values = [];
    educaChildren_(row, 'c').forEach(function(cell) {
      const reference = educaAttribute_(cell, 'r');
      const letters = /^[A-Z]+/i.exec(reference);
      if (!letters) throw new Error(CP_EDUCA_FORMAT_ERROR);
      let column = 0;
      letters[0].toUpperCase().split('').forEach(function(letter) {
        column = column * 26 + letter.charCodeAt(0) - 64;
      });
      if (column > 100) throw new Error(CP_EDUCA_FORMAT_ERROR);
      const type = educaAttribute_(cell, 't');
      const value = educaChild_(cell, 'v');
      if (type === 's') {
        if (!value) throw new Error(CP_EDUCA_FORMAT_ERROR);
        const index = Number(value && value.getText());
        if (!Number.isInteger(index) || index < 0 || index >= strings.length) {
          throw new Error(CP_EDUCA_FORMAT_ERROR);
        }
        values[column - 1] = strings[index];
      } else if (type === 'inlineStr') {
        values[column - 1] = collectEducaText_(educaChild_(cell, 'is'));
      } else {
        values[column - 1] = value ? value.getText() : '';
      }
    });
    return values;
  });
}

function resolveEducaWorkbookTarget_(target) {
  const parts = (target.startsWith('/') ? target.slice(1) :
    target.startsWith('xl/') ? target : 'xl/' + target).split('/');
  const clean = [];
  parts.forEach(function(part) {
    if (part === '.') return;
    if (part === '..') {
      if (!clean.length) throw new Error(CP_EDUCA_FORMAT_ERROR);
      clean.pop();
    }
    else clean.push(part);
  });
  const result = clean.join('/');
  if (!/^xl\/worksheets\/[^/]+\.xml$/.test(result)) throw new Error(CP_EDUCA_FORMAT_ERROR);
  return result;
}

function parseEducaWorkbook_(files) {
  const workbook = parseEducaXml_(files['xl/workbook.xml']);
  const relationships = parseEducaXml_(files['xl/_rels/workbook.xml.rels']);
  if (workbook.getName() !== 'workbook' || relationships.getName() !== 'Relationships') {
    throw new Error(CP_EDUCA_FORMAT_ERROR);
  }
  const byId = {};
  educaChildren_(relationships, 'Relationship').forEach(function(item) {
    if (/\/worksheet$/.test(educaAttribute_(item, 'Type'))) {
      byId[educaAttribute_(item, 'Id')] = educaAttribute_(item, 'Target');
    }
  });
  const sheets = educaChildren_(educaChild_(workbook, 'sheets'), 'sheet');
  if (!sheets.length || sheets.length > CP_EDUCA_MAX_WORKSHEETS) {
    throw new Error(CP_EDUCA_FORMAT_ERROR);
  }
  const strings = readEducaSharedStrings_(files);
  return sheets.map(function(sheet) {
    const target = byId[educaAttribute_(sheet, 'id')];
    const path = target && resolveEducaWorkbookTarget_(target);
    if (!path || !files[path]) throw new Error(CP_EDUCA_FORMAT_ERROR);
    return readEducaWorksheetRows_(files[path], strings);
  });
}

function parseEducaReportSheet_(rows) {
  const textRows = rows.map(function(row) { return row.map(function(value) {
    return String(value == null ? '' : value).trim();
  }); });
  const titleIndex = textRows.findIndex(function(row) {
    return normalizeEnrollmentKey_(row.join(' ')).includes('ALUMNOS POR PROFESOR Y ASIGNATURA');
  });
  if (titleIndex < 0) throw new Error(CP_EDUCA_FORMAT_ERROR);
  const headerIndex = textRows.findIndex(function(row, index) {
    if (index <= titleIndex) return false;
    const keys = row.map(normalizeEnrollmentKey_);
    return ['Nº', 'Nombre', 'Curso', 'Estado', 'Grupo'].every(function(label) {
      return keys.includes(normalizeEnrollmentKey_(label));
    });
  });
  if (headerIndex < 0) throw new Error(CP_EDUCA_FORMAT_ERROR);
  const headers = textRows[headerIndex].map(normalizeEnrollmentKey_);
  if (['Nº', 'NOMBRE', 'CURSO', 'ESTADO', 'GRUPO'].some(function(label) {
    return headers.filter(function(value) { return value === normalizeEnrollmentKey_(label); }).length !== 1;
  })) throw new Error(CP_EDUCA_FORMAT_ERROR);
  const nameColumn = headers.indexOf('NOMBRE');
  const groupColumn = headers.indexOf('GRUPO');
  const numberColumn = headers.indexOf('Nº');
  const firstStudentIndex = textRows.findIndex(function(row, index) {
    return index > headerIndex && row[nameColumn] && row[groupColumn];
  });
  const descriptorEnd = Math.min(textRows.length, titleIndex + 16,
    firstStudentIndex < 0 ? textRows.length : firstStudentIndex);
  const descriptors = [];
  for (let index = titleIndex + 1; index < descriptorEnd; index += 1) {
    if (index === headerIndex) continue;
    const match = /;\s*([\s\S]+?)\s*-AG\s*\(/i.exec(textRows[index].join(' '));
    if (match && match[1].trim()) descriptors.push({ index: index, subject: match[1].trim() });
  }
  if (descriptors.length !== 1) throw new Error(CP_EDUCA_FORMAT_ERROR);
  const descriptorIndex = descriptors[0].index;
  if (descriptorIndex > headerIndex && textRows.slice(headerIndex + 1, descriptorIndex)
    .some(function(row) { return row.some(Boolean); })) throw new Error(CP_EDUCA_FORMAT_ERROR);
  const rawSubject = descriptors[0].subject.replace(/\s+/g, ' ');
  const centerVariant = /\s*\(Centro\)$/i.test(rawSubject);
  const subject = centerVariant ? rawSubject.replace(/\s*\(Centro\)$/i, '').trim() : rawSubject;
  if (!subject) throw new Error(CP_EDUCA_FORMAT_ERROR);
  const students = [];
  const seen = {};
  textRows.slice(Math.max(headerIndex, descriptorIndex) + 1).forEach(function(row) {
    if (!row.some(Boolean)) return;
    const firstLine = String(row[nameColumn] || '').split(/\r?\n/)[0].trim();
    const group = String(row[groupColumn] || '').trim();
    const number = String(row[numberColumn] || '').trim();
    if (!firstLine && !group && !number) return;
    const comma = firstLine.indexOf(',');
    if (comma <= 0 || !firstLine.slice(comma + 1).trim() || !group) {
      throw new Error(CP_EDUCA_FORMAT_ERROR);
    }
    const student = { surname: firstLine.slice(0, comma).trim(),
      name: firstLine.slice(comma + 1).trim(), group: group };
    const key = studentImportKey_(student);
    if (seen[key]) throw new Error(CP_EDUCA_FORMAT_ERROR);
    seen[key] = true;
    students.push(student);
  });
  return { subject: subject, centerVariant: centerVariant, students: students };
}

function parseEducaReport_(blob) {
  const sheets = parseEducaWorkbook_(readEducaPackage_(blob));
  const blocks = {};
  sheets.forEach(function(rows) {
    const parsed = parseEducaReportSheet_(rows);
    parsed.students.forEach(function(student) {
      const key = normalizeEnrollmentKey_(parsed.subject) + '\n' + normalizeEnrollmentKey_(student.group);
      if (!blocks[key]) blocks[key] = { key: key, subject: parsed.subject,
        group: student.group, variants: {}, students: {} };
      blocks[key].variants[parsed.centerVariant ? 'CENTRO' : 'NORMAL'] = true;
      blocks[key].students[studentImportKey_(student)] = student;
    });
  });
  const result = Object.keys(blocks).map(function(key) {
    const block = blocks[key];
    return { key: key, subject: block.subject, group: block.group,
      variants: Object.keys(block.variants).length,
      students: Object.keys(block.students).map(function(id) { return block.students[id]; }) };
  });
  if (!result.length) throw new Error(CP_EDUCA_FORMAT_ERROR);
  return result;
}

function getEducaEnrollmentSyncStudents_(students, enrollments, activity, sourceGroup) {
  const related = {};
  enrollments.forEach(function(row) {
    if (row.activityId === activity.id) related[row.studentId] = true;
  });
  const sourceHint = normalizeEnrollmentGroupHint_(sourceGroup);
  const moduleHint = normalizeEnrollmentGroupHint_(activity.group);
  return students.filter(function(student) {
    const groupHint = normalizeEnrollmentGroupHint_(student.group);
    return groupHint === sourceHint || groupHint === moduleHint || related[student.id];
  });
}

function buildEducaImportPlan_(blocks, mappingInput, modules, students, enrollments, modes) {
  const mapping = mappingInput || {};
  const moduleChoices = modules.filter(function(item) { return item.category === 'MODULO'; });
  const moduleById = moduleChoices.reduce(function(map, item) { map[item.id] = item; return map; }, {});
  const existingByKey = {};
  students.forEach(function(student) {
    const key = studentImportIdentityKey_(student);
    if (existingByKey[key]) {
      throw new Error('Hay dos alumnos con el mismo nombre, apellidos y grupo. Revisa Alumnado antes de importar.');
    }
    existingByKey[key] = student;
  });
  const detected = {};
  const selected = [];
  const usedDestinations = {};
  const previewBlocks = blocks.map(function(block) {
    block.students.forEach(function(student) { detected[studentImportIdentityKey_(student)] = true; });
    const candidates = moduleChoices.slice().sort(function(left, right) {
      const leftPriority = normalizeEnrollmentGroupHint_(left.group) === normalizeEnrollmentGroupHint_(block.group) ? 0 : 1;
      const rightPriority = normalizeEnrollmentGroupHint_(right.group) === normalizeEnrollmentGroupHint_(block.group) ? 0 : 1;
      return leftPriority - rightPriority ||
        normalizeEnrollmentKey_(left.group).localeCompare(normalizeEnrollmentKey_(right.group), 'es') ||
        normalizeEnrollmentKey_(left.acronym).localeCompare(normalizeEnrollmentKey_(right.acronym), 'es') ||
        normalizeEnrollmentKey_(left.name).localeCompare(normalizeEnrollmentKey_(right.name), 'es');
    });
    const sameName = candidates.filter(function(activity) {
      return normalizeEnrollmentKey_(activity.name) === normalizeEnrollmentKey_(block.subject);
    });
    const exact = sameName.filter(function(activity) {
      return normalizeEnrollmentKey_(activity.group) === normalizeEnrollmentKey_(block.group);
    });
    const equivalent = sameName.filter(function(activity) {
      return normalizeEnrollmentGroupHint_(activity.group) === normalizeEnrollmentGroupHint_(block.group);
    });
    const activityId = Object.prototype.hasOwnProperty.call(mapping, block.key)
      ? String(mapping[block.key] || '') : exact.length === 1 ? exact[0].id :
        equivalent.length === 1 ? equivalent[0].id : '';
    if (activityId) {
      const activity = moduleById[activityId];
      if (!activity) {
        throw new Error('Un destino no es un módulo configurado. Corrige el mapeo.');
      }
      if (usedDestinations[activityId]) {
        throw new Error('Dos asignaturas de EDUCA no pueden tener el mismo módulo de destino.');
      }
      usedDestinations[activityId] = true;
      selected.push({ block: block, activity: activity });
    }
    return { key: block.key, subject: block.subject, group: block.group,
      count: block.students.length, variants: block.variants, activityId: activityId,
      groupWillUpdate: Boolean(activityId) && moduleById[activityId].group !== block.group,
      groupMismatch: Boolean(activityId) &&
        normalizeEnrollmentGroupHint_(moduleById[activityId].group) !== normalizeEnrollmentGroupHint_(block.group),
      selectedGroup: activityId ? moduleById[activityId].group : '',
      candidates: candidates.map(function(item) { return { id: item.id,
        name: item.name, acronym: item.acronym, group: item.group }; }) };
  });
  Object.keys(mapping).forEach(function(key) {
    if (!blocks.some(function(block) { return block.key === key; })) {
      throw new Error('El mapeo contiene una asignatura desconocida.');
    }
  });
  const selectedStudents = {};
  selected.forEach(function(item) {
    item.block.students.forEach(function(student) {
      const key = studentImportIdentityKey_(student);
      if (selectedStudents[key] && selectedStudents[key].group !== student.group) {
        throw new Error('Un alumno aparece con grupos distintos en las asignaturas seleccionadas. Revisa el informe de EDUCA.');
      }
      if (!selectedStudents[key]) selectedStudents[key] = student;
    });
  });
  const newStudents = Object.keys(selectedStudents).filter(function(key) { return !existingByKey[key]; })
    .map(function(key) { return selectedStudents[key]; });
  const previous = {};
  enrollments.forEach(function(row) { previous[row.studentId + '\n' + row.activityId] = row; });
  let activations = 0, deactivations = 0;
  selected.forEach(function(item) {
    const imported = {};
    item.block.students.forEach(function(student) { imported[studentImportIdentityKey_(student)] = true; });
    getEducaEnrollmentSyncStudents_(students.concat(newStudents), enrollments,
      item.activity, item.block.group).forEach(function(student) {
      const key = studentImportIdentityKey_(student);
      const now = Boolean(imported[key]);
      const prior = previous[student.id + '\n' + item.activity.id];
      if (prior && prior.origin === 'MANUAL') return;
      const wasRecorded = modes[item.activity.id] && Boolean(prior && prior.active);
      const wasEffective = modes[item.activity.id] ? wasRecorded :
        Boolean(existingByKey[key]) &&
        normalizeEnrollmentKey_(student.group) === normalizeEnrollmentKey_(item.activity.group);
      if (now && !wasRecorded) activations += 1;
      if (!now && wasEffective) deactivations += 1;
    });
  });
  return { blocks: previewBlocks, selected: selected, newStudents: newStudents,
    summary: { subjects: blocks.length, modules: selected.length,
      detectedStudents: Object.keys(detected).length, newStudents: newStudents.length,
      existingStudents: Object.keys(selectedStudents).length - newStudents.length,
      activations: activations, deactivations: deactivations,
      groupUpdates: previewBlocks.filter(function(block) { return block.groupWillUpdate; }).length,
      manualDifferentGroups: previewBlocks.filter(function(block) { return block.groupMismatch; }).length,
      skipped: blocks.length - selected.length } };
}

function readEducaImportInput_(form) {
  if (!form || !form.archivo) throw new Error('Selecciona el archivo Excel de EDUCA.');
  const blocks = parseEducaReport_(form.archivo);
  let mapping = {};
  if (form.mapping) {
    try { mapping = JSON.parse(form.mapping); }
    catch (error) { throw new Error('El mapeo de asignaturas no es válido.'); }
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
      throw new Error('El mapeo de asignaturas no es válido.');
    }
  }
  return { blocks: blocks, mapping: mapping };
}

function analizarArchivoEduca(form) {
  const modules = getModuleActivitiesForEnrollment_();
  if (!modules.length) {
    throw new Error('Primero configura tus módulos en Configuración → Horario → Actividades.');
  }
  const parsed = readEducaImportInput_(form);
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const plan = buildEducaImportPlan_(parsed.blocks, parsed.mapping, modules,
    getEnrollmentStudents_(book), readEnrollmentRows_(book), readEnrollmentModes_(book));
  return { blocks: plan.blocks, summary: plan.summary,
    emailNotice: CP_EDUCA_EMAIL_NOTICE };
}

function writeEducaNewStudents_(book, newStudents) {
  const sheet = book.getSheetByName(CP.SHEETS.STUDENTS);
  if (!sheet) throw new Error('Falta 3 Alumnado. Usa «Reparar estructura».');
  const existingCount = Math.max(0, sheet.getLastRow() - 1);
  const values = existingCount ? sheet.getRange(2, 1, existingCount, 7).getValues() : [];
  let cursor = 0;
  const writes = [];
  newStudents.forEach(function(student) {
    while (cursor < values.length && values[cursor].slice(0, 3).some(function(value) { return String(value).trim(); })) cursor += 1;
    const rowNumber = cursor + 2;
    const row = [student.surname, student.name, student.group, '', false, '', Utilities.getUuid()];
    writes.push({ rowNumber: rowNumber, values: row });
    values[cursor] = row;
    cursor += 1;
  });
  if (writes.length) {
    ensureSheetSize_(sheet, writes[writes.length - 1].rowNumber, 7);
    groupConsecutiveRows_(writes.map(function(item) { return item.rowNumber; }))
      .forEach(function(run) {
        sheet.getRange(run.start, 1, run.count, 7).setValues(writes.filter(function(item) {
          return item.rowNumber >= run.start && item.rowNumber < run.start + run.count;
        }).map(function(item) { return item.values; }));
      });
    createOrRepairStudentsSheet_();
  }
}

function syncEducaExistingStudentGroups_(book, plan) {
  const sheet = book.getSheetByName(CP.SHEETS.STUDENTS);
  const expected = {};
  plan.selected.forEach(function(item) {
    item.block.students.forEach(function(student) {
      expected[studentImportIdentityKey_(student)] = student.group;
    });
  });
  const students = getEnrollmentStudents_(book);
  const changes = students.filter(function(student) {
    return expected[studentImportIdentityKey_(student)] &&
      student.group !== expected[studentImportIdentityKey_(student)];
  });
  if (!changes.length) return;
  const values = sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getValues();
  changes.forEach(function(student) {
    values[student.rowNumber - 2][0] = expected[studentImportIdentityKey_(student)];
  });
  sheet.getRange(2, 3, values.length, 1).setValues(values);
}

function prepareEducaModuleGroupChanges_(book, plan) {
  const sheet = book.getSheetByName(CP.SHEETS.SCHEDULE_ACTIVITIES);
  const count = Math.max(0, sheet.getLastRow() - 1);
  const values = count ? sheet.getRange(2, 1, count, CP_SCHEDULE_HEADERS.ACTIVITIES.length).getValues() : [];
  const rowById = {};
  values.forEach(function(row, index) { rowById[String(row[0])] = index; });
  const registry = readModuleConfigRegistry_(book);
  const renames = [];
  const nextGroups = values.map(function(row) { return [row[5]]; });
  plan.selected.forEach(function(item) {
    const index = rowById[item.activity.id];
    if (index === undefined || normalizeScheduleActivityCategory_(values[index][1]) !== 'MODULO') {
      throw new Error('Un módulo de destino ha cambiado. Analiza de nuevo el archivo.');
    }
    if (String(values[index][5]) === item.block.group) return;
    nextGroups[index][0] = item.block.group;
    const record = registry.find(function(row) { return row.activityId === item.activity.id; });
    if (!record) return;
    const nextActivity = Object.assign({}, item.activity, { group: item.block.group });
    [[record.sheetId, '4 Config'], [record.trackingSheetId, '5 Seg'],
      [record.evaluationSheetId, '6 Eval']].forEach(function(entry) {
      const managed = entry[0] && getSheetById_(book, entry[0]);
      if (!managed) return;
      const name = (entry[1] + ' ' + getModuleDisplayName_(nextActivity))
        .replace(/[\\\/\?\*\[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100).trim();
      if (managed.getName() === name) return;
      const occupied = book.getSheetByName(name);
      if (occupied && occupied.getSheetId() !== managed.getSheetId()) {
        throw new Error('Ya existe una hoja llamada «' + name + '». Cambia ese nombre antes de importar.');
      }
      renames.push({ sheet: managed, oldName: managed.getName(), name: name });
    });
  });
  const proposedNames = {};
  renames.forEach(function(item) {
    if (proposedNames[item.name] && proposedNames[item.name] !== item.sheet.getSheetId()) {
      throw new Error('Dos hojas gestionadas tendrían el mismo nombre tras importar. Revisa los módulos de destino.');
    }
    proposedNames[item.name] = item.sheet.getSheetId();
  });
  return { sheet: sheet, originalGroups: values.map(function(row) { return [row[5]]; }),
    nextGroups: nextGroups, renames: renames };
}

function applyEducaModuleGroupChanges_(change) {
  if (!change.nextGroups.some(function(row, index) {
    return row[0] !== change.originalGroups[index][0];
  })) return;
  change.sheet.getRange(2, 6, change.nextGroups.length, 1).setValues(change.nextGroups);
  change.renames.forEach(function(item) { item.sheet.setName(item.name); });
}

function importarAlumnadoEduca(form) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('Hay otra importación en curso. Inténtalo de nuevo.');
  try {
    const modules = getModuleActivitiesForEnrollment_();
    if (!modules.length) throw new Error('Primero configura tus módulos en Configuración → Horario → Actividades.');
    const parsed = readEducaImportInput_(form);
    const book = SpreadsheetApp.getActiveSpreadsheet();
    let plan = buildEducaImportPlan_(parsed.blocks, parsed.mapping, modules,
      getEnrollmentStudents_(book), readEnrollmentRows_(book), readEnrollmentModes_(book));
    if (!plan.selected.length) throw new Error('Selecciona al menos un módulo de destino.');
    if (plan.summary.deactivations && form.confirmDrops !== 'true') {
      throw new Error('Confirma primero las bajas de matrícula indicadas en el resumen.');
    }
    if (form.confirmDrops === 'true' &&
        Number(form.expectedDrops) !== plan.summary.deactivations) {
      throw new Error('Las bajas de matrícula han cambiado. Analiza de nuevo el archivo antes de importar.');
    }
    const groupChanges = prepareEducaModuleGroupChanges_(book, plan);
    const studentSheet = book.getSheetByName(CP.SHEETS.STUDENTS);
    const originalStudentRows = studentSheet.getLastRow();
    const studentSnapshot = studentSheet.getRange(1, 1, originalStudentRows, 7).getValues();
    const enrollmentSnapshots = captureNewCourseEnrollmentSnapshots_(book);
    try {
      ensureEnrollmentStructure_();
      ensureStudentIdsForValidRows_(book);
      plan = buildEducaImportPlan_(parsed.blocks, parsed.mapping, modules,
        getEnrollmentStudents_(book), readEnrollmentRows_(book), readEnrollmentModes_(book));
      writeEducaNewStudents_(book, plan.newStudents);
      syncEducaExistingStudentGroups_(book, plan);
      applyEducaModuleGroupChanges_(groupChanges);
      syncStudentGroupValidation_(book);
      const students = getEnrollmentStudents_(book);
      const selectedIds = plan.selected.map(function(item) { return item.activity.id; });
      const previousEnrollments = readEnrollmentRows_(book);
      const priorByPair = previousEnrollments.reduce(function(map, row) {
        map[row.studentId + '\n' + row.activityId] = row;
        return map;
      }, {});
      const existing = previousEnrollments.filter(function(row) {
        return selectedIds.indexOf(row.activityId) === -1 || row.origin === 'MANUAL';
      });
      const rows = existing.slice();
      plan.selected.forEach(function(item) {
        const imported = {};
        item.block.students.forEach(function(student) { imported[studentImportIdentityKey_(student)] = true; });
        getEducaEnrollmentSyncStudents_(students, previousEnrollments,
          item.activity, item.block.group).forEach(function(student) {
          if (priorByPair[student.id + '\n' + item.activity.id] &&
              priorByPair[student.id + '\n' + item.activity.id].origin === 'MANUAL') return;
          rows.push({ studentId: student.id, activityId: item.activity.id,
            active: Boolean(imported[studentImportIdentityKey_(student)]), origin: 'EDUCA_XLS' });
        });
      });
      const modes = readEnrollmentModes_(book);
      selectedIds.forEach(function(id) { modes[id] = true; });
      writeEnrollmentState_(book, rows, modes);
      repairEvaluationsForActivities_(selectedIds);
      if (groupChanges.renames.length || plan.summary.groupUpdates) {
        if (book.getSheetByName(CP.SHEETS.SCHEDULE)) createOrRepairScheduleSheet_();
        else actualizarIndicePortada();
      }
    } catch (error) {
      const count = Math.max(originalStudentRows, studentSheet.getLastRow());
      studentSheet.getRange(1, 1, count, 7).clearContent();
      studentSheet.getRange(1, 1, studentSnapshot.length, 7).setValues(studentSnapshot);
      restoreNewCourseEnrollmentSnapshots_(book, enrollmentSnapshots);
      groupChanges.renames.slice().reverse().forEach(function(item) {
        if (item.sheet.getName() !== item.oldName) item.sheet.setName(item.oldName);
      });
      if (groupChanges.originalGroups.length) {
        groupChanges.sheet.getRange(2, 6, groupChanges.originalGroups.length, 1)
          .setValues(groupChanges.originalGroups);
      }
      createOrRepairStudentsSheet_();
      try { repairEvaluationsForActivities_(plan.selected.map(function(item) { return item.activity.id; })); }
      catch (repairError) { console.warn('No se pudo restaurar la vista de Eval tras fallar la importación.'); }
      if (groupChanges.renames.length || plan.summary.groupUpdates) {
        try {
          if (book.getSheetByName(CP.SHEETS.SCHEDULE)) createOrRepairScheduleSheet_();
          else actualizarIndicePortada();
        } catch (renderError) {
          console.warn('No se pudo restaurar el Horario tras fallar la importación.');
        }
      }
      throw error;
    }
    return { summary: plan.summary, emailNotice: CP_EDUCA_EMAIL_NOTICE };
  } finally { lock.releaseLock(); }
}
