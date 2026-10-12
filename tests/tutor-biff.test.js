const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({ Uint8Array });
vm.runInContext(fs.readFileSync('EducaTutorBiff.gs', 'utf8'), context);
function record(id, body) {
  const header = Buffer.alloc(4);
  header.writeUInt16LE(id, 0);
  header.writeUInt16LE(body.length, 2);
  return Buffer.concat([header, body]);
}
function bof(type) {
  const body = Buffer.alloc(16);
  body.writeUInt16LE(0x0600, 0);
  body.writeUInt16LE(type, 2);
  return record(0x0809, body);
}
function stringBody(value, unicode, rich) {
  const chars = Buffer.from(value, unicode ? 'utf16le' : 'latin1');
  const header = Buffer.alloc(rich ? 5 : 3);
  header.writeUInt16LE(value.length, 0);
  header[2] = (unicode ? 1 : 0) | (rich ? 8 : 0);
  if (rich) header.writeUInt16LE(1, 3);
  return Buffer.concat([header, chars, rich ? Buffer.alloc(4) : Buffer.alloc(0)]);
}
function labelSst(row, col, index) {
  const body = Buffer.alloc(10);
  body.writeUInt16LE(row, 0); body.writeUInt16LE(col, 2); body.writeUInt32LE(index, 6);
  return record(0x00fd, body);
}
function directory(name, type, start, size) {
  const part = Buffer.alloc(128);
  Buffer.from(name + '\0', 'utf16le').copy(part);
  part.writeUInt16LE((name.length + 1) * 2, 64);
  part[66] = type;
  part.writeUInt32LE(start >>> 0, 116);
  part.writeUInt32LE(size, 120);
  return part;
}
function fixture(group = 'DAM 2A', duplicate = false) {
  const strings = ['Alumnos por grupo', 'Nº', 'Nombre', 'Curso', 'Grupo ' + group,
    'Pérez García, Ana María', duplicate ? 'Pérez García, Ana María' : 'López Ruiz, Javier'];
  const first = strings.slice(0, 5).map(value => stringBody(value, false, false));
  const sixth = stringBody(strings[5], true, true);
  const split = 5 + 10; // Header and five UTF-16 characters.
  const count = Buffer.alloc(8);
  count.writeUInt32LE(strings.length, 0);
  count.writeUInt32LE(strings.length, 4);
  const sst = record(0x00fc, Buffer.concat([count, ...first, sixth.subarray(0, split)]));
  const continuation = record(0x003c, Buffer.concat([Buffer.from([1]), sixth.subarray(split),
    stringBody(strings[6], true, false)]));
  const bounds = Buffer.alloc(8 + 5);
  bounds[4] = 0; bounds[5] = 0; bounds[6] = 5;
  Buffer.from('Sheet').copy(bounds, 8);
  const globalSize = bof(5).length + record(0x0085, bounds).length +
    sst.length + continuation.length + record(0x000a, Buffer.alloc(0)).length;
  bounds.writeUInt32LE(globalSize, 0);
  const globals = Buffer.concat([bof(5), record(0x0085, bounds), sst, continuation,
    record(0x000a, Buffer.alloc(0))]);
  const sheet = Buffer.concat([bof(0x0010), labelSst(0, 0, 0), labelSst(2, 0, 1),
    labelSst(2, 1, 2), labelSst(2, 2, 3), labelSst(4, 0, 4),
    labelSst(5, 1, 5), labelSst(6, 1, 6), record(0x000a, Buffer.alloc(0))]);
  const workbook = Buffer.alloc(4096);
  Buffer.concat([globals, sheet]).copy(workbook);
  const header = Buffer.alloc(512, 0xff);
  Buffer.from('d0cf11e0a1b11ae1', 'hex').copy(header);
  header.writeUInt16LE(0x003e, 0x18);
  header.writeUInt16LE(3, 0x1a);
  header.writeUInt16LE(0xfffe, 0x1c);
  header.writeUInt16LE(9, 0x1e);
  header.writeUInt16LE(6, 0x20);
  header.writeUInt32LE(1, 0x2c);
  header.writeUInt32LE(1, 0x30);
  header.writeUInt32LE(4096, 0x38);
  header.writeUInt32LE(0xfffffffe, 0x3c);
  header.writeUInt32LE(0, 0x40);
  header.writeUInt32LE(0xfffffffe, 0x44);
  header.writeUInt32LE(0, 0x48);
  header.writeUInt32LE(0, 0x4c);
  const fat = Buffer.alloc(512, 0xff);
  fat.writeUInt32LE(0xfffffffd, 0);
  fat.writeUInt32LE(0xfffffffe, 4);
  for (let id = 2; id < 9; id++) fat.writeUInt32LE(id + 1, id * 4);
  fat.writeUInt32LE(0xfffffffe, 9 * 4);
  const dir = Buffer.concat([directory('Root Entry', 5, 0xfffffffe, 0),
    directory('Workbook', 2, 2, workbook.length), Buffer.alloc(256)]);
  return Buffer.concat([header, fat, dir, workbook]);
}
const blob = bytes => ({ getBytes: () => Array.from(bytes) });
const parsed = context.parseTutorEducaFile_(blob(fixture()));
assert.equal(parsed.sheetCount, 1);
assert.equal(parsed.group, 'DAM 2A');
assert.equal(parsed.students.length, 2);
assert.equal(parsed.students[0].surname, 'Pérez García');
assert.equal(parsed.students[0].name, 'Ana María');
assert.throws(() => context.parseTutorEducaFile_(blob(fixture('SMR 1A', true))), /formato esperado/);
assert.throws(() => context.parseTutorEducaFile_(blob(Buffer.from('PK\x03\x04'))), /formato esperado/);
assert.throws(() => context.parseTutorEducaFile_(blob(Buffer.alloc(5 * 1024 * 1024 + 1))), /formato esperado/);
const real = '_local_testdata/rptALMPorGrupo.xls';
if (fs.existsSync(real)) {
  const bytes = fs.readFileSync(real);
  const result = context.parseTutorEducaFile_(blob(bytes));
  assert.equal(bytes.subarray(0, 8).toString('hex'), 'd0cf11e0a1b11ae1');
  assert.equal(result.group, 'DAM 2A');
  assert.equal(result.sheetCount, 1);
  assert.equal(result.students.length, 5);
  const moduleParser = vm.createContext({});
  vm.runInContext(fs.readFileSync('EducaImport.gs', 'utf8'), moduleParser);
  assert.throws(() => moduleParser.readEducaPackage_(blob(bytes)), /formato|archivo/i);
  console.log('Real Tutor XLS: OLE valid; 1 sheet; group DAM 2A; 5 students');
}
console.log('BIFF8 synthetic, SST CONTINUE, Unicode, rich text and invalid files: ok');
