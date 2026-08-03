'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = [
  fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'),
  fs.readFileSync(path.join(__dirname, '..', 'History.gs'), 'utf8')
].join('\n');
const context = vm.createContext({ console });
vm.runInContext(source, context, { filename: 'Code.gs' });

function evaluate(expression) {
  return vm.runInContext(expression, context);
}

assert.equal(
  evaluate("normalizeBossLogKillText_('03/08/2026 4:58:22')"),
  '03/08/2026 04:58:22'
);
assert.equal(
  evaluate("normalizeBossLogKillText_('2026-08-03 04:58:22')"),
  '03/08/2026 04:58:22'
);

const existingRows = [
  ['03/08/2026 4:58:22', 'Nightmare', 'SolrakDVDL', 'Sv7', 'Kanturu'],
  ['03/08/2026 4:41:55', 'Nightmare', 'GiLiOOO', 'Sv8', 'Kanturu']
];
const incomingRows = [
  ['03/08/2026 05:10:00', 'Selupan', 'NewPlayer', 'Sv1', 'Raklion', 34.06, '', '', null],
  ['03/08/2026 04:58:22', 'Nightmare', 'SolrakDVDL', 'Sv7', 'Kanturu', 40.96, '', '', null],
  ['03/08/2026 04:58:22', 'Nightmare', 'SolrakDVDL', 'Sv7', 'Kanturu', 40.96, '', '', null]
];

context.existingRowsFixture = existingRows;
context.incomingRowsFixture = incomingRows;
const selected = evaluate('selectNewBossLogRows_(incomingRowsFixture, existingRowsFixture)');

assert.equal(selected.length, 1);
assert.deepEqual(Array.from(selected[0].slice(0, 5)), incomingRows[0].slice(0, 5));

console.log('boss_log_history.test.js: PASS');
