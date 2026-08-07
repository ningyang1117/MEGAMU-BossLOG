'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = [
  fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'),
  fs.readFileSync(path.join(__dirname, '..', 'RespawnRules.gs'), 'utf8')
].join('\n');
const context = vm.createContext({
  console,
  Utilities: {
    formatDate(date, timezone, pattern) {
      return pattern + '@' + timezone;
    }
  }
});
vm.runInContext(source, context, { filename: 'Code.gs' });

function evaluate(expression) {
  return vm.runInContext(expression, context);
}

const nativeMapCases = [
  ['Core Magriffy', 'Nars', 84.6],
  ['God of Darkness', 'Swamp of Darkness', 104.0483],
  ['Lord of Ferea', 'Ferea', 94.8564],
  ['Lord Silvester', 'Urk Mountain', 93.13],
  ['Nightmare', 'Kanturu', 40.96],
  ['Nix', 'Nixies Lake', 100.4639],
  ['Selupan', 'Raklion', 34.06]
];

for (const [monster, map, hours] of nativeMapCases) {
  context.testMonster = monster;
  context.testMap = map;
  assert.equal(evaluate('getRespawnHours_(testMonster, testMap)'), hours);
  assert.equal(evaluate("getRespawnHours_(testMonster, 'Temporary Event Map')"), null);
}

assert.equal(evaluate("getRespawnHours_('Selupan', ' raklion ' )"), 34.06);
assert.equal(evaluate("getRespawnHours_('Selupan', 'Noria')"), null);
assert.equal(evaluate("getRespawnHours_('Selupan', 'Lorencia')"), null);
assert.equal(evaluate("getRespawnHours_('Selupan', 'Devias')"), null);
assert.equal(evaluate("getRespawnHours_('Nightmare', 'Noria')"), null);
assert.equal(evaluate("getRespawnHours_('Nix', 'Crywolf')"), null);
assert.equal(evaluate("getRespawnHours_('Lord Ferea', 'Ferea')"), 94.8564);
assert.equal(evaluate("getRespawnHours_('Core Magrifty', 'Nars')"), 84.6);
assert.equal(evaluate("getRespawnHours_('God Darkness', 'Swamp of Darkness')"), 104.0483);

context.markdownFixture = [
  '| 07/08/2026 03:56:27 | Selupan | EventPlayer | Sv14 | Noria |',
  '| 07/08/2026 03:55:27 | Selupan | BossPlayer | Sv14 | Raklion |',
  '| 07/08/2026 03:54:27 | Nightmare | OtherBoss | Sv14 | Kanturu |',
  '| 07/08/2026 03:53:27 | Nightmare | EventPlayer2 | Sv14 | Devias |'
].join('\n');
const parsed = evaluate('parseBossLogMarkdownTable_(markdownFixture).rows');

assert.deepEqual(Array.from(parsed[0].slice(5)), ['', '', '', null]);
assert.equal(parsed[1][5], 34.06);
assert.notEqual(parsed[1][6], '');
assert.notEqual(parsed[1][7], '');
assert.ok(parsed[1][8]);
assert.equal(parsed[2][5], 40.96);
assert.deepEqual(Array.from(parsed[3].slice(5)), ['', '', '', null]);

const clearedRanges = [];
context.repairSheetFixture = {
  getLastRow() {
    return 7;
  },
  getRange() {
    return {
      getDisplayValues() {
        return [
          ['Selupan', 'Player1', 'Sv1', 'Noria'],
          ['Selupan', 'Player2', 'Sv2', 'Raklion'],
          ['Nightmare', 'Player3', 'Sv3', 'Kanturu'],
          ['Selupan', 'Player4', 'Sv4', 'Devias'],
          ['Nightmare', 'Player5', 'Sv5', 'Lorencia'],
          ['Nix', 'Player6', 'Sv6', 'Crywolf']
        ];
      }
    };
  },
  getRangeList(ranges) {
    return {
      clearContent() {
        clearedRanges.push(...ranges);
      }
    };
  }
};

assert.equal(evaluate('clearDisallowedStoredRespawns_(repairSheetFixture)'), 4);
assert.deepEqual(clearedRanges, ['F2:I2', 'F5:I5', 'F6:I6', 'F7:I7']);

console.log('respawn_map_rules.test.js: PASS');
