const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = {
  JSON,
  String,
  Error,
  Math,
  Infinity,
  isNaN,
  parseFloat,
};

vm.createContext(context);
vm.runInContext(fs.readFileSync('CSXS/hostscript.jsx', 'utf8'), context);

function characters(text) {
  return text.split('').map((ch) => ({ ch }));
}

function groups(text) {
  return text.split('').map((name, index) => ({ name, sourceIndex: index }));
}

const forward = groups('ABACA');
assert.deepEqual(
  Array.from(
    context.NGS_LyricMotion_orderCharacterGroups(characters('ABACA'), forward),
    (group) => group.sourceIndex,
  ),
  [0, 1, 2, 3, 4],
  'forward shape order must stay forward',
);

const reversed = groups('ACABA');
assert.deepEqual(
  Array.from(
    context.NGS_LyricMotion_orderCharacterGroups(characters('ABACA'), reversed),
    (group) => group.sourceIndex,
  ),
  [4, 3, 2, 1, 0],
  'reverse shape order must be restored before repeated characters are assigned',
);

assert.equal(
  context.NGS_LyricMotion_orderCharacterGroups(characters('ABC'), groups('AB')),
  null,
  'different character and shape counts must fail',
);

assert.equal(
  context.NGS_LyricMotion_transportText('C:\\Users\\amber\\presets.json'),
  'C:/Users/amber/presets.json',
  'paths returned to CEP must not contain JSON-breaking backslashes',
);

console.log('hostscript logic tests: OK');
