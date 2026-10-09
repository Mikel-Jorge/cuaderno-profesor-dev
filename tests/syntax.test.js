const fs = require('fs');
const vm = require('vm');
for (const file of fs.readdirSync('.').filter(name => name.endsWith('.gs'))) {
  new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
}
for (const file of fs.readdirSync('.').filter(name => name.endsWith('.html'))) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    new vm.Script(match[1].replace(/<\?[\s\S]*?\?>/g, 'null'), { filename: file });
  }
}
console.log('Apps Script and HTML scripts syntax: ok');
