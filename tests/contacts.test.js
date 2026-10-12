const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const students = [
  { id: 'A', surname: 'Pérez', name: 'Ana', group: 'DAM 2A', email: ' ANA@example.test ' },
  { id: 'L', surname: 'López', name: 'Luis', group: 'DAM 2A', email: 'luis@example.test' },
  { id: 'S', surname: 'Santos', name: 'Sinemail', group: 'DAM 2A', email: '' },
  { id: 'I', surname: 'Inválido', name: 'Irene', group: 'DAM 2A', email: 'invalid' },
];
const modules = [
  { id: 'P', category: 'MODULO', group: 'DAM 2A', acronym: 'PMDM' },
  { id: 'C', category: 'MODULO', group: 'DAM 2A', acronym: 'ACDA' },
];
let enrolled = { P: ['A'], C: ['L'] }, course = '2026-2027';
const remote = { people: [{ resourceName: 'people/existing',
  emailAddresses: [{ value: 'luis@example.test' }],
  names: [{ givenName: 'Nombre personal' }], memberships: [] }],
  groups: [], creations: 0, groupCreations: 0, modifications: 0 };
const People = {
  People: {
    Connections: { list: (_resource, options) => {
      assert.strictEqual(options.personFields, 'emailAddresses,memberships,metadata');
      return { connections: remote.people, nextPageToken: '' };
    } },
    createContact: body => {
      remote.creations++;
      const person = { resourceName: 'people/' + remote.creations,
        emailAddresses: body.emailAddresses, names: body.names, memberships: [] };
      remote.people.push(person);
      return person;
    },
  },
  ContactGroups: {
    list: () => ({ contactGroups: remote.groups, nextPageToken: '' }),
    create: body => {
      remote.groupCreations++;
      const group = { resourceName: 'contactGroups/' + remote.groupCreations,
        groupType: 'USER_CONTACT_GROUP', name: body.contactGroup.name };
      remote.groups.push(group);
      return group;
    },
    Members: { modify: (body, groupResource) => {
      assert(body.resourceNamesToAdd.length + body.resourceNamesToRemove.length <= 1000);
      remote.modifications++;
      for (const resource of body.resourceNamesToAdd) {
        const person = remote.people.find(item => item.resourceName === resource);
        person.memberships.push({ contactGroupMembership: { contactGroupResourceName: groupResource } });
      }
      for (const resource of body.resourceNamesToRemove) {
        const person = remote.people.find(item => item.resourceName === resource);
        person.memberships = person.memberships.filter(item =>
          item.contactGroupMembership.contactGroupResourceName !== groupResource);
      }
      return {};
    } },
  },
};
const context = vm.createContext({
  People,
  CP: { CONFIG_KEYS: { ACADEMIC_YEAR: 'curso_academico' } },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({}) },
  LockService: { getDocumentLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  getGeneralConfigValues_: () => ({ curso_academico: course }),
  getEnrollmentStudents_: () => students,
  getModuleActivitiesForEnrollment_: () => modules,
  getStudentsForModuleActivity_: (_book, module) => students.filter(item =>
    enrolled[module.id].includes(item.id)),
});
vm.runInContext(fs.readFileSync('Contacts.gs', 'utf8'), context, { filename: 'Contacts.gs' });
const originalConnectionsList = People.People.Connections.list;
People.People.Connections.list = (_resource, options) => options.pageToken
  ? { connections: [{ resourceName: 'people/page2' }] }
  : { connections: [{ resourceName: 'people/page1' }], nextPageToken: 'next' };
assert.strictEqual(context.listAllPersonalContacts_().length, 2);
People.People.Connections.list = originalConnectionsList;
const originalGroupsList = People.ContactGroups.list;
People.ContactGroups.list = options => options.pageToken
  ? { contactGroups: [{ resourceName: 'contactGroups/page2', groupType: 'USER_CONTACT_GROUP' }] }
  : { contactGroups: [{ resourceName: 'contactGroups/page1', groupType: 'USER_CONTACT_GROUP' }],
    nextPageToken: 'next' };
assert.strictEqual(context.listAllContactGroups_().length, 2);
People.ContactGroups.list = originalGroupsList;
assert.strictEqual(context.contactsCoursePrefix_('2026-2027'), '2627');
assert.strictEqual(context.contactsCoursePrefix_('2026 / 2027'), '2627');
assert.throws(() => context.contactsCoursePrefix_('2026-2028'), /curso académico/);
const first = context.analizarGoogleContacts();
assert.strictEqual(first.withEmail, 2);
assert.strictEqual(first.withoutEmail.length, 1);
assert.strictEqual(first.invalidEmail.length, 1);
assert.strictEqual(first.newContacts, 1);
assert.strictEqual(first.existingContacts, 1);
assert.strictEqual(first.newGroups, 3);
assert.strictEqual(remote.creations, 0);
assert.strictEqual(remote.groupCreations, 0);
assert.strictEqual(remote.modifications, 0);
const initial = context.syncGoogleContacts();
assert.strictEqual(initial.created, 1);
assert.strictEqual(remote.people[0].names[0].givenName, 'Nombre personal');
assert.strictEqual(initial.incidents, 0);
const members = label => remote.people.filter(person => person.memberships.some(item =>
  item.contactGroupMembership.contactGroupResourceName ===
    (remote.groups.find(group => group.name === label) || {}).resourceName))
  .map(person => person.emailAddresses[0].value.trim().toLowerCase()).sort();
assert.deepStrictEqual(members('2627 · DAM 2A'), ['ana@example.test', 'luis@example.test']);
assert.deepStrictEqual(members('2627 · DAM 2A · PMDM'), ['ana@example.test']);
assert.deepStrictEqual(members('2627 · DAM 2A · ACDA'), ['luis@example.test']);
const repeat = context.syncGoogleContacts();
assert.strictEqual(repeat.created, 0);
assert.strictEqual(repeat.reused, 2);
assert.strictEqual(remote.creations, 1);
assert.strictEqual(remote.groupCreations, 3);
enrolled.C = [];
context.syncGoogleContacts();
assert.deepStrictEqual(members('2627 · DAM 2A · ACDA'), []);
assert.deepStrictEqual(members('2627 · DAM 2A'), ['ana@example.test', 'luis@example.test']);
assert.strictEqual(remote.people.length, 2);
course = '2027-2028';
context.syncGoogleContacts();
assert.deepStrictEqual(members('2627 · DAM 2A'), ['ana@example.test', 'luis@example.test']);
assert.deepStrictEqual(members('2728 · DAM 2A'), ['ana@example.test', 'luis@example.test']);
assert.strictEqual(remote.people.length, 2);

const anaContact = remote.people.find(item => item.emailAddresses[0].value.trim().toLowerCase() ===
  'ana@example.test');
const existingName = anaContact.names[0].givenName;
students[0].name = 'Nombre local distinto';
context.syncGoogleContacts();
assert.strictEqual(anaContact.names[0].givenName, existingName);
students[0].name = 'Ana';
const duplicate = { resourceName: 'people/duplicate', emailAddresses: [{ value: 'ana@example.test' }],
  memberships: [] };
remote.people.push(duplicate);
const ambiguous = context.analizarGoogleContacts();
assert.strictEqual(ambiguous.ambiguous.length, 1);
const before = remote.modifications;
context.syncGoogleContacts();
assert.strictEqual(remote.modifications, before);
assert.strictEqual(remote.people.length, 3);
assert(!fs.readFileSync('Contacts.gs', 'utf8').match(/People\.(?:People\.(?:deleteContact|batchDeleteContacts)|ContactGroups\.delete)\s*\(/));
const manifest = JSON.parse(fs.readFileSync('appsscript.json', 'utf8'));
assert.deepStrictEqual(manifest.dependencies.enabledAdvancedServices[0],
  { userSymbol: 'People', version: 'v1', serviceId: 'peopleapi' });
assert(!manifest.oauthScopes);
const dialog = fs.readFileSync('UiDialogContacts.html', 'utf8');
assert(dialog.includes('Analizar Google Contacts'));
assert(dialog.includes('Confirmar sincronización'));
assert(dialog.includes('Sin Email'));
assert(dialog.includes('Google solicitará permiso para gestionar tus contactos'));
assert(dialog.indexOf('analizarGoogleContacts()') < dialog.indexOf('syncGoogleContacts()'));
const menu = fs.readFileSync('Main.gs', 'utf8');
assert(menu.indexOf('CP.MENU.MODULE_ENROLLMENTS') < menu.indexOf('CP.MENU.CONTACTS_SYNC'));
assert(menu.indexOf('CP.MENU.CONTACTS_SYNC') < menu.indexOf('.addSeparator()'));
console.log('Google Contacts preview, sync, memberships, ambiguity and course: ok');
