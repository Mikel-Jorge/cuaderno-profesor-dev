const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('UiDialogNewCourse.html', 'utf8');
const names = ['stepState', 'applySelectedTheme'];
const functions = names.map(name => {
  const match = html.match(new RegExp(`function ${name}\\([^\n]*`));
  assert(match, `${name} debe existir`);
  return match[0];
}).join('\n');
const colors = { primary: '#1F6E8C', secondary: '#355070', accent: '#A65B7C' };
const controls = { tema_preset: { value: 'atlantico' }, tema_primary: { value: '' },
  tema_secondary: { value: '' }, tema_accent: { value: '' } };
const context = vm.createContext({
  currentStep: 1,
  summary: { steps: [0, 1, 2, 3, 4, 5, 6].map(index => ({
    visited: index < 2, reviewed: index === 0, complete: index === 0, reason: '',
  })) },
  THEME: { presets: [{ id: 'atlantico', colors }] }, form: { elements: controls },
});
vm.runInContext(functions, context);
assert.strictEqual(context.stepState(0), 'done');
assert.strictEqual(context.stepState(1), 'current');
assert.strictEqual(context.stepState(2), 'unvisited');
assert.strictEqual(context.stepState(3), 'unvisited', 'los tramos conservados no se marcan visitados');
context.summary.steps[2].visited = true;
context.summary.steps[2].reviewed = true;
context.summary.steps[2].reason = 'No hay ningún tipo de enseñanza activo.';
context.currentStep = 3;
assert.strictEqual(context.stepState(2), 'warning');
assert.strictEqual(context.summary.steps[2].reason, 'No hay ningún tipo de enseñanza activo.');
context.summary.steps[3].visited = true;
context.summary.steps[3].reviewed = true;
context.summary.steps[3].complete = true;
context.currentStep = 4;
assert.strictEqual(context.stepState(3), 'done');
context.summary.steps[5].visited = true;
context.summary.steps[5].reviewed = true;
assert.strictEqual(context.stepState(5), 'warning');
assert.strictEqual(context.stepState(4), 'current');
context.applySelectedTheme();
assert.deepStrictEqual([controls.tema_primary.value, controls.tema_secondary.value,
  controls.tema_accent.value], ['#1f6e8c', '#355070', '#a65b7c']);
assert.strictEqual(controls.tema_preset.value, 'atlantico');
assert(html.includes('button.disabled=busy||finalPhase>0||!summary.steps[index].visited'));
assert(html.includes("button.addEventListener('click',function(){if(index!==currentStep)showStep(index)}"));
assert(html.includes('const general=data.steps[1]'));
assert(html.includes("card.addEventListener('click',function(){showStep(item[0])}"));
assert(html.includes('course-wizard-measure'));
assert(html.includes("frame.setAttribute('scrolling','no')"));
assert(!html.includes('min-height:510px'));
assert(!html.includes('Las actividades conservan sus identificadores'));
assert(html.includes('course-loading'));
console.log('wizard visited, warnings, errors, navigation and theme selector: ok');
