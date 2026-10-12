// Preview is read only. Only the course activation marker is persisted locally.
function abrirSincronizacionContactos() {
  const template = HtmlService.createTemplateFromFile('UiDialogContacts');
  setCommonUiTemplateData_(template);
  SpreadsheetApp.getUi().showModalDialog(template.evaluate()
    .setWidth(CP.UI.CONTACTS_SYNC_DIALOG_WIDTH)
    .setHeight(CP.UI.CONTACTS_SYNC_DIALOG_HEIGHT), CP.MENU.CONTACTS_SYNC);
}

function contactsCoursePrefix_(academicYear) {
  const match = String(academicYear || '').trim().match(/^(\d{4})\s*[-–—/]\s*(\d{4})$/);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) {
    throw new Error('Configura correctamente el curso académico antes de sincronizar Google Contacts.');
  }
  return match[1].slice(2) + match[2].slice(2);
}

function normalizeContactEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidContactEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildContactsSource_(book, activityId) {
  const course = getGeneralConfigValues_(book)[CP.CONFIG_KEYS.ACADEMIC_YEAR];
  const prefix = contactsCoursePrefix_(course);
  const students = getEnrollmentStudents_(book);
  if (!students.length) throw new Error('Primero importa alumnado en 3 Alumnado.');
  const modules = getModuleActivitiesForEnrollment_().filter(function(module) {
    return !activityId || module.id === activityId;
  });
  const emailByStudentId = {};
  const withoutEmail = [], invalidEmail = [];
  students.forEach(function(student) {
    const email = normalizeContactEmail_(student.email);
    if (!email) withoutEmail.push({ surname: student.surname, name: student.name, group: student.group });
    else if (!isValidContactEmail_(email)) invalidEmail.push({ surname: student.surname,
      name: student.name, group: student.group, email: String(student.email).trim() });
    else {
      emailByStudentId[student.id] = email;
    }
  });
  const labels = [];
  modules.forEach(function(module) {
    if (!module.group || !module.acronym) {
      throw new Error('Completa Grupo y Sigla de tus módulos antes de sincronizar Google Contacts.');
    }
    const ids = getStudentsForModuleActivity_(book, module).map(function(student) { return student.id; });
    labels.push({ name: prefix + ' · ' + module.group + ' · ' + module.acronym, kind: 'module',
      emails: ids.map(function(id) { return emailByStudentId[id]; }).filter(Boolean) });
  });
  const names = {};
  labels.forEach(function(label) {
    if (names[label.name]) throw new Error('Hay etiquetas de módulo con el mismo nombre. Revisa las siglas.');
    names[label.name] = true;
  });
  return { course: String(course), prefix: prefix, students: students, labels: labels,
    withoutEmail: withoutEmail, invalidEmail: invalidEmail };
}

function listAllPersonalContacts_() {
  const contacts = [];
  let token = '';
  do {
    const options = { pageSize: 1000, personFields: 'emailAddresses,memberships,metadata',
      sources: ['READ_SOURCE_TYPE_CONTACT'] };
    if (token) options.pageToken = token;
    const page = People.People.Connections.list('people/me', options);
    (page.connections || []).forEach(function(person) { if (person.resourceName) contacts.push(person); });
    token = page.nextPageToken || '';
  } while (token);
  return contacts;
}

function listAllContactGroups_() {
  const groups = [];
  let token = '';
  do {
    const options = { pageSize: 1000, groupFields: 'name,groupType,memberCount' };
    if (token) options.pageToken = token;
    const page = People.ContactGroups.list(options);
    (page.contactGroups || []).forEach(function(group) {
      if (group.groupType === 'USER_CONTACT_GROUP') groups.push(group);
    });
    token = page.nextPageToken || '';
  } while (token);
  return groups;
}

function readContactsState_() {
  try {
    return { people: listAllPersonalContacts_(), groups: listAllContactGroups_() };
  } catch (error) {
    throw new Error('No se ha podido acceder a Google Contacts con esta cuenta. El resto del Cuaderno puede seguir utilizándose normalmente.');
  }
}

function planContactsSync_(source, state) {
  const peopleByEmail = {}, groupByName = {}, membersByGroup = {};
  state.people.forEach(function(person) {
    (person.emailAddresses || []).forEach(function(item) {
      const email = normalizeContactEmail_(item.value);
      if (!email) return;
      if (!peopleByEmail[email]) peopleByEmail[email] = {};
      peopleByEmail[email][person.resourceName] = person;
    });
    (person.memberships || []).forEach(function(item) {
      const group = item.contactGroupMembership && item.contactGroupMembership.contactGroupResourceName;
      if (!group) return;
      if (!membersByGroup[group]) membersByGroup[group] = {};
      membersByGroup[group][person.resourceName] = true;
    });
  });
  state.groups.forEach(function(group) {
    if (groupByName[group.name]) throw new Error('Hay etiquetas de Google Contacts con nombres duplicados.');
    groupByName[group.name] = group;
  });
  const studentsByEmail = {};
  const relevantEmails = {};
  source.labels.forEach(function(label) { label.emails.forEach(function(email) { relevantEmails[email] = true; }); });
  source.students.forEach(function(student) {
    const email = normalizeContactEmail_(student.email);
    if (isValidContactEmail_(email) && relevantEmails[email]) {
      if (!studentsByEmail[email]) studentsByEmail[email] = [];
      studentsByEmail[email].push(student);
    }
  });
  const ambiguous = [], resolved = {}, protectedResources = {};
  Object.keys(studentsByEmail).forEach(function(email) {
    const contacts = Object.keys(peopleByEmail[email] || {});
    if (contacts.length > 1 || studentsByEmail[email].length > 1) {
      const reason = contacts.length > 1
        ? 'Hay varios contactos de Google con este correo. Revisa tus contactos antes de sincronizar este alumno.'
        : 'El mismo correo figura en varios alumnos de 3 Alumnado. Revisa los emails.';
      studentsByEmail[email].forEach(function(student) {
        ambiguous.push({ surname: student.surname, name: student.name,
          group: student.group, email: email, reason: reason });
      });
      contacts.forEach(function(resource) { protectedResources[resource] = true; });
    } else resolved[email] = contacts[0] || '';
  });
  let additions = 0, removals = 0, newGroups = 0, existingGroups = 0;
  source.labels.forEach(function(label) {
    const group = groupByName[label.name];
    if (group) existingGroups++; else newGroups++;
    const current = group ? membersByGroup[group.resourceName] || {} : {};
    const desired = {};
    label.emails.forEach(function(email) {
      if (!Object.prototype.hasOwnProperty.call(resolved, email)) return;
      if (resolved[email]) desired[resolved[email]] = true;
      else additions++; // A contact will be created during synchronization.
    });
    Object.keys(desired).forEach(function(resource) { if (!current[resource]) additions++; });
    Object.keys(current).forEach(function(resource) {
      if (!desired[resource] && !protectedResources[resource]) removals++;
    });
  });
  return { resolved: resolved, protectedResources: protectedResources, membersByGroup: membersByGroup,
    groupByName: groupByName, ambiguous: ambiguous, newContacts: Object.keys(resolved)
      .filter(function(email) { return !resolved[email]; }).length,
    existingContacts: Object.keys(resolved).filter(function(email) { return !!resolved[email]; }).length,
    newGroups: newGroups, existingGroups: existingGroups, additions: additions, removals: removals };
}

function analizarGoogleContacts() {
  const source = buildContactsSource_(SpreadsheetApp.getActiveSpreadsheet());
  const plan = planContactsSync_(source, readContactsState_());
  return { course: source.course, prefix: source.prefix, moduleLabels: source.labels.filter(function(label) {
    return label.kind === 'module';
  }).length, withEmail: source.students.length - source.withoutEmail.length - source.invalidEmail.length,
  withoutEmail: source.withoutEmail, invalidEmail: source.invalidEmail, ambiguous: plan.ambiguous,
  newContacts: plan.newContacts, existingContacts: plan.existingContacts,
  newGroups: plan.newGroups, existingGroups: plan.existingGroups,
  additions: plan.additions, removals: plan.removals };
}

function obtenerResumenSincronizacionContactos() {
  const source = buildContactsSource_(SpreadsheetApp.getActiveSpreadsheet());
  return { course: source.course, moduleLabels: source.labels.filter(function(label) {
    return label.kind === 'module';
  }).length, labelNames: source.labels.map(function(label) { return label.name; }) };
}

function isContactsAutoSyncEnabledForCurrentCourse_(book) {
  const config = getStoredConfigMap_(book);
  const initializedCourse = String(config[CP.CONFIG_KEYS.CONTACTS_SYNC_COURSE] || '').trim();
  return Boolean(initializedCourse) && initializedCourse ===
    getGeneralConfigValues_(book)[CP.CONFIG_KEYS.ACADEMIC_YEAR];
}

function syncContactsForModule_(activityId, previousGroup) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!isContactsAutoSyncEnabledForCurrentCourse_(book)) return null;
  const modules = getModuleActivitiesForEnrollment_();
  const module = modules.find(function(item) { return item.id === activityId; });
  if (!module) throw new Error('El módulo ya no existe.');
  if (modules.some(function(item) { return item.id !== activityId &&
      item.group === module.group && item.acronym === module.acronym; })) {
    throw new Error('La etiqueta del módulo no es inequívoca.');
  }
  if (previousGroup && modules.some(function(item) { return item.id !== activityId &&
      item.group === previousGroup && item.acronym === module.acronym; })) {
    previousGroup = '';
  }
  const course = getGeneralConfigValues_(book)[CP.CONFIG_KEYS.ACADEMIC_YEAR];
  const prefix = contactsCoursePrefix_(course);
  return executeContactsSync_(null, previousGroup &&
    prefix + ' · ' + previousGroup + ' · ' + module.acronym, activityId);
}

function syncContactsAfterAcademicChange_(activityIds, previousGroups) {
  try {
    if (!isContactsAutoSyncEnabledForCurrentCourse_(SpreadsheetApp.getActiveSpreadsheet())) return false;
    let warning = false;
    activityIds.forEach(function(id) {
      try {
        const result = syncContactsForModule_(id, previousGroups && previousGroups[id]);
        if (result && result.incidents) warning = true;
      } catch (error) { warning = true; }
    });
    if (warning) console.warn('No se pudo completar Google Contacts después del cambio académico.');
    return warning;
  } catch (error) {
    console.warn('No se pudo actualizar Google Contacts después del cambio académico.');
    return true;
  }
}

function syncGoogleContacts() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const result = executeContactsSync_();
  if (!result.incidents) {
    const values = {};
    values[CP.CONFIG_KEYS.CONTACTS_SYNC_COURSE] = getGeneralConfigValues_(book)[CP.CONFIG_KEYS.ACADEMIC_YEAR];
    updateConfigValues_(book.getSheetByName(CP.SHEETS.CONFIG), values, [CP.CONFIG_KEYS.CONTACTS_SYNC_COURSE]);
  }
  return result;
}

function executeContactsSync_(source, previousLabelName, activityId) {
  const lock = LockService.getDocumentLock();
  if (!lock || !lock.tryLock(30000)) throw new Error('Ya hay una sincronización en curso. Inténtalo de nuevo.');
  try {
    source = source || buildContactsSource_(SpreadsheetApp.getActiveSpreadsheet(), activityId);
    if (activityId && source.labels.length !== 1) throw new Error('La etiqueta del módulo no es inequívoca.');
    const plan = planContactsSync_(source, readContactsState_());
    const result = { created: 0, reused: plan.existingContacts, labelsUpdated: 0, incidents: 0 };
    if (previousLabelName && previousLabelName !== source.labels[0].name &&
        !plan.groupByName[source.labels[0].name] && plan.groupByName[previousLabelName]) {
      try {
        const oldGroup = plan.groupByName[previousLabelName];
        const renamed = People.ContactGroups.update({ contactGroup: {
          resourceName: oldGroup.resourceName, name: source.labels[0].name },
        updateGroupFields: 'name' }, oldGroup.resourceName);
        plan.groupByName[source.labels[0].name] = renamed || oldGroup;
      } catch (error) { result.incidents++; }
    }
    // Mutations are sequential, and every retry recomputes the plan from the APIs.
    Object.keys(plan.resolved).forEach(function(email) {
      if (plan.resolved[email]) return;
      const student = source.students.find(function(item) { return normalizeContactEmail_(item.email) === email; });
      try {
        const created = People.People.createContact({ names: [{ givenName: student.name,
          familyName: student.surname }], emailAddresses: [{ value: String(student.email).trim() }] },
        { personFields: 'emailAddresses' });
        if (!created.resourceName) throw new Error('Missing resource');
        plan.resolved[email] = created.resourceName;
        result.created++;
      } catch (error) { result.incidents++; }
    });
    source.labels.forEach(function(label) {
      let group = plan.groupByName[label.name];
      if (!group) {
        try {
          group = People.ContactGroups.create({ contactGroup: { name: label.name } });
        } catch (error) {
          // A concurrent creation may have returned 409; resolve it by exact name.
          try { group = listAllContactGroups_().find(function(item) { return item.name === label.name; }); }
          catch (readError) { group = null; }
        }
        if (!group || !group.resourceName) { result.incidents++; return; }
        plan.groupByName[label.name] = group;
      }
      const current = plan.membersByGroup[group.resourceName] || {};
      const desired = {};
      label.emails.forEach(function(email) {
        if (plan.resolved[email]) desired[plan.resolved[email]] = true;
      });
      const add = Object.keys(desired).filter(function(resource) { return !current[resource]; });
      const remove = Object.keys(current).filter(function(resource) {
        return !desired[resource] && !plan.protectedResources[resource];
      });
      const changes = add.map(function(resource) { return { add: resource }; })
        .concat(remove.map(function(resource) { return { remove: resource }; }));
      if (!changes.length) { result.labelsUpdated++; return; }
      let successful = true;
      for (let offset = 0; offset < changes.length; offset += 1000) {
        const chunk = changes.slice(offset, offset + 1000);
        try {
          const response = People.ContactGroups.Members.modify({
            resourceNamesToAdd: chunk.filter(function(item) { return item.add; })
              .map(function(item) { return item.add; }),
            resourceNamesToRemove: chunk.filter(function(item) { return item.remove; })
              .map(function(item) { return item.remove; }),
          }, group.resourceName);
          if (((response || {}).notFoundResourceNames || []).length ||
              ((response || {}).canNotRemoveLastContactGroupResourceNames || []).length) {
            result.incidents++; successful = false;
          }
        } catch (error) { result.incidents++; successful = false; }
      }
      if (successful) result.labelsUpdated++;
    });
    result.status = result.incidents ? 'Sincronización completada con incidencias' : 'Google Contacts actualizado';
    return result;
  } finally { lock.releaseLock(); }
}
