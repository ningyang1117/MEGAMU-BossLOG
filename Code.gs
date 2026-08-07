// ==============================
// Boss Log Auto Refresh (FINAL+)
// - Multi-source fetch (prefer en domain via jina)
// - More fallback sources
// - Validate real markdown boss-log table before accepting
// - Cloudflare/CAPTCHA detection
// - Cache last-good text (DocumentProperties)
// - Preserve every unique row already stored in BOSS_LOG
// - Insert only new rows; never replace history
// - Write refresh/failure status to:
//   Summary!B2 / A2       = Beijing
//   Summary(SE)!B2 / A2   = Sweden
//   Summary(BR)!B2 / A2   = Brazil/BRT
// ==============================

// ===== Settings =====
const SOURCES = [
  // 1) Best: en domain via Jina Reader
  'https://r.jina.ai/http://en.megamu.net/boss-log',
  'https://r.jina.ai/https://en.megamu.net/boss-log',

  // 2) vi domain via Jina Reader (same data, fallback)
  'https://r.jina.ai/http://vi.megamu.net/boss-log',
  'https://r.jina.ai/https://vi.megamu.net/boss-log',

  // 3) root domain via Jina Reader
  'https://r.jina.ai/http://megamu.net/boss-log',
  'https://r.jina.ai/https://megamu.net/boss-log',

  // 4) www domain via Jina Reader
  'https://r.jina.ai/http://www.megamu.net/boss-log',
  'https://r.jina.ai/https://www.megamu.net/boss-log',

  // 5) Direct fallback, mostly for diagnostics
  'https://en.megamu.net/boss-log',
  'http://en.megamu.net/boss-log',
  'https://vi.megamu.net/boss-log',
  'http://vi.megamu.net/boss-log',
  'https://megamu.net/boss-log',
  'http://megamu.net/boss-log'
];

const TZ_BR = 'America/Sao_Paulo';   // Brazil (BRT, UTC-3)
const TZ_SE = 'Europe/Stockholm';    // Sweden (CET/CEST)
const TZ_CN = 'Asia/Shanghai';       // Beijing (UTC+8)

// Respawn hours (decimals supported)
const HOURS = {
  'Selupan':         34.06,
  'Nightmare':       40.96,
  'Nix':             100.4639,
  'Lord Silvester':  93.13,
  'Lord Ferea':      94.8564,
  'Lord of Ferea':   94.8564,
  'Core Magriffy':   84.6,
  'Core Magrifty':   84.6,
  'God of Darkness': 104.0483
};

// Optional alias fallback
const ALIAS = {
  'Lord Ferea':       'Lord of Ferea',
  'Core Magrifty':    'Core Magriffy',
  'God-of-Darkness':  'God of Darkness',
  'God Darkness':     'God of Darkness'
};

// Cache keys
const CACHE_KEY = 'BOSSLOG_LAST_GOOD_TEXT';
const CACHE_SOURCE_KEY = 'BOSSLOG_LAST_GOOD_SOURCE';
const CACHE_TIME_KEY = 'BOSSLOG_LAST_GOOD_TIME';

// ===== Menu =====
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Boss Log')
    .addItem('Refresh now', 'refreshBossLog')
    .addItem('Repair stored respawns', 'repairStoredRespawns')
    .addToUi();
}

// ===== Main =====
function refreshBossLog() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30 * 1000);

  try {
    const ss = SpreadsheetApp.getActive();

    // 1) Fetch text (multi-source + cache fallback)
    const result = fetchBossLogTextWithCacheMulti_();
    const text = result.text;

    // 2) Parse markdown table -> rows
    const parsed = parseBossLogMarkdownTable_(text);

    if (!parsed.rows.length) {
      throw new Error('Parsed 0 rows (maybe blocked/HTML). Keeping existing sheet data.');
    }

    // 3) Keep BOSS_LOG as persistent history and insert only unseen events.
    const sh = ensureBossLogSheet_(ss);
    prependNewBossLogRows_(sh, parsed.rows);
    repairStoredRespawnsIfNeeded_(sh);

    SpreadsheetApp.flush();

    // 4) Stamp refresh time + status on all Summary tabs
    if (result.fromCache) {
      writeRefreshStatusAllSheets_(
        'CACHE',
        'Using cached data | Last good source: ' + (result.source || 'CACHE')
      );
    } else {
      writeRefreshStatusAllSheets_('SUCCESS', '');
    }

  } catch (e) {
    console.error(String(e));

    // IMPORTANT: DO NOT touch pivot area. Use A2 for status.
    writeRefreshStatusAllSheets_(
      'FAILED',
      'Last fetch failed | ' + String(e).slice(0, 250)
    );

    // Keep error visible in execution log
    throw e;

  } finally {
    lock.releaseLock();
  }
}

// ==============================
// Write status to Summary tabs
// ==============================
function writeRefreshStatusAllSheets_(status, message) {
  const ss = SpreadsheetApp.getActive();
  const now = new Date();

  writeRefreshStatusOneSheet_(ss, 'Summary',     TZ_CN, 'Beijing', status, message, now);
  writeRefreshStatusOneSheet_(ss, 'Summary(SE)', TZ_SE, 'Sweden',  status, message, now);
  writeRefreshStatusOneSheet_(ss, 'Summary(BR)', TZ_BR, 'Brazil',  status, message, now);
}

function writeRefreshStatusOneSheet_(ss, sheetName, timezone, label, status, message, now) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return; // do not create missing summary tabs automatically

  const timeText = Utilities.formatDate(now, timezone, 'yyyy-MM-dd HH:mm:ss');

  // B2 = refresh timestamp, localized per tab
  sh.getRange('B2').setValue('Last refreshed: ' + timeText + ' (' + label + ')');

  // A2 = status / failure / cache message, localized per tab
  if (status === 'SUCCESS') {
    sh.getRange('A2').clearContent();
  } else if (status === 'CACHE') {
    sh.getRange('A2').setValue(timeText + ' (' + label + ') | ' + message);
  } else if (status === 'FAILED') {
    sh.getRange('A2').setValue(timeText + ' (' + label + ') | ' + message);
  }
}

// ==============================
// Fetch helpers
// ==============================
function fetchBossLogTextWithCacheMulti_() {
  const props = PropertiesService.getDocumentProperties();
  const cached = props.getProperty(CACHE_KEY);
  const cachedSource = props.getProperty(CACHE_SOURCE_KEY);
  const cachedTime = props.getProperty(CACHE_TIME_KEY);

  // Cache-buster to avoid proxy caching
  const ts = Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHHmmss');

  let lastErr = '';
  let lastHttp = '';

  for (const baseUrl of SOURCES) {
    const url = baseUrl + (baseUrl.indexOf('?') >= 0 ? '&' : '?') + 't=' + ts;

    try {
      const res = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      const code = res.getResponseCode();
      lastHttp = String(code);

      const body = res.getContentText('UTF-8') || '';

      const blocked = looksBlocked_(code, body);
      const validTable = looksLikeBossLogTable_(body);

      if (code >= 200 && code < 300 && !blocked && validTable) {
        props.setProperty(CACHE_KEY, body);
        props.setProperty(CACHE_SOURCE_KEY, baseUrl);
        props.setProperty(CACHE_TIME_KEY, Utilities.formatDate(new Date(), TZ_CN, 'yyyy-MM-dd HH:mm:ss'));

        return {
          text: body,
          fromCache: false,
          source: baseUrl,
          httpCode: code
        };
      }

      lastErr = `URL=${baseUrl} HTTP=${code} blocked=${blocked} validTable=${validTable} len=${body.length}`;

    } catch (err) {
      lastErr = `URL=${baseUrl} ERR=${String(err)}`;
    }
  }

  // All sources failed -> use cache if available and valid
  if (cached && cached.length > 200 && looksLikeBossLogTable_(cached) && !looksBlocked_(200, cached)) {
    console.warn(
      'All sources failed. Using cached last-good text. LastHTTP=' +
      lastHttp +
      ' | ' +
      lastErr
    );

    return {
      text: cached,
      fromCache: true,
      source: cachedSource || ('CACHE at ' + (cachedTime || 'unknown time')),
      httpCode: lastHttp
    };
  }

  throw new Error('All sources blocked/failed and no cache available. LastHTTP=' + lastHttp + ' | ' + lastErr);
}

function looksBlocked_(code, body) {
  const lower = String(body || '').toLowerCase();

  return (
    code === 403 ||
    code === 429 ||
    lower.includes('just a moment') ||
    lower.includes('cf-browser-verification') ||
    lower.includes('cf-ray') ||
    lower.includes('captcha') ||
    lower.includes('cloudflare') ||
    lower.includes('access denied') ||
    lower.includes('forbidden') ||
    lower.includes('target url returned error 403')
  );
}

function looksLikeBossLogTable_(body) {
  const text = String(body || '');

  // Must contain at least one date-like table row.
  // MEGAMU/Jina has emitted both dd/MM/yyyy and yyyy-MM-dd formats.
  const hasDateRow = /\|\s*(?:\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\s+\d{1,2}:\d{2}:\d{2}\s*\|/.test(text);
  if (!hasDateRow) return false;

  // Must contain likely boss-log fields
  const lower = text.toLowerCase();
  const hasKnownBoss =
    lower.includes('selupan') ||
    lower.includes('nightmare') ||
    lower.includes('nix') ||
    lower.includes('lord silvester') ||
    lower.includes('lord of ferea') ||
    lower.includes('core magriffy') ||
    lower.includes('god of darkness');

  if (!hasKnownBoss) return false;

  // Avoid accepting tiny fragments
  const pipeRows = text
    .split('\n')
    .filter(line => {
      const s = line.trim();
      return s.startsWith('|') && !s.replace(/ /g, '').startsWith('|---');
    }).length;

  return pipeRows >= 5;
}

// ==============================
// Parse helpers
// Expect markdown table rows like:
// | dd/MM/yyyy HH:mm:ss | Monster | Player | Server | Map |
// | yyyy-MM-dd HH:mm:ss | Monster | Player | Server | Map |
// ==============================
function parseBossLogMarkdownTable_(text) {
  const lines = String(text || '').split('\n');
  const rows = [];

  // Supports 1-2 digit hour and both known source date formats.
  const reDMY = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/;
  const reYMD = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})$/;
  const fmt = (d, tz, pattern) => d ? Utilities.formatDate(d, tz, pattern) : '';

  for (const line of lines) {
    const s = line.trim();
    if (!s.startsWith('|')) continue;
    if (s.replace(/ /g, '').startsWith('|---')) continue;

    const cells = s.split('|').map(x => x.trim()).filter(Boolean);
    if (cells.length < 5) continue;

    const dt = cells[0];
    const dmy = dt.match(reDMY);
    const ymd = dmy ? null : dt.match(reYMD);
    if (!dmy && !ymd) continue;

    const yyyy = +(dmy ? dmy[3] : ymd[1]);
    const MM   = +(dmy ? dmy[2] : ymd[2]);
    const dd   = +(dmy ? dmy[1] : ymd[3]);
    const HH   = +(dmy ? dmy[4] : ymd[4]);
    const mm   = +(dmy ? dmy[5] : ymd[5]);
    const ss   = +(dmy ? dmy[6] : ymd[6]);

    // Website time is BRT (UTC-3) -> convert to UTC baseline
    const killUTC = new Date(Date.UTC(yyyy, MM - 1, dd, HH + 3, mm, ss));

    const monster = cells[1];
    const player  = cells[2];
    const server  = cells[3];
    const map     = cells[4];

    // Hours lookup also enforces boss-specific map eligibility.
    const h = getRespawnHours_(monster, map);

    // Compute respawn UTC (precise to the second; avoid FP drift)
    const respawnUTC = (h != null)
      ? new Date(killUTC.getTime() + Math.round(h * 3600 * 1000))
      : null;

    // A: Kill (Brazil/BRT) - match website style
    const killBR = fmt(killUTC, TZ_BR, 'dd/MM/yyyy HH:mm:ss');

    // G/H: display columns
    const respBR = fmt(respawnUTC, TZ_BR, 'yyyy/MM/dd HH:mm:ss');
    const respSE = fmt(respawnUTC, TZ_SE, 'yyyy/MM/dd HH:mm:ss');

    // I: Beijing - keep TRUE Date value (instant). Display depends on sheet timezone/format.
    const respCNDate = respawnUTC;

    rows.push([
      killBR,
      monster,
      player,
      server,
      map,
      (h != null ? h : ''),
      respBR,
      respSE,
      respCNDate
    ]);
  }

  return { rows };
}

// ==============================
// Triggers (optional helpers)
// ==============================
function setAutoRefreshEvery5min() {
  // Remove existing refresh triggers, then create every-5-min
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'refreshBossLog') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refreshBossLog').timeBased().everyMinutes(5).create();
}

function setAutoRefreshEvery1min() {
  // Remove existing refresh triggers, then create every-1-min
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'refreshBossLog') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refreshBossLog').timeBased().everyMinutes(1).create();
}

function stopAutoRefresh() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'refreshBossLog') ScriptApp.deleteTrigger(t);
  });
}
