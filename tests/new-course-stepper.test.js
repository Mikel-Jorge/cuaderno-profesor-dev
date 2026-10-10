const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('UiDialogNewCourse.html', 'utf8');
const names = ['stepComplete', 'stepReason', 'stepState', 'applySelectedTheme'];
const functions = names.map(name => {
  const match = html.match(new RegExp(`function ${name}\\([^\n]*`));
  assert(match, `${name} debe existir`);
  return match[0];
}).join('\n');
const colors = { primary: '#1F6E8C', secondary: '#355070', accent: '#A65B7C' };
const controls = { tema_preset: { value: 'atlantico' }, tema_primary: { value: '' },
  tema_secondary: { value: '' }, tema_accent: { value: '' } };
const context = vm.createContext({
  currentStep: 1, errorStep: null,
  visited: [true, true, false, false, false, false, false],
  reviewed: [true, false, false, false, false, false, false],
  summary: { calendar: false, slots: 8, activities: 4, sessions: 0,
    reasons: { calendar: 'No hay ningún tipo de enseñanza activo.', sessions: 'No hay sesiones asignadas.' } },
  THEME: { presets: [{ id: 'atlantico', colors }] }, form: { elements: controls },
});
vm.runInContext(functions, context);
assert.strictEqual(context.stepState(0), 'done');
assert.strictEqual(context.stepState(1), 'current');
assert.strictEqual(context.stepState(2), 'unvisited');
assert.strictEqual(context.stepState(3), 'unvisited', 'los tramos conservados no se marcan visitados');
context.visited[2] = true;
context.reviewed[2] = true;
context.currentStep = 3;
assert.strictEqual(context.stepState(2), 'warning');
assert.strictEqual(context.stepReason(2), 'No hay ningún tipo de enseñanza activo.');
context.visited[3] = true;
context.reviewed[3] = true;
context.currentStep = 4;
assert.strictEqual(context.stepState(3), 'done');
context.visited[5] = true;
context.reviewed[5] = true;
assert.strictEqual(context.stepState(5), 'warning');
context.errorStep = 4;
assert.strictEqual(context.stepState(4), 'current');
context.applySelectedTheme();
assert.deepStrictEqual([controls.tema_primary.value, controls.tema_secondary.value,
  controls.tema_accent.value], ['#1f6e8c', '#355070', '#a65b7c']);
assert.strictEqual(controls.tema_preset.value, 'atlantico');
assert(html.includes('button.disabled=busy||finalPhase>0||!visited[index]'));
assert(html.includes("button.addEventListener('click',function(){if(index!==currentStep)showStep(index)}"));
assert(html.includes('const complete=stepComplete(item[0])'));
assert(html.includes('course-wizard-measure'));
assert(html.includes("frame.setAttribute('scrolling','no')"));
assert(!html.includes('min-height:510px'));
assert(!html.includes('Las actividades conservan sus identificadores'));
assert(html.includes('course-loading'));
console.log('wizard visited, warnings, errors, navigation and theme selector: ok');
