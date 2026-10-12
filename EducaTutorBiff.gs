// Narrow, read-only OLE/BIFF8 reader for EDUCA's «Alumnos por grupo» report.
const CP_TUTOR_FILE_ERROR = 'Este archivo no tiene el formato esperado del informe de alumnado de Tutoría de EDUCA.';
const CP_TUTOR_FILE_LIMIT = 5 * 1024 * 1024;
const CP_OLE_END = 0xfffffffe;
const CP_OLE_FREE = 0xffffffff;

function tutorBiffFail_() { throw new Error(CP_TUTOR_FILE_ERROR); }

function tutorBytes_(blob) {
  const raw = blob && blob.getBytes && blob.getBytes();
  if (!raw || raw.length < 512 || raw.length > CP_TUTOR_FILE_LIMIT) tutorBiffFail_();
  return Uint8Array.from(raw, function(value) { return value & 255; });
}

function tutorU16_(bytes, offset) {
  if (offset < 0 || offset + 2 > bytes.length) tutorBiffFail_();
  return bytes[offset] | bytes[offset + 1] << 8;
}

function tutorU32_(bytes, offset) {
  if (offset < 0 || offset + 4 > bytes.length) tutorBiffFail_();
  return (bytes[offset] | bytes[offset + 1] << 8 |
    bytes[offset + 2] << 16 | bytes[offset + 3] << 24) >>> 0;
}

function tutorUtf16_(bytes, offset, length) {
  if (offset < 0 || length < 0 || offset + length * 2 > bytes.length) tutorBiffFail_();
  let value = '';
  for (let index = 0; index < length; index++) {
    value += String.fromCharCode(tutorU16_(bytes, offset + index * 2));
  }
  return value;
}

function tutorReadOleWorkbook_(bytes) {
  const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (!signature.every(function(value, index) { return bytes[index] === value; }) ||
      tutorU16_(bytes, 0x1c) !== 0xfffe) tutorBiffFail_();
  const major = tutorU16_(bytes, 0x1a);
  const shift = tutorU16_(bytes, 0x1e);
  const miniShift = tutorU16_(bytes, 0x20);
  if (!((major === 3 && shift === 9) || (major === 4 && shift === 12)) ||
      miniShift !== 6) tutorBiffFail_();
  const sectorSize = 1 << shift;
  const miniSize = 1 << miniShift;
  const sectorCount = Math.floor(bytes.length / sectorSize) - 1;
  if (sectorCount < 1 || tutorU32_(bytes, 0x38) !== 4096) tutorBiffFail_();
  function sector(id) {
    if (!Number.isInteger(id) || id >= sectorCount) tutorBiffFail_();
    const offset = (id + 1) * sectorSize;
    if (offset + sectorSize > bytes.length) tutorBiffFail_();
    return bytes.subarray(offset, offset + sectorSize);
  }
  const fatIds = [];
  for (let index = 0; index < 109; index++) {
    const id = tutorU32_(bytes, 0x4c + index * 4);
    if (id !== CP_OLE_FREE) fatIds.push(id);
  }
  let difatId = tutorU32_(bytes, 0x44);
  const difatCount = tutorU32_(bytes, 0x48);
  if (difatCount > sectorCount) tutorBiffFail_();
  const seenDifat = {};
  for (let index = 0; index < difatCount; index++) {
    if (difatId === CP_OLE_END || seenDifat[difatId]) tutorBiffFail_();
    seenDifat[difatId] = true;
    const part = sector(difatId);
    for (let slot = 0; slot < sectorSize / 4 - 1; slot++) {
      const id = tutorU32_(part, slot * 4);
      if (id !== CP_OLE_FREE) fatIds.push(id);
    }
    difatId = tutorU32_(part, sectorSize - 4);
  }
  const fatCount = tutorU32_(bytes, 0x2c);
  if (fatCount < 1 || fatIds.length !== fatCount) tutorBiffFail_();
  const fat = [];
  fatIds.forEach(function(id) {
    const part = sector(id);
    for (let offset = 0; offset < sectorSize; offset += 4) fat.push(tutorU32_(part, offset));
  });
  function chain(start, table, max) {
    const ids = [], seen = {};
    let id = start;
    while (id !== CP_OLE_END) {
      if (id === CP_OLE_FREE || id >= table.length || seen[id] || ids.length >= max) tutorBiffFail_();
      seen[id] = true;
      ids.push(id);
      id = table[id];
    }
    return ids;
  }
  function join(parts, size) {
    if (size > CP_TUTOR_FILE_LIMIT || parts.length * (parts[0] ? parts[0].length : 0) < size) tutorBiffFail_();
    const result = new Uint8Array(size);
    let offset = 0;
    parts.forEach(function(part) {
      const count = Math.min(part.length, size - offset);
      if (count > 0) result.set(part.subarray(0, count), offset);
      offset += count;
    });
    return result;
  }
  const directoryIds = chain(tutorU32_(bytes, 0x30), fat, sectorCount);
  const directory = join(directoryIds.map(sector), directoryIds.length * sectorSize);
  const entries = [];
  for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
    const length = tutorU16_(directory, offset + 64);
    const type = directory[offset + 66];
    if (!type) continue;
    if (length < 2 || length > 64 || length % 2) tutorBiffFail_();
    if (tutorU32_(directory, offset + 124) !== 0) tutorBiffFail_();
    entries.push({ name: tutorUtf16_(directory, offset, length / 2 - 1),
      type: type, start: tutorU32_(directory, offset + 116),
      size: tutorU32_(directory, offset + 120) });
  }
  const root = entries.find(function(entry) { return entry.type === 5; });
  const workbook = entries.find(function(entry) {
    return entry.type === 2 && (entry.name === 'Workbook' || entry.name === 'Book');
  });
  if (!root || !workbook || !workbook.size) tutorBiffFail_();
  if (workbook.size >= 4096) {
    return join(chain(workbook.start, fat, sectorCount).map(sector), workbook.size);
  }
  const miniFatCount = tutorU32_(bytes, 0x40);
  if (!miniFatCount || miniFatCount > sectorCount) tutorBiffFail_();
  const miniFatIds = chain(tutorU32_(bytes, 0x3c), fat, sectorCount);
  if (miniFatIds.length !== miniFatCount) tutorBiffFail_();
  const miniFatBytes = join(miniFatIds.map(sector), miniFatCount * sectorSize);
  const miniFat = [];
  for (let offset = 0; offset < miniFatBytes.length; offset += 4) miniFat.push(tutorU32_(miniFatBytes, offset));
  const rootStream = join(chain(root.start, fat, sectorCount).map(sector), root.size);
  return join(chain(workbook.start, miniFat, Math.ceil(rootStream.length / miniSize))
    .map(function(id) {
      const offset = id * miniSize;
      if (offset + miniSize > rootStream.length) tutorBiffFail_();
      return rootStream.subarray(offset, offset + miniSize);
    }), workbook.size);
}

function tutorBiffRecords_(bytes, start) {
  const records = [];
  let offset = start;
  while (offset + 4 <= bytes.length) {
    const id = tutorU16_(bytes, offset), length = tutorU16_(bytes, offset + 2);
    if (offset + 4 + length > bytes.length) tutorBiffFail_();
    records.push({ id: id, offset: offset, data: bytes.subarray(offset + 4, offset + 4 + length) });
    offset += 4 + length;
    if (id === 0x000a) return records;
    if (records.length > 500000) tutorBiffFail_();
  }
  tutorBiffFail_();
}

function tutorBiffSst_(parts) {
  let partIndex = 0, position = 0;
  function bytes(count) {
    const result = new Uint8Array(count);
    let written = 0;
    while (written < count) {
      const part = parts[partIndex];
      if (!part) tutorBiffFail_();
      if (position === part.length) { partIndex++; position = 0; continue; }
      const size = Math.min(count - written, part.length - position);
      result.set(part.subarray(position, position + size), written);
      position += size;
      written += size;
    }
    return result;
  }
  function byte() { return bytes(1)[0]; }
  function u16() { return tutorU16_(bytes(2), 0); }
  function u32() { return tutorU32_(bytes(4), 0); }
  const total = u32(), unique = u32();
  if (unique > total || unique > 100000) tutorBiffFail_();
  const strings = [];
  for (let index = 0; index < unique; index++) {
    const count = u16(), flags = byte();
    let unicode = Boolean(flags & 1);
    const richCount = flags & 8 ? u16() : 0;
    const extSize = flags & 4 ? u32() : 0;
    if (count > 32000 || extSize > CP_TUTOR_FILE_LIMIT) tutorBiffFail_();
    let value = '';
    for (let charIndex = 0; charIndex < count; charIndex++) {
      if (!parts[partIndex]) tutorBiffFail_();
      if (position === parts[partIndex].length) {
        partIndex++; position = 0;
        unicode = Boolean(byte() & 1); // CONTINUE starts with a character width flag.
      }
      const code = unicode ? u16() : byte();
      value += String.fromCharCode(code);
    }
    if (richCount) bytes(richCount * 4);
    if (extSize) bytes(extSize);
    strings.push(value);
  }
  return strings;
}

function tutorBiffInlineString_(part, offset, count, flags) {
  const width = flags & 1 ? 2 : 1;
  if (offset + count * width > part.length) tutorBiffFail_();
  let value = '';
  for (let index = 0; index < count; index++) {
    value += String.fromCharCode(width === 2
      ? tutorU16_(part, offset + index * 2) : part[offset + index]);
  }
  return value;
}

function tutorBiffWorkbook_(bytes) {
  const globals = tutorBiffRecords_(bytes, 0);
  const bof = globals[0] && globals[0].data;
  if (!bof || globals[0].id !== 0x0809 || tutorU16_(bof, 0) !== 0x0600 ||
      tutorU16_(bof, 2) !== 0x0005) tutorBiffFail_();
  const sheets = [], sstParts = [];
  globals.forEach(function(record, index) {
    if (record.id === 0x0085) {
      const part = record.data;
      if (part.length < 8) tutorBiffFail_();
      if (part[5] === 0) sheets.push(tutorU32_(part, 0));
    }
    if (record.id === 0x00fc) {
      sstParts.push(record.data);
      for (let next = index + 1; next < globals.length && globals[next].id === 0x003c; next++) {
        sstParts.push(globals[next].data);
      }
    }
  });
  if (!sheets.length || sheets.length > 100) tutorBiffFail_();
  const strings = sstParts.length ? tutorBiffSst_(sstParts) : [];
  const worksheets = sheets.map(function(start) {
    if (start >= bytes.length) tutorBiffFail_();
    const records = tutorBiffRecords_(bytes, start);
    const sheetBof = records[0] && records[0].data;
    if (!sheetBof || records[0].id !== 0x0809 || tutorU16_(sheetBof, 2) !== 0x0010) tutorBiffFail_();
    const rows = {};
    records.forEach(function(record) {
      const part = record.data;
      if (record.id !== 0x00fd && record.id !== 0x0204) return;
      if (part.length < 10) tutorBiffFail_();
      const row = tutorU16_(part, 0), col = tutorU16_(part, 2);
      if (row > 65535 || col > 255) tutorBiffFail_();
      let value;
      if (record.id === 0x00fd) {
        value = strings[tutorU32_(part, 6)];
        if (value === undefined) tutorBiffFail_();
      } else {
        const count = tutorU16_(part, 6);
        value = tutorBiffInlineString_(part, 9, count, part[8]);
      }
      if (!rows[row]) rows[row] = {};
      rows[row][col] = value;
    });
    return Object.keys(rows).map(function(number) { return { number: Number(number), cells: rows[number] }; })
      .sort(function(a, b) { return a.number - b.number; });
  });
  return { sheets: worksheets };
}

function normalizeTutorText_(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[\s\-‐‑–—]+/g, '');
}

function tutorStudentKey_(surname, name, group) {
  return [surname, name, group].map(normalizeTutorText_).join('|');
}

function parseTutorReportRows_(sheets) {
  const reports = [];
  sheets.forEach(function(rows) {
    const allCells = rows.map(function(row) { return Object.values(row.cells); });
    const title = allCells.some(function(cells) {
      return cells.some(function(value) { return normalizeTutorText_(value) === 'ALUMNOSPORGRUPO'; });
    });
    if (!title) return;
    const header = rows.find(function(row) {
      const values = Object.values(row.cells).map(normalizeTutorText_);
      return values.includes('Nº') && values.includes('NOMBRE') && values.includes('CURSO');
    });
    if (!header) tutorBiffFail_();
    const nameColumn = Number(Object.keys(header.cells).find(function(col) {
      return normalizeTutorText_(header.cells[col]) === 'NOMBRE';
    }));
    const groupRows = rows.filter(function(row) {
      return row.number > header.number && Object.values(row.cells).some(function(value) {
        return /^\s*Grupo\s+\S/i.test(String(value));
      });
    });
    if (groupRows.length !== 1) tutorBiffFail_();
    const groupRow = groupRows[0];
    const descriptor = Object.values(groupRow.cells).find(function(value) {
      return /^\s*Grupo\s+\S/i.test(String(value));
    });
    const group = String(descriptor).replace(/^\s*Grupo\s+/i, '').trim();
    const students = [];
    rows.forEach(function(row) {
      if (row.number <= groupRow.number) return;
      const raw = String(row.cells[nameColumn] || '').split(/\r?\n/).map(function(value) {
        return value.trim();
      }).find(Boolean);
      if (!raw || raw.indexOf(',') < 1) return;
      const comma = raw.indexOf(',');
      const surname = raw.slice(0, comma).trim(), name = raw.slice(comma + 1).trim();
      if (surname && name) students.push({ surname: surname, name: name, group: group });
    });
    if (!group || !students.length || students.length > 2000) tutorBiffFail_();
    const seen = {};
    students.forEach(function(student) {
      student.key = tutorStudentKey_(student.surname, student.name, group);
      if (seen[student.key]) tutorBiffFail_();
      seen[student.key] = true;
    });
    reports.push({ group: group, students: students });
  });
  if (reports.length !== 1) tutorBiffFail_();
  return { group: reports[0].group, students: reports[0].students, sheetCount: sheets.length };
}

function parseTutorEducaFile_(blob) {
  try {
    const bytes = tutorBytes_(blob);
    return parseTutorReportRows_(tutorBiffWorkbook_(tutorReadOleWorkbook_(bytes)).sheets);
  } catch (error) {
    throw new Error(CP_TUTOR_FILE_ERROR);
  }
}
