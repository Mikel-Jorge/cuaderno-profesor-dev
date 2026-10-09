const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('UiDialogNewCourse.html', 'utf8');
const match = html.match(/function applyCompletion\(data\)\{[\s\S]*?\n\}/);
assert(match, 'El stepper debe derivarse del resumen guardado.');
const context = { completed: [true, true, false, false, false, false, false], renderStepper() {} };
vm.createContext(context);
vm.runInContext(match[0], context);
context.applyCompletion({ calendar: false, slots: 8, activities: 11, sessions: 0 });
assert.deepStrictEqual(context.completed.slice(2, 6), [false, true, true, false]);
context.applyCompletion({ calendar: true, slots: 8, activities: 11, sessions: 24 });
assert.deepStrictEqual(context.completed.slice(2, 6), [true, true, true, true]);
assert(!html.includes('warnings[currentStep]'));
console.log('new course stepper follows actual saved status: ok');
