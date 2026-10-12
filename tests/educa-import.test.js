const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function xmlElement(name, attributes) {
  return { name: name.split(':').pop(), attributes, children: [], text: '',
    getName() { return this.name; }, getChildren() { return this.children; },
    getText() { return this.text; },
    getAttributes() { return Object.entries(this.attributes).map(([key, value]) => ({
      getName: () => key.split(':').pop(), getValue: () => value,
    })); } };
}
function parseXml(source) {
  const root = xmlElement('root', {}), stack = [root];
  for (const token of source.match(/<[^>]+>|[^<]+/g) || []) {
    if (token.startsWith('<?') || token.startsWith('<!')) continue;
    if (token.startsWith('</')) { stack.pop(); continue; }
    if (token.startsWith('<')) {
      const name = /^<([^\s/>]+)/.exec(token)[1], attributes = {};
      for (const match of token.matchAll(/([\w:.-]+)="([^"]*)"/g)) attributes[match[1]] = match[2];
      const element = xmlElement(name, attributes);
      stack.at(-1).children.push(element);
      if (!token.endsWith('/>')) stack.push(element);
    } else stack.at(-1).text += token.replace(/&amp;/g, '&');
  }
  return { getRootElement: () => root.children[0] };
}
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const archiveParts = new Map();
let zipBlobCreations = 0;
const context = vm.createContext({ CP: { SHEETS: { STUDENTS: '3 Alumnado' } },
  XmlService: { parse: parseXml },
  Utilities: {
    newBlob: (bytes, contentType, name) => {
      assert.equal(contentType, 'application/zip');
      assert.equal(name, 'educa-import.zip');
      const key = Buffer.from(bytes.map(value => value & 255)).toString('base64');
      zipBlobCreations++;
      return { getContentType: () => contentType, parts: archiveParts.get(key) };
    },
    unzip: blob => {
      assert.equal(blob.getContentType(), 'application/zip');
      if (!blob.parts) throw new Error('ZIP sintético no registrado');
      return blob.parts;
    },
  },
  LockService: { getDocumentLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({}) },
});
vm.runInContext(fs.readFileSync('EducaImport.gs', 'utf8'), context);
vm.runInContext(fs.readFileSync('Matriculas.gs', 'utf8'), context);

function zip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, body] of Object.entries(entries)) {
    const data = Buffer.from(body), label = Buffer.from(name);
    const checksum = crc32(data);
    const local = Buffer.alloc(30 + label.length + data.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt16LE(label.length, 26); label.copy(local, 30); data.copy(local, 30 + label.length);
    const central = Buffer.alloc(46 + label.length);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6); central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 24); central.writeUInt16LE(label.length, 28);
    central.writeUInt32LE(offset, 42); label.copy(central, 46);
    locals.push(local); centrals.push(central); offset += local.length;
  }
  const directory = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(centrals.length, 8);
  end.writeUInt16LE(centrals.length, 10); end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
function blob(name, contents) {
  const data = Buffer.from(contents);
  return { getName: () => name, getBytes: () => [...data],
    getDataAsString: () => data.toString('utf8') };
}
function fixture(sheetSpecs) {
  const strings = [];
  const shared = value => { strings.push(value); return strings.length - 1; };
  const cell = (column, row, value) => `<c r="${column}${row}" t="s"><v>${shared(value)}</v></c>`;
  const files = { '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
    'xl/workbook.xml': `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetSpecs.map((_, index) =>
      `<sheet name="Hoja${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetSpecs.map((_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}</Relationships>`,
  };
  sheetSpecs.forEach((spec, index) => {
    const headerRow = spec.headerRow || 5;
    const titleRow = spec.titleRow || 1;
    const descriptorRow = spec.descriptorAfterHeader ? headerRow + 1 : titleRow + 1;
    const studentStart = Math.max(headerRow, descriptorRow) + 1;
    const columns = spec.sparseColumns ? ['B', 'E', 'F', 'G', 'H'] : ['A', 'B', 'C', 'D', 'E'];
    const headers = spec.headers || ['Nº', 'Nombre', 'Curso', 'Estado', 'Grupo'];
    const rows = [
      { number: titleRow, xml: `<row r="${titleRow}">${cell(spec.sparseColumns ? 'C' : 'A', titleRow, spec.title || 'Alumnos por profesor y asignatura')}</row>` },
      { number: descriptorRow, xml: `<row r="${descriptorRow}">${cell(columns[0], descriptorRow, spec.descriptor || `Docente Ficticio ; ${spec.subject}-AG (Curso ficticio)`)}</row>` },
      { number: headerRow, xml: `<row r="${headerRow}">${headers.map((value, col) => cell(columns[col], headerRow, value)).join('')}</row>` },
      ...spec.names.map((name, rowIndex) => {
        const row = studentStart + rowIndex;
        return { number: row, xml: `<row r="${row}">${cell(columns[0], row, String(rowIndex + 1))}${cell(columns[1], row, name)}${cell(columns[2], row, '2º')}${cell(columns[3], row, 'Activo')}${cell(columns[4], row, spec.group === undefined ? 'DAM 2A' : spec.group)}</row>` };
      }),
    ].sort((a, b) => a.number - b.number);
    files[`xl/worksheets/sheet${index + 1}.xml`] = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map(row => row.xml).join('')}</sheetData></worksheet>`;
  });
  files['xl/sharedStrings.xml'] = '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + strings.map(value => {
    const segments = value.split('\n');
    return segments.length > 1
      ? '<si>' + segments.map((part, index) => `<r><t>${part}${index ? '' : '\n'}</t></r>`).join('') + '</si>'
      : `<si><t>${value}</t></si>`;
  }).join('') + '</sst>';
  const packed = zip(files);
  archiveParts.set(packed.toString('base64'), Object.entries(files).map(([name, value]) => blob(name, value)));
  return { name: 'rptALMPorProfesorAsignatura.xls',
    getContentType: () => 'application/vnd.ms-excel', getBytes: () => [...packed] };
}

const report = fixture([
  { subject: 'Acceso a datos', headerRow: 5,
    names: ['Apellido Uno, Ana\nConv. Ini.: 1', 'Apellido Dos, Pedro'] },
  { subject: 'Acceso a datos (Centro)', headerRow: 6,
    names: ['Apellido Uno, Ana', 'Apellido Dos, Pedro', 'Apellido Tres, Javi'] },
  { subject: 'Acceso a datos', headerRow: 5, group: 'DAM 2B', names: ['Apellido Uno, Ana'] },
]);
assert.equal(report.name.endsWith('.xls'), true);
assert.equal(report.getContentType(), 'application/vnd.ms-excel');
const parsed = context.parseEducaReport_(report);
assert.ok(zipBlobCreations > 0);
assert.equal(parsed.length, 2);
const groupA = parsed.find(block => block.group === 'DAM 2A');
assert.equal(groupA.subject, 'Acceso a datos');
assert.equal(groupA.students.length, 3);
assert.equal(groupA.variants, 2);
assert.equal(groupA.students.find(student => student.name === 'Ana').surname, 'Apellido Uno');
assert.equal(parsed.find(block => block.group === 'DAM 2B').students.length, 1);
const realOrder = fixture([{ subject: 'Programación multimedia y dispositivos móviles',
  titleRow: 3, headerRow: 5, descriptorAfterHeader: true, sparseColumns: true,
  descriptor: 'Profesor Ejemplo, Docente ; Programación multimedia y dispositivos móviles-AG\n(2º Grado Superior ficticio)',
  names: ['Apellido Uno, Ana\nConv. Ini.: 1', 'Apellido Dos, Luis\nConv. Ini.: 1'] }]);
const realOrderBlock = context.parseEducaReport_(realOrder)[0];
assert.equal(realOrderBlock.subject, 'Programación multimedia y dispositivos móviles');
assert.deepEqual(Array.from(realOrderBlock.students.map(student => student.name)), ['Ana', 'Luis']);
assert.equal(realOrderBlock.students.length, 2);
const realCenter = context.parseEducaReport_(fixture([
  { subject: 'Acceso a datos', titleRow: 3, headerRow: 5,
    descriptorAfterHeader: true, sparseColumns: true,
    names: ['Apellido Uno, Ana', 'Apellido Dos, Pedro'] },
  { subject: 'Acceso a datos (Centro)', titleRow: 3, headerRow: 6,
    descriptorAfterHeader: true, sparseColumns: true,
    names: ['Apellido Uno, Ana', 'Apellido Dos, Pedro', 'Apellido Tres, Javi'] },
]));
assert.equal(realCenter.length, 1);
assert.equal(realCenter[0].students.length, 3);
assert.equal(realCenter[0].variants, 2);
assert.throws(() => context.parseEducaReportSheet_([
  ['Alumnos por profesor y asignatura'],
  ['Profesor Ejemplo ; Acceso a datos-AG (Curso ficticio)'],
  ['Profesor Ejemplo ; Otro módulo-AG (Curso ficticio)'],
  ['Nº', 'Nombre', 'Curso', 'Estado', 'Grupo'],
  ['1', 'Apellido Uno, Ana', '2º', '', 'DAM 2A'],
]), /formato/);
assert.throws(() => context.parseEducaReportSheet_([
  ['Alumnos por profesor y asignatura'],
  ['Nº', 'Nombre', 'Curso', 'Estado', 'Grupo'],
  ['Profesor Ejemplo ; Acceso a datos-AG (Curso ficticio)'],
  ['1', '', '2º', '', 'DAM 2A'],
]), /formato/);
const inline = context.readEducaWorksheetRows_(blob('sheet.xml',
  '<worksheet><sheetData><row r="7"><c r="B7" t="inlineStr"><is><r><t>Apellido, </t></r><r><t>Ana</t></r></is></c></row></sheetData></worksheet>'), []);
assert.equal(inline[0][1], 'Apellido, Ana');
assert.equal(context.parseEducaReport_(fixture([{ subject: 'Módulo (avanzado) (Centro)',
  names: ['Apellido Uno, Ana'] }]))[0].subject, 'Módulo (avanzado)');

const invalid = [
  { getBytes: () => [...Buffer.from('No es un Excel')], parts: [] },
  { getBytes: () => [...Buffer.from('D0CF11E0A1B11AE1', 'hex')], parts: [] },
  { getBytes: () => [...zip({ 'otro.txt': 'texto' })], parts: [blob('otro.txt', 'texto')] },
  fixture([{ subject: 'Módulo', title: 'Otro informe', names: ['Apellido, Ana'] }]),
  fixture([{ subject: 'Módulo', headers: ['Nº', 'Nombre', 'Curso', 'Estado', 'Otro'], names: ['Apellido, Ana'] }]),
  fixture([{ subject: 'Módulo', headers: ['Nº', 'Otro', 'Curso', 'Estado', 'Grupo'], names: ['Apellido, Ana'] }]),
  fixture([{ subject: 'Módulo', descriptor: 'Sin descriptor', names: ['Apellido, Ana'] }]),
  fixture([{ subject: 'Módulo', names: ['Nombre sin coma'] }]),
  fixture([{ subject: 'Módulo', group: '', names: ['Apellido, Ana'] }]),
];
invalid.forEach(file => assert.throws(() => context.parseEducaReport_(file), /formato/));
const conversionsBeforeBiff = zipBlobCreations;
assert.throws(() => context.parseEducaReport_(invalid[1]), /No se reconoce el formato actual/);
assert.equal(zipBlobCreations, conversionsBeforeBiff);
let writes = 0;
const writeEducaNewStudents = context.writeEducaNewStudents_;
context.getModuleActivitiesForEnrollment_ = () => [{ id: 'M1', category: 'MODULO', group: 'DAM 2A', name: 'Módulo' }];
context.getEnrollmentStudents_ = () => [];
context.readEnrollmentRows_ = () => [];
context.readEnrollmentModes_ = () => ({});
context.ensureEnrollmentStructure_ = () => { writes++; };
context.writeEnrollmentState_ = () => { writes++; };
context.writeEducaNewStudents_ = () => { writes++; };
context.repairEvaluationsForActivities_ = () => { writes++; };
const analysis = context.analizarArchivoEduca({ archivo: fixture([{ subject: 'Módulo', names: ['Apellido, Ana'] }]) });
assert.equal(analysis.summary.newStudents, 1);
assert.equal(analysis.blocks[0].activityId, 'M1');
assert.equal(context.analizarArchivoEduca({ archivo: realOrder }).summary.detectedStudents, 2);
assert.equal(writes, 0);
invalid.forEach(file => assert.throws(() => context.importarAlumnadoEduca({ archivo: file }), /formato/));
assert.equal(writes, 0);
context.writeEducaNewStudents_ = writeEducaNewStudents;
const studentWrites = [];
const existingRow = ['Apellido Uno', 'Ana', 'DAM 2A', 'ana@example.invalid', true, 'Adaptación', 'ID-A'];
const studentTable = { getLastRow: () => 2, getRange(row) { return {
  getValues: () => [existingRow], setValues: values => studentWrites.push({ row, values }),
}; } };
context.ensureSheetSize_ = () => {};
context.groupConsecutiveRows_ = numbers => numbers.map(start => ({ start, count: 1 }));
context.Utilities.getUuid = () => 'ID-NEW';
context.createOrRepairStudentsSheet_ = () => {};
context.writeEducaNewStudents_({ getSheetByName: () => studentTable },
  [{ surname: 'Apellido Dos', name: 'Pedro', group: 'DAM 2A' }]);
assert.deepEqual(existingRow, ['Apellido Uno', 'Ana', 'DAM 2A',
  'ana@example.invalid', true, 'Adaptación', 'ID-A']);
assert.deepEqual(JSON.parse(JSON.stringify(studentWrites[0])), { row: 3, values: [[
  'Apellido Dos', 'Pedro', 'DAM 2A', '', false, '', 'ID-NEW',
]] });
const existing = { id: 'ID-A', surname: 'Apellido Uno', name: 'Ana', group: 'DAM 2A',
  email: 'ana@example.invalid', reaca: true, measures: 'Adaptación' };
let studentState = [existing], enrollmentState = [], modeState = {}, repaired = [];
const studentSheet = { getLastRow: () => 1, getRange: () => ({ getValues: () => [Array(7).fill('')] }) };
context.SpreadsheetApp.getActiveSpreadsheet = () => ({ getSheetByName: () => studentSheet });
context.getEnrollmentStudents_ = () => studentState;
context.readEnrollmentRows_ = () => enrollmentState;
context.readEnrollmentModes_ = () => modeState;
context.captureNewCourseEnrollmentSnapshots_ = () => [];
context.ensureStudentIdsForValidRows_ = () => {};
context.writeEducaNewStudents_ = (_book, newcomers) => newcomers.forEach((student, index) => {
  studentState.push({ ...student, id: 'NEW-' + index, email: '', reaca: false, measures: '' });
});
context.writeEnrollmentState_ = (_book, rows, modes) => {
  enrollmentState = rows; modeState = modes;
};
context.repairEvaluationsForActivities_ = ids => { repaired = ids; };
context.prepareEducaModuleGroupChanges_ = (_book, plan) => ({ originalGroups: [],
  nextGroups: [], renames: [], selected: plan.selected });
context.applyEducaModuleGroupChanges_ = change => change.selected.forEach(item => {
  item.activity.group = item.block.group;
});
context.syncEducaExistingStudentGroups_ = (_book, plan) => {
  const expected = new Map();
  plan.selected.forEach(item => item.block.students.forEach(student =>
    expected.set(context.studentImportIdentityKey_(student), student.group)));
  studentState.forEach(student => {
    const group = expected.get(context.studentImportIdentityKey_(student));
    if (group) student.group = group;
  });
};
let groupValidationSyncs = 0;
context.syncStudentGroupValidation_ = () => { groupValidationSyncs++; };
context.createOrRepairScheduleSheet_ = () => {};
const firstReport = fixture([{ subject: 'Módulo',
  names: ['Apellido Uno, Ana', 'Apellido Dos, Pedro'] }]);
const firstResult = context.importarAlumnadoEduca({ archivo: firstReport,
  mapping: '{}', confirmDrops: 'false' });
assert.equal(firstResult.summary.newStudents, 1);
assert.equal(firstResult.summary.existingStudents, 1);
assert.equal(firstResult.summary.activations, 2);
assert.equal(existing.email, 'ana@example.invalid');
assert.equal(existing.reaca, true);
assert.equal(existing.measures, 'Adaptación');
assert.equal(studentState.length, 2);
assert.equal(studentState[1].email, '');
assert.equal(enrollmentState.filter(item => item.active).length, 2);
assert.equal(modeState.M1, true);
assert.deepEqual(Array.from(repaired), ['M1']);
const secondReport = fixture([{ subject: 'Módulo', names: ['Apellido Uno, Ana'] }]);
assert.throws(() => context.importarAlumnadoEduca({ archivo: secondReport,
  mapping: '{}', confirmDrops: 'false' }), /Confirma primero/);
const secondResult = context.importarAlumnadoEduca({ archivo: secondReport,
  mapping: '{}', confirmDrops: 'true', expectedDrops: '1' });
assert.equal(secondResult.summary.deactivations, 1);
assert.equal(studentState.length, 2);
assert.equal(enrollmentState.find(item => item.studentId === 'NEW-0').active, false);
enrollmentState.find(item => item.studentId === 'NEW-0').origin = 'MANUAL';
context.importarAlumnadoEduca({ archivo: firstReport, mapping: '{}', confirmDrops: 'false' });
assert.deepEqual(JSON.parse(JSON.stringify(enrollmentState.find(item => item.studentId === 'NEW-0'))),
  { studentId: 'NEW-0', activityId: 'M1', active: false, origin: 'MANUAL' });
assert.equal(enrollmentState.find(item => item.studentId === 'ID-A').origin, 'EDUCA_XLS');
enrollmentState.find(item => item.studentId === 'NEW-0').active = true;
context.importarAlumnadoEduca({ archivo: secondReport, mapping: '{}', confirmDrops: 'false' });
assert.deepEqual(JSON.parse(JSON.stringify(enrollmentState.find(item => item.studentId === 'NEW-0'))),
  { studentId: 'NEW-0', activityId: 'M1', active: true, origin: 'MANUAL' });
const virtualModule = { id: 'ASIR', category: 'MODULO', group: 'ASIR Online',
  name: 'Gestión de bases de datos', acronym: 'GBD' };
context.getModuleActivitiesForEnrollment_ = () => [virtualModule];
studentState = [];
enrollmentState = [];
modeState = {};
const virtualReport = fixture([{ subject: 'Gestión de bases de datos',
  group: 'ASIR - VIRTUAL', names: ['Apellido Cuatro, Vera'] }]);
const virtualResult = context.importarAlumnadoEduca({ archivo: virtualReport,
  mapping: '{}', confirmDrops: 'false' });
assert.equal(virtualResult.summary.modules, 1);
assert.equal(studentState[0].group, 'ASIR - VIRTUAL');
assert.equal(enrollmentState[0].activityId, 'ASIR');
assert.equal(enrollmentState[0].active, true);
assert.equal(modeState.ASIR, true);
assert.equal(virtualModule.group, 'ASIR - VIRTUAL');
assert(groupValidationSyncs > 0);
studentState = [{ id: 'EXISTING', surname: 'Apellido Cuatro', name: 'Vera',
  group: 'ASIR Online', email: 'existing@example.invalid', reaca: true, measures: 'Medida previa' }];
enrollmentState = [];
modeState = {};
const existingVirtualResult = context.importarAlumnadoEduca({ archivo: virtualReport,
  mapping: '{}', confirmDrops: 'false' });
assert.equal(existingVirtualResult.summary.newStudents, 0);
assert.equal(studentState.length, 1);
assert.equal(studentState[0].group, 'ASIR - VIRTUAL');
assert.equal(studentState[0].email, 'existing@example.invalid');
assert.equal(studentState[0].reaca, true);
assert.equal(studentState[0].measures, 'Medida previa');
assert.equal(enrollmentState[0].studentId, 'EXISTING');
const distinctModule = { id: 'SMR', category: 'MODULO', group: 'SMR 1A',
  name: 'Otro módulo', acronym: 'OM' };
context.getModuleActivitiesForEnrollment_ = () => [distinctModule];
studentState = [];
enrollmentState = [];
modeState = {};
const sourceKey = context.parseEducaReport_(virtualReport)[0].key;
const distinctResult = context.importarAlumnadoEduca({ archivo: virtualReport,
  mapping: JSON.stringify({ [sourceKey]: 'SMR' }), confirmDrops: 'true', expectedDrops: '0' });
assert.equal(distinctResult.summary.manualDifferentGroups, 1);
assert.equal(studentState[0].group, 'ASIR - VIRTUAL');
assert.equal(enrollmentState[0].activityId, 'SMR');
assert.equal(enrollmentState[0].active, true);
assert.equal(context.getStudentsForModuleActivity_({}, distinctModule)[0].id, studentState[0].id);
const dialog = fs.readFileSync('UiDialogEducaImport.html', 'utf8');
assert.match(dialog, /type="file" accept="\.xls,\.xlsx"/);
assert.match(dialog, /Listado mi alumnado/);
assert.match(dialog, /Por profesor/);
assert.match(dialog, /Mostrar todas las asignaturas/);
assert.match(dialog, /\(Centro\)/);
assert.equal((dialog.match(/El informe de EDUCA no incluye el correo electrónico/g) || []).length, 1);
assert.match(dialog, /google\.script\.run[\s\S]*\[method\]\(form\)/);
assert.doesNotMatch(fs.readFileSync('EducaImport.gs', 'utf8'),
  /DriveApp|CacheService|PropertiesService|Logger\.log/);
console.log('EDUCA OOXML .xls, rich text, variable rows, Centro and invalid files: ok');
