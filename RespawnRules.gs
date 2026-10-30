// ==============================
// Boss-specific respawn map rules
// ==============================

// Every currently supported canonical boss is listed here. Future bosses
// omitted here keep all-map behavior until their native map is configured.
// Values are compared case-insensitively after whitespace normalization.
const RESPAWN_ALLOWED_MAPS = {
  'Core Magriffy': ['Nars'],
  'God of Darkness': ['Swamp of Darkness'],
  'Lord of Ferea': ['Ferea'],
  'Lord Silvester': ['Urk Mountain'],
  'Nightmare': ['Kanturu'],
  'Nix': ['Nixies Lake'],
  'Selupan': ['Raklion']
};

// Bump this value whenever a map rule changes so each spreadsheet repairs its
// stored history exactly once after receiving the new script version.
const RESPAWN_MAP_RULES_VERSION = '2026-08-07-v2';
const RESPAWN_MAP_RULES_PROPERTY = 'BOSSLOG_RESPAWN_MAP_RULES_VERSION';

function getRespawnHours_(monster, map) {
  const rawMonster = String(monster == null ? '' : monster).trim();
  const canonicalMonster = ALIAS[rawMonster] || rawMonster;
  const hours = HOURS[rawMonster] != null
    ? HOURS[rawMonster]
    : HOURS[canonicalMonster];

  if (hours == null || !isRespawnMapAllowed_(canonicalMonster, map)) return null;
  return hours;
}

function getAllowedRespawnMaps_(monster) {
  const rawMonster = String(monster == null ? '' : monster).trim();
  const canonicalMonster = ALIAS[rawMonster] || rawMonster;
  return RESPAWN_ALLOWED_MAPS[canonicalMonster] || null;
}

function isRespawnMapAllowed_(monster, map) {
  const allowedMaps = getAllowedRespawnMaps_(monster);
  if (!allowedMaps) return true;

  const normalizedMap = normalizeRespawnRuleText_(map);
  return allowedMaps.some(allowed => (
    normalizeRespawnRuleText_(allowed) === normalizedMap
  ));
}

function normalizeRespawnRuleText_(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').toLowerCase();
}

// Public one-time repair entrypoint, also available from the Boss Log menu.
function repairStoredRespawns() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30 * 1000);

  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('BOSS_LOG');
    if (!sh) throw new Error('BOSS_LOG sheet not found.');

    const cleared = clearDisallowedStoredRespawns_(sh);
    PropertiesService.getDocumentProperties().setProperty(
      RESPAWN_MAP_RULES_PROPERTY,
      RESPAWN_MAP_RULES_VERSION
    );
    SpreadsheetApp.flush();
    console.log('Cleared disallowed stored respawns: ' + cleared);
    return cleared;
  } finally {
    lock.releaseLock();
  }
}

function repairStoredRespawnsIfNeeded_(sh) {
  const props = PropertiesService.getDocumentProperties();
  if (props.getProperty(RESPAWN_MAP_RULES_PROPERTY) === RESPAWN_MAP_RULES_VERSION) {
    return 0;
  }

  const cleared = clearDisallowedStoredRespawns_(sh);
  props.setProperty(RESPAWN_MAP_RULES_PROPERTY, RESPAWN_MAP_RULES_VERSION);
  return cleared;
}

function clearDisallowedStoredRespawns_(sh) {
  const rowCount = Math.max(0, sh.getLastRow() - 1);
  if (!rowCount) return 0;

  // B:E supplies Monster and Map without reading or rewriting timestamp cells.
  const rows = sh.getRange(2, 2, rowCount, 4).getDisplayValues();
  const rangesToClear = [];

  rows.forEach((row, index) => {
    const monster = row[0];
    const map = row[3];
    if (getAllowedRespawnMaps_(monster) && !isRespawnMapAllowed_(monster, map)) {
      const sheetRow = index + 2;
      rangesToClear.push('F' + sheetRow + ':I' + sheetRow);
    }
  });

  if (rangesToClear.length) {
    sh.getRangeList(rangesToClear).clearContent();
  }

  return rangesToClear.length;
}

// Run after changing Ferea's hours: normal refresh preserves existing rows.
function recalculateFereaRespawns() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30 * 1000);

  try {
    const sh = SpreadsheetApp.getActive().getSheetByName('BOSS_LOG');
    if (!sh) throw new Error('BOSS_LOG sheet not found.');

    const updated = recalculateStoredFereaRespawns_(sh);
    SpreadsheetApp.flush();
    console.log('Recalculated Ferea respawns: ' + updated);
    return updated;
  } finally {
    lock.releaseLock();
  }
}

function recalculateStoredFereaRespawns_(sh) {
  const rowCount = Math.max(0, sh.getLastRow() - 1);
  if (!rowCount) return 0;

  const rows = sh.getRange(2, 1, rowCount, 5).getDisplayValues();
  const updates = [];

  // Prepare every value before writing so a malformed kill time cannot cause
  // a partial recalculation. Only F:I of Ferea rows are written.
  rows.forEach((row, index) => {
    const monster = normalizeBossLogKeyPart_(row[1]);
    if ((ALIAS[monster] || monster) !== 'Lord of Ferea') return;

    const hours = getRespawnHours_(monster, row[4]);
    let values = ['', '', '', ''];
    if (hours != null) {
      const killText = normalizeBossLogKillText_(row[0]);
      const kill = Utilities.parseDate(killText, TZ_BR, 'dd/MM/yyyy HH:mm:ss');
      if (Utilities.formatDate(kill, TZ_BR, 'dd/MM/yyyy HH:mm:ss') !== killText) {
        throw new Error('Invalid Ferea kill time at row ' + (index + 2));
      }
      const respawn = new Date(kill.getTime() + Math.round(hours * 3600 * 1000));
      values = [
        hours,
        Utilities.formatDate(respawn, TZ_BR, 'yyyy/MM/dd HH:mm:ss'),
        Utilities.formatDate(respawn, TZ_SE, 'yyyy/MM/dd HH:mm:ss'),
        respawn
      ];
    }

    const sheetRow = index + 2;
    const previous = updates[updates.length - 1];
    if (previous && previous.row + previous.values.length === sheetRow) {
      previous.values.push(values);
    } else {
      updates.push({ row: sheetRow, values: [values] });
    }
  });

  updates.forEach(update => {
    sh.getRange(update.row, 6, update.values.length, 4).setValues(update.values);
  });
  return updates.reduce((count, update) => count + update.values.length, 0);
}
