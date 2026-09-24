function obtenerRaizSelectorCarpetas() {
  return getFolderPickerView_(DriveApp.getRootFolder().getId());
}

function obtenerVistaSelectorCarpetas(folderId) {
  return getFolderPickerView_(folderId);
}

function getFolderPickerView_(folderId) {
  const folder = getDriveFolderById_(folderId);
  const path = getMyDriveFolderPath_(folder);
  const folders = [];
  const iterator = folder.getFolders();

  while (iterator.hasNext()) {
    const child = iterator.next();
    if (!child.isTrashed()) {
      folders.push({
        id: child.getId(),
        name: child.getName(),
      });
    }
  }

  folders.sort(function(first, second) {
    return first.name.localeCompare(second.name);
  });

  return {
    id: folder.getId(),
    name: getDriveFolderDisplayName_(folder),
    path: path,
    parentId: path.length > 1 ? path[path.length - 2].id : '',
    folders: folders,
  };
}

function getDriveFolderById_(folderId) {
  const normalizedId = normalizeConfigValue_(folderId);
  if (!normalizedId) {
    throw new Error('La carpeta seleccionada no es válida.');
  }

  const rootFolder = DriveApp.getRootFolder();
  let folder;
  try {
    folder = normalizedId === rootFolder.getId()
      ? rootFolder
      : DriveApp.getFolderById(normalizedId);
  } catch (error) {
    throw new Error('La carpeta seleccionada no existe o no es accesible.');
  }

  if (folder.isTrashed()) {
    throw new Error('La carpeta seleccionada está en la papelera.');
  }
  return folder;
}

function getMyDriveFolderPath_(folder) {
  const rootFolder = DriveApp.getRootFolder();
  const rootId = rootFolder.getId();
  const reversedPath = [];
  const visited = {};
  let current = folder;

  for (let depth = 0; depth < 100; depth += 1) {
    const currentId = current.getId();
    if (visited[currentId]) {
      break;
    }
    visited[currentId] = true;
    reversedPath.push({
      id: currentId,
      name: getDriveFolderDisplayName_(current),
    });

    if (currentId === rootId) {
      return reversedPath.reverse();
    }

    const parents = current.getParents();
    if (!parents.hasNext()) {
      break;
    }
    current = parents.next();
  }

  throw new Error(
    'La carpeta no pertenece a Mi unidad o no puede gestionarse con DriveApp.'
  );
}

function getDriveFolderDisplayName_(folder) {
  return folder.getId() === DriveApp.getRootFolder().getId()
    ? 'Mi unidad'
    : folder.getName();
}

function getNotebookDriveLocation_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const file = DriveApp.getFileById(spreadsheet.getId());
  const parents = file.getParents();
  if (!parents.hasNext()) {
    throw new Error('No se ha podido determinar la carpeta actual del cuaderno.');
  }

  const folder = parents.next();
  if (parents.hasNext()) {
    throw new Error('El cuaderno tiene más de una ubicación y no puede moverse de forma segura.');
  }
  getMyDriveFolderPath_(folder);

  return {
    id: folder.getId(),
    name: getDriveFolderDisplayName_(folder),
  };
}

function isFileInFolder_(file, folderId) {
  const parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) {
      return true;
    }
  }
  return false;
}
