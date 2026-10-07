const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({
  Utilities: { formatDate(date, _timeZone, pattern) {
    if (pattern === 'u') return String(date.getUTCDay() || 7);
    if (pattern === 'yyyyMMdd') return date.toISOString().slice(0, 10).replace(/-/g, '');
    return date.toISOString().slice(0, 10);
  }, parseDate(value) { return new Date(value + 'T12:00:00Z'); },
  getUuid() { return '12345678-1234-1234-1234-123456789012'; } },
  parseAcademicYear_: () => ({ startYear: 2026, endYear: 2027 }),
  parseCalendarDate_: value => new Date(value + 'T12:00:00Z'),
  createCalendarRecordId_: () => 'new-id',
  compareCalendarDates_: (first, second) => first.getTime() - second.getTime(),
});
vm.runInContext(fs.readFileSync('Calendar.gs', 'utf8'), context);

const events = context.buildDefaultCalendarEventsForAcademicYear_('2026-2027', 'UTC');
const holyWeek = events.filter(event => event.description === 'Semana Santa');
assert.equal(holyWeek.length, 1);
assert.equal(events.some(event => event.description === 'Vacaciones de Semana Santa'), false);
assert.equal(holyWeek[0].startDate.toISOString().slice(0, 10), '2027-03-25');
assert.equal(holyWeek[0].endDate.toISOString().slice(0, 10), '2027-04-02');
for (const date of ['2027-03-25', '2027-03-26', '2027-03-29',
  '2027-03-30', '2027-03-31', '2027-04-01', '2027-04-02']) {
  assert.equal(context.isDateInsideCalendarEvent_(new Date(date + 'T12:00:00Z'),
    holyWeek[0], 'UTC'), true, date);
}

const legacy = [
  { id: 'first', startDate: '2027-03-25', endDate: '2027-03-26',
    category: 'FESTIVO', appliesToAll: true, typeIds: [], description: 'Semana Santa' },
  { id: 'second', startDate: '2027-03-29', endDate: '2027-04-02',
    category: 'FESTIVO', appliesToAll: true, typeIds: [], description: 'Vacaciones de Semana Santa' },
];
const collapsed = context.collapseLegacyHolyWeekEventsForUi_(legacy);
assert.equal(collapsed.length, 1);
assert.equal(collapsed[0].id, 'first');
assert.equal(collapsed[0].endDate, '2027-04-02');
assert.equal(collapsed[0].description, 'Semana Santa');
assert.equal(legacy[0].endDate, '2027-03-26'); // La lectura no escribe en el modelo.
assert.equal(context.collapseLegacyHolyWeekEventsForUi_(collapsed).length, 1);
assert.equal(context.collapseLegacyHolyWeekEventsForUi_([
  legacy[0], { ...legacy[1], typeIds: ['FP2'], appliesToAll: false },
]).length, 2);
console.log('Holy Week preload, teaching dates and legacy UI grouping passed');
