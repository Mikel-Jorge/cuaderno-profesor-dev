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
const context = vm.createContext({ CP: { SHEETS: { STUDENTS: '3 Alumnado' } },
  XmlService: { parse: parseXml },
  Utilities: { unzip: blob => blob.parts },
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
    const headers = spec.headers || ['Nº', 'Nombre', 'Curso', 'Estado', 'Grupo'];
    const rows = [
      `<row r="1">${cell('A', 1, spec.title || 'Alumnos por profesor y asignatura')}</row>`,
      `<row r="2">${cell('A', 2, spec.descriptor || `Docente Ficticio ; ${spec.subject}-AG (Curso ficticio)`)}</row>`,
      `<row r="${headerRow}">${headers.map((value, col) => cell('ABCDE'[col], headerRow, value)).join('')}</row>`,
      ...spec.names.map((name, rowIndex) => {
        const row = headerRow + rowIndex + 1;
        return `<row r="${row}">${cell('A', row, String(rowIndex + 1))}${cell('B', row, name)}${cell('C', row, '2º')}${cell('D', row, 'Activo')}${cell('E', row, spec.group === undefined ? 'DAM 2A' : spec.group)}</row>`;
      }),
    ];
    files[`xl/worksheets/sheet${index + 1}.xml`] = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join('')}</sheetData></worksheet>`;
  });
  files['xl/sharedStrings.xml'] = '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + strings.map(value => {
    const segments = value.split('\n');
    return segments.length > 1
      ? '<si>' + segments.map((part, index) => `<r><t>${part}${index ? '' : '\n'}</t></r>`).join('') + '</si>'
      : `<si><t>${value}</t></si>`;
  }).join('') + '</sst>';
  const packed = zip(files);
  return { name: 'rptALMPorProfesorAsignatura.xls', parts: Object.entries(files).map(([name, value]) => blob(name, value)),
    getBytes: () => [...packed] };
}

const report = fixture([
  { subject: 'Acceso a datos', headerRow: 5,
    names: ['Apellido Uno, Ana\nConv. Ini.: 1', 'Apellido Dos, Pedro'] },
  { subject: 'Acceso a datos (Centro)', headerRow: 6,
    names: ['Apellido Uno, Ana', 'Apellido Dos, Pedro', 'Apellido Tres, Javi'] },
  { subject: 'Acceso a datos', headerRow: 5, group: 'DAM 2B', names: ['Apellido Uno, Ana'] },
]);
assert.equal(report.name.endsWith('.xls'), true);
const parsed = context.parseEducaReport_(report);
assert.equal(parsed.length, 2);
const groupA = parsed.find(block => block.group === 'DAM 2A');
assert.equal(groupA.subject, 'Acceso a datos');
assert.equal(groupA.students.length, 3);
assert.equal(groupA.variants, 2);
assert.equal(groupA.students.find(student => student.name === 'Ana').surname, 'Apellido Uno');
assert.equal(parsed.find(block => block.group === 'DAM 2B').students.length, 1);
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
assert.throws(() => context.parseEducaReport_(invalid[1]), /No se reconoce el formato actual/);
let writes = 0;
context.getModuleActivitiesForEnrollment_ = () => [{ id: 'M1', category: 'MODULO', group: 'DAM 2A', name: 'Módulo' }];
context.getEnrollmentStudents_ = () => [];
context.readEnrollmentRows_ = () => [];
context.readEnrollmentModes_ = () => ({});
context.ensureEnrollmentStructure_ = () => { writes++; };
const analysis = context.analizarArchivoEduca({ archivo: fixture([{ subject: 'Módulo', names: ['Apellido, Ana'] }]) });
assert.equal(analysis.summary.newStudents, 1);
assert.equal(analysis.blocks[0].activityId, 'M1');
assert.equal(writes, 0);
invalid.forEach(file => assert.throws(() => context.importarAlumnadoEduca({ archivo: file }), /formato/));
assert.equal(writes, 0);
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
const dialog = fs.readFileSync('UiDialogEducaImport.html', 'utf8');
assert.match(dialog, /type="file" accept="\.xls,\.xlsx"/);
assert.match(dialog, /Listado mi alumnado/);
assert.match(dialog, /Por profesor/);
assert.match(dialog, /Mostrar todas las asignaturas/);
assert.match(dialog, /\(Centro\)/);
assert.equal((dialog.match(/El informe de EDUCA no incluye el correo electrónico/g) || []).length, 2);
assert.match(dialog, /google\.script\.run[\s\S]*\[method\]\(form\)/);
assert.doesNotMatch(fs.readFileSync('EducaImport.gs', 'utf8'),
  /DriveApp|CacheService|PropertiesService|Logger\.log/);
console.log('EDUCA OOXML .xls, rich text, variable rows, Centro and invalid files: ok');
