# MEGAMU Boss Log Auto Refresh

Google Apps Script project for syncing the MEGAMU boss log into a Google Sheets workbook.

The script fetches MEGAMU boss-kill data, keeps a persistent `BOSS_LOG` history, and updates timezone-specific summary tabs for Beijing, Sweden, and Brazil/BRT.

## What It Does

- Fetches boss log data from MEGAMU through multiple fallback sources.
- Prefers `https://r.jina.ai/http://en.megamu.net/boss-log`.
- Supports both observed source date formats:
  - `dd/MM/yyyy HH:mm:ss`
  - `yyyy-MM-dd HH:mm:ss`
- Inserts only previously unseen events into `BOSS_LOG`.
- Retains events after they roll off MEGAMU's current 500-row page.
- Deduplicates by kill time, monster, player, server, and map.
- Calculates respawn times for supported bosses only on eligible maps.
- Keeps temporary-event kills in history without letting off-map kills affect respawn summaries.
- Updates:
  - `Summary` for Beijing time
  - `Summary(SE)` for Sweden time
  - `Summary(BR)` for Brazil/BRT time
- Keeps cached last-good source data if all live sources fail.
- Never clears or replaces existing `BOSS_LOG` history.

## Files

- `Code.gs`: main Google Apps Script source.
- `History.gs`: persistent history and event deduplication.
- `RespawnRules.gs`: boss-specific map eligibility and stored-history repair.
- `appsscript.json`: Apps Script manifest.
- `.clasp.json.example`: example clasp config. Copy to `.clasp.json` locally if you want to push to a specific Apps Script project.
- `docs/setup.md`: setup and import instructions.
- `docs/maintenance.md`: maintenance notes for future fixes.

## Fastest Reuse Path

The easiest long-term workflow is to keep one Google Sheets template and use `File -> Make a copy`.

Template copy link:

```text
https://docs.google.com/spreadsheets/d/1nKGlU1-hYGLiy-wgKcekzkeWUr2W1IgJ2PsJVAti_T0/copy
```

After copying the template:

1. Open the copied Google Sheet.
2. Open `Extensions -> Apps Script`.
3. Run `refreshBossLog` once.
4. Authorize the script when prompted.
5. Confirm that an unchanged second refresh adds no duplicate rows.
6. Run `setAutoRefreshEvery5min` if you want automatic refresh.

## Developer Reuse Path With clasp

Install Google's Apps Script CLI:

```bash
npm install -g @google/clasp
clasp login
```

Create or connect an Apps Script project:

```bash
clasp create --type sheets --title MEGAMU_BOSS_Refresh
clasp push
```

For an existing script project, copy `.clasp.json.example` to `.clasp.json`, paste your script ID, then run:

```bash
clasp push
```

## Current Spreadsheet

The maintained sheet title is `MEGAMU_BOSS_Refresh`.

Template source:

```text
https://docs.google.com/spreadsheets/d/1nKGlU1-hYGLiy-wgKcekzkeWUr2W1IgJ2PsJVAti_T0/edit
```

Project source is intentionally public so future parser/source fixes can be versioned and restored cleanly.
