'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function formatDate(date, timezone, pattern) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map(part => [part.type, part.value]));
  const time = `${parts.hour}:${parts.minute}:${parts.second}`;
  return pattern === 'dd/MM/yyyy HH:mm:ss'
    ? `${parts.day}/${parts.month}/${parts.year} ${time}`
    : `${parts.year}/${parts.month}/${parts.day} ${time}`;
}

const context = vm.createContext({ console, Utilities: {
  formatDate,
  parseDate(text, timezone, pattern) {
    assert.equal(timezone, 'America/Sao_Paulo');
    assert.equal(pattern, 'dd/MM/yyyy HH:mm:ss');
    const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!match) throw new Error('Invalid date: ' + text);
    return new Date(Date.UTC(+match[3], +match[2] - 1, +match[1],
      +match[4] + 3, +match[5], +match[6]));
  }
} });
const source = ['Code.gs', 'History.gs', 'RespawnRules.gs']
  .map(file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).join('\n');
vm.runInContext(source, context);
const evaluate = expression => vm.runInContext(expression, context);

const fixtures = [
  ['26/10/2026 19:11:43', 'Lord of Ferea', 'Douha', 'Sv8', 'Ferea'],
  ['30/10/2026 17:45:02', 'Lord Ferea', 'MrMyzor', 'Sv8', 'Ferea'],
  ['30/10/2026 17:00:00', 'Selupan', 'Player', 'Sv1', 'Raklion'],
  ['30/10/2026 16:00:00', 'Lord of Ferea', 'Event', 'Sv1', 'Noria']
];
const writes = [];
context.sheet = {
  getLastRow: () => fixtures.length + 1,
  getRange(row, column, count, width) {
    if (column === 1) {
      assert.deepEqual([row, count, width], [2, fixtures.length, 5]);
      return { getDisplayValues: () => fixtures };
    }
    assert.equal(column, 6);
    assert.equal(width, 4);
    return { setValues: values => writes.push({ row, count, values }) };
  }
};

assert.equal(evaluate('recalculateStoredFereaRespawns_(sheet)'), 3);
assert.deepEqual(writes.map(write => [write.row, write.count]), [[2, 2], [5, 1]]);
const values = writes[0].values;
assert.equal(values[0][0], 340399 / 3600);
assert.equal(values[0][1], '2026/10/30 17:45:02');
assert.equal(values[0][2], '2026/10/30 21:45:02');
assert.equal(values[0][3].toISOString(), '2026-10-30T20:45:02.000Z');
assert.equal(values[1][1], '2026/11/03 16:18:21');
assert.equal(values[1][2], '2026/11/03 20:18:21');
assert.deepEqual(Array.from(writes[1].values[0]), ['', '', '', '']);

context.fixtureText = '| 26/10/2026 19:11:43 | Lord of Ferea | Douha | Sv8 | Ferea |';
const parsed = evaluate('parseBossLogMarkdownTable_(fixtureText).rows[0]');
assert.equal(parsed[6], values[0][1]);
assert.equal(parsed[7], values[0][2]);
assert.equal(parsed[8].toISOString(), values[0][3].toISOString());

// Re-running uses the original kill timestamp and cannot subtract twice.
writes.length = 0;
evaluate('recalculateStoredFereaRespawns_(sheet)');
assert.equal(writes[0].values[0][1], '2026/10/30 17:45:02');

// A bad timestamp must fail before any of the prepared rows are written.
writes.length = 0;
fixtures[1][0] = 'invalid timestamp';
assert.throws(() => evaluate('recalculateStoredFereaRespawns_(sheet)'), /Invalid date/);
assert.equal(writes.length, 0);

console.log('ferea_recalculation.test.js: PASS');
