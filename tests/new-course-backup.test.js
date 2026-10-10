const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const calls = [];
const originalFolder = { id: 'ORIGINAL' };
const backupCover = { getParent: () => backupBook,
  getLastRow: () => 6 };
const backupBook = { getSheetByName: () => backupCover, getUrl: () => 'backup-url' };
const backupFile = { getId: () => 'BACKUP', isTrashed: () => false,
  getName: () => 'Cuaderno antiguo' };
const source = { makeCopy(name, folder) {
  calls.push(['copy', name, folder.id]);
  return backupFile;
} };
const context = {
  CP: { SHEETS: { COVER: '0 Portada' } },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({ getId: () => 'ACTIVE' }),
    openById: id => { calls.push(['open', id]); return backupBook; },
  },
  DriveApp: { getFileById: () => source },
  isFileInFolder_: (file, folderId) => file === source ||
    (file === backupFile && folderId === 'ORIGINAL'),
  getDriveFolderById_: () => originalFolder,
  renderCoverIndex_: sheet => calls.push(['index', sheet.getParent().getUrl()]),
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('NewCourse.gs', 'utf8'), context);
const result = context.createNewCourseBackup_({ originalFolderId: 'ORIGINAL',
  originalFolderName: '2026', destinationFolderId: 'DESTINATION',
  destinationFolderName: '2027', originalFileName: 'Cuaderno antiguo' });
assert.deepStrictEqual(calls, [
  ['copy', 'Cuaderno antiguo', 'ORIGINAL'],
  ['open', 'BACKUP'],
  ['index', 'backup-url'],
]);
assert(result.includes('2026'));
console.log('historical backup stays in original folder and receives its own index');
