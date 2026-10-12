const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const createId = (() => {
  let id = 0;
  return () => 'ACT-' + ++id;
})();
const context = vm.createContext({});
['Config.gs', 'Theme.gs', 'Calendar.gs', 'Schedule.gs', 'GeneralConfig.gs', 'NewCourse.gs'].forEach(file => {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
});
context.createCalendarRecordId_ = createId;
const evaluate = source => JSON.parse(vm.runInContext('JSON.stringify(' + source + ')', context));
assert.strictEqual(evaluate('CP.NOTEBOOK_VERSION'), '1.10.0');
assert.strictEqual(evaluate('CP.SCHEMA_VERSION'), '12');
assert.strictEqual(evaluate('CP_CALENDAR_TYPE_DEFINITIONS.find(type => type.id === "ONLINE").name'), 'VIRTUAL');
assert.strictEqual(context.isTutorEnabled_('TRUE'), true);
assert.strictEqual(context.isTutorEnabled_('false'), false);
assert.strictEqual(context.isTutorEnabled_('yes'), false);
const fields = evaluate('getConfigFields_().map(field => [field.key, field.defaultValue || ""])');
assert(fields.some(([key, value]) => key === 'es_tutor' && value === 'false'));
assert(fields.some(([key]) => key === 'grupo_tutoria'));
assert(fields.some(([key]) => key === 'actividad_tutoria_id'));
assert(fields.some(([key]) => key === 'actividades_base_curso'));
const normalizedConfig = context.normalizeGeneralConfigInput_({
  curso_academico: '2026-2027', profesor: 'Docente de prueba', centro: 'Centro de prueba',
  es_tutor: 'TRUE', grupo_tutoria: ' DAM 2A ',
});
assert.strictEqual(normalizedConfig.es_tutor, 'true');
assert.strictEqual(normalizedConfig.grupo_tutoria, 'DAM 2A');
const editableKeys = evaluate('getPersistedConfigFields_({includeTheme:true}).map(field => field.key)');
assert(!editableKeys.includes('actividad_tutoria_id'));
assert(!editableKeys.includes('actividades_base_curso'));

const general = { curso_academico: '2026-2027', profesor: 'Docente de prueba', centro: 'Centro de prueba',
  es_tutor: 'true', grupo_tutoria: '' };
assert.match(context.getGeneralConfigCompletion_(general).reason, /grupo de tutoría/);
general.grupo_tutoria = 'DAM 2A';
assert.strictEqual(context.getGeneralConfigCompletion_(general).complete, true);
general.es_tutor = 'false';
general.grupo_tutoria = '';
assert.strictEqual(context.getGeneralConfigCompletion_(general).complete, true);

const makeTutor = (id, group) => ({ id, category: 'TUTORIA', name: 'Tutoría', acronym: 'T',
  teachingTypeId: '', group, classroom: '', color: '#E5E7EB' });
const moduleActivity = { id: 'MOD-1', category: 'MODULO', name: 'Módulo', acronym: 'MOD',
  teachingTypeId: 'FP1', group: 'DAM 2A', classroom: 'A1', color: '#123456' };
const tutor = makeTutor('TUT-1', 'DAM 2A');
const sessions = [
  { id: 'S1', activityId: 'TUT-1' }, { id: 'S2', activityId: 'TUT-1' },
  { id: 'S3', activityId: 'MOD-1' },
];
const active = { es_tutor: 'true', grupo_tutoria: 'DAM 1B', actividad_tutoria_id: 'TUT-1' };
const changed = context.reconcileTutorActivityInModel_([tutor, moduleActivity], sessions, active);
assert.strictEqual(changed.id, 'TUT-1');
assert.strictEqual(changed.activities[0].group, 'DAM 1B');
assert.strictEqual(changed.sessions.length, 3);
const draft = { config: { ...active }, schedule: { activities: [tutor, moduleActivity], sessions: [...sessions] } };
context.reconcileNewCourseTutorDraft_(draft);
assert.strictEqual(draft.config.actividad_tutoria_id, 'TUT-1');
assert.strictEqual(draft.schedule.activities[0].group, 'DAM 1B');
draft.config.es_tutor = 'false';
context.reconcileNewCourseTutorDraft_(draft);
assert.strictEqual(draft.schedule.sessions.length, 1);
const disabled = context.reconcileTutorActivityInModel_(changed.activities, sessions,
  { ...active, es_tutor: 'false' });
assert.strictEqual(disabled.id, '');
assert.deepStrictEqual(Array.from(disabled.activities.map(item => item.id)), ['MOD-1']);
assert.deepStrictEqual(Array.from(disabled.sessions.map(item => item.id)), ['S3']);
assert.doesNotThrow(() => context.assertManagedTutorActivity_(changed.activities, active, [tutor, moduleActivity]));
assert.throws(() => context.assertManagedTutorActivity_([moduleActivity], active, [tutor, moduleActivity]),
  /gestiona desde Datos/);

const adopted = context.reconcileTutorActivityInModel_([tutor], [],
  { es_tutor: 'true', grupo_tutoria: 'DAM 2A', actividad_tutoria_id: '' });
assert.strictEqual(adopted.id, 'TUT-1');
const ambiguous = context.reconcileTutorActivityInModel_([tutor, makeTutor('TUT-2', 'DAM 2A')], [],
  { es_tutor: 'true', grupo_tutoria: 'DAM 2A', actividad_tutoria_id: '' });
assert.notStrictEqual(ambiguous.id, 'TUT-1');
assert.notStrictEqual(ambiguous.id, 'TUT-2');

const base = context.addMissingBaseActivities_([]);
assert.deepStrictEqual(Array.from(base.map(item => item.acronym)), ['RD', 'ECDPI', 'PPPP', 'P']);
assert.deepStrictEqual(Array.from(base.map(item => item.name)), [
  'Reunión de Departamento',
  'Tareas de coordinación de centro y elaboración de documentos de planificación institucional',
  'Participación en proyectos, programas o planes de centro',
  'Labores propias del puesto de trabajo',
]);
assert(base.every(item => item.classroom === 'Departamento' && item.color === '#E5E7EB'));
base[0].color = '#ABCDEF';
assert.strictEqual(context.addMissingBaseActivities_(base).length, 4);
assert.strictEqual(context.addMissingBaseActivities_(base, true)[0].color, '#ABCDEF');
const oldMeeting = { ...base[0], acronym: 'R', name: 'Reunión' };
assert.strictEqual(context.addMissingBaseActivities_([oldMeeting]).filter(item => item.category === 'REUNION').length, 2);
const markerConfig = { curso_academico: '2026-2027', actividades_base_curso: '' };
let persistedActivities = [];
context.getGeneralConfigValues_ = () => markerConfig;
context.getScheduleActivities_ = () => persistedActivities;
context.persistScheduleConfig_ = (_book, payload) => { persistedActivities = payload.activities; };
context.updateConfigValues_ = (_sheet, values) => Object.assign(markerConfig, values);
context.syncStudentGroupValidation_ = () => {};
const book = { getSheetByName: () => ({}) };
context.seedBaseScheduleActivities_(book);
assert.strictEqual(persistedActivities.length, 4);
persistedActivities[0].color = '#ABCDEF';
persistedActivities.pop();
context.seedBaseScheduleActivities_(book);
assert.strictEqual(persistedActivities.length, 3);
assert.strictEqual(persistedActivities[0].color, '#ABCDEF');
markerConfig.curso_academico = '2027-2028';
context.seedBaseScheduleActivities_(book);
assert.strictEqual(persistedActivities.length, 4);
let liveActivities = [tutor, moduleActivity];
let liveSessions = sessions;
context.getScheduleActivities_ = () => liveActivities;
context.getWeeklySchedule_ = () => liveSessions;
context.persistScheduleConfig_ = (_book, payload, section) => {
  if (section === 'activities') liveActivities = payload.activities;
  if (section === 'sessions') liveSessions = payload.sessions;
};
const existingTutorConfig = { actividad_tutoria_id: 'TUT-1' };
assert.strictEqual(context.syncManagedTutorActivity_(book, active, existingTutorConfig), 'TUT-1');
assert.strictEqual(liveActivities[0].group, 'DAM 1B');
assert.strictEqual(liveSessions.length, 3);
assert.strictEqual(context.syncManagedTutorActivity_(book,
  { ...active, es_tutor: 'false' }, existingTutorConfig), '');
assert.deepStrictEqual(Array.from(liveActivities.map(item => item.id)), ['MOD-1']);
assert.deepStrictEqual(Array.from(liveSessions.map(item => item.id)), ['S3']);

const institutional = base.map(item => ({ ...item, teachingTypeId: 'FP1', group: 'X' }));
institutional.push({ id: 'G', category: 'GUARDIA', name: 'Guardia', acronym: 'G',
  teachingTypeId: 'FP1', group: 'X', classroom: 'Sala de Profesores', color: '#E5E7EB' });
assert(context.normalizeScheduleActivities_(institutional).every(item => !item.teachingTypeId && !item.group));
const manualTutor = { ...makeTutor('MANUAL', 'ASIR 1A'), teachingTypeId: 'FP1' };
const normalizedManualTutor = context.normalizeScheduleActivities_([manualTutor])[0];
assert.strictEqual(normalizedManualTutor.group, 'ASIR 1A');
assert.strictEqual(normalizedManualTutor.teachingTypeId, '');
const legacy = { id: 'D1', category: 'DUAL', name: 'Dual', acronym: 'D',
  teachingTypeId: '', group: '', classroom: '', color: '#E5E7EB' };
assert.strictEqual(context.normalizeScheduleActivities_([legacy], [legacy])[0].category, 'DUAL');
assert.throws(() => context.normalizeScheduleActivities_([legacy]), /categoría/);

const scheduleHtml = fs.readFileSync('UiDialogScheduleConfig.html', 'utf8');
assert(scheduleHtml.includes('Dual (legado)'));
assert(scheduleHtml.includes('Gestionada desde Datos del docente y centro'));
const generalHtml = fs.readFileSync('UiDialogGeneralConfig.html', 'utf8');
const wizardHtml = fs.readFileSync('UiDialogNewCourse.html', 'utf8');
assert(generalHtml.includes('id="es_tutor" type="checkbox"'));
assert(generalHtml.includes('id="grupo_tutoria" name="grupo_tutoria" type="text"'));
assert(generalHtml.includes('Dejar de ser tutor/a'));
assert(wizardHtml.includes('name="es_tutor" type="checkbox"'));
assert(wizardHtml.includes('name="grupo_tutoria" type="text"'));
assert(wizardHtml.includes('confirmTutorRemoval()'));
assert(wizardHtml.includes("'Tutoría · '+data.tutorGroup"));
assert(fs.readFileSync('UiSidebar.html', 'utf8').includes('display:table;margin:0 auto'));
console.log('tutoring, base activities, categories and VIRTUAL: ok');
