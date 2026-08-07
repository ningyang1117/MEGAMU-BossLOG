// ==============================
// Persistent BOSS_LOG history
// ==============================
const BOSS_LOG_HEADERS = [
  'Kill (Brazil/BRT)', 'Monster', 'Player', 'Server', 'Map',
  'Respawn hours', 'Respawn (Brazil/BRT)', 'Respawn (Sweden)', 'Respawn (Beijing)'
];

// The source currently exposes 500 rows. Scanning twice that amount is enough
// to overlap the previous source window while keeping one-minute refreshes fast.
const HISTORY_DEDUPE_MIN_ROWS = 1000;

function ensureBossLogSheet_(ss) {
  let sh = ss.getSheetByName('BOSS_LOG');
  if (!sh) sh = ss.insertSheet('BOSS_LOG');

  const currentHeader = sh.getRange(1, 1, 1, BOSS_LOG_HEADERS.length).getDisplayValues()[0];
  if (currentHeader.join('\u001f') !== BOSS_LOG_HEADERS.join('\u001f')) {
    sh.getRange(1, 1, 1, BOSS_LOG_HEADERS.length).setValues([BOSS_LOG_HEADERS]);
  }

  return sh;
}

function prependNewBossLogRows_(sh, incomingRows) {
  const existingCount = Math.max(0, sh.getLastRow() - 1);
  const scanCount = Math.min(
    existingCount,
    Math.max(HISTORY_DEDUPE_MIN_ROWS, incomingRows.length * 2)
  );

  // Display values deliberately preserve the legacy dd/MM text visible in
  // column A, including rows that an en_US sheet previously parsed as dates.
  const existingRows = scanCount
    ? sh.getRange(2, 1, scanCount, 5).getDisplayValues()
    : [];
  const newRows = selectNewBossLogRows_(incomingRows, existingRows);

  if (!newRows.length) {
    return { added: 0, total: existingCount };
  }

  if (existingCount) {
    // Inserting below the header also expands fixed pivot-table source ranges.
    sh.insertRowsBefore(2, newRows.length);
  } else if (sh.getMaxRows() < newRows.length + 1) {
    sh.insertRowsAfter(sh.getMaxRows(), newRows.length + 1 - sh.getMaxRows());
  }

  // Keep kill timestamps as literal BRT text. This avoids en_US locale parsing
  // dd/MM as MM/dd for dates where both numbers are <= 12.
  sh.getRange(2, 1, newRows.length, 1).setNumberFormat('@');
  sh.getRange(2, 1, newRows.length, BOSS_LOG_HEADERS.length).setValues(newRows);
  sh.getRange(2, 7, newRows.length, 3).setNumberFormat('yyyy/MM/dd HH:mm:ss');

  return { added: newRows.length, total: existingCount + newRows.length };
}

function selectNewBossLogRows_(incomingRows, existingRows) {
  const seen = new Set();

  for (const row of existingRows) {
    const key = bossLogEventKey_(row);
    if (key) seen.add(key);
  }

  const newRows = [];
  for (const row of incomingRows) {
    const key = bossLogEventKey_(row);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    newRows.push(row);
  }

  return newRows;
}

function bossLogEventKey_(row) {
  if (!row || row.length < 5) return '';

  const kill = normalizeBossLogKillText_(row[0]);
  const monster = normalizeBossLogKeyPart_(row[1]);
  const player = normalizeBossLogKeyPart_(row[2]);
  const server = normalizeBossLogKeyPart_(row[3]);
  const map = normalizeBossLogKeyPart_(row[4]);

  if (!kill || !monster || !server) return '';
  return [kill, monster, player, server, map].join('\u001f');
}

function normalizeBossLogKillText_(value) {
  const text = normalizeBossLogKeyPart_(value);
  let m = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);

  if (m) {
    return pad2_(m[1]) + '/' + pad2_(m[2]) + '/' + m[3] + ' ' +
      pad2_(m[4]) + ':' + m[5] + ':' + m[6];
  }

  m = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) {
    return pad2_(m[3]) + '/' + pad2_(m[2]) + '/' + m[1] + ' ' +
      pad2_(m[4]) + ':' + m[5] + ':' + m[6];
  }

  return text;
}

function normalizeBossLogKeyPart_(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
}

function pad2_(value) {
  return String(value).padStart(2, '0');
}
