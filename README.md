# MEGAMU Boss Log Auto Refresh

Google Apps Script project for syncing the MEGAMU boss log into a Google Sheets workbook.

The script fetches MEGAMU boss-kill data, writes a raw `BOSS_LOG` tab, and keeps timezone-specific summary tabs updated for Beijing, Sweden, and Brazil/BRT.

## What It Does

- Fetches boss log data from MEGAMU through multiple fallback sources.
- Prefers `https://r.jina.ai/http://en.megamu.net/boss-log`.
- Supports both observed source date formats:
  - `dd/MM/yyyy HH:mm:ss`
  - `yyyy-MM-dd HH:mm:ss`
- Writes parsed rows into `BOSS_LOG`.
- Calculates respawn times for supported bosses.
- Updates:
  - `Summary` for Beijing time
  - `Summary(SE)` for Sweden time
  - `Summary(BR)` for Brazil/BRT time
- Keeps cached last-good source data if all live sources fail.
- Avoids clearing `BOSS_LOG` when a fetch fails.

## Files

- `Code.gs`: main Google Apps Script source.
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
5. Run `setAutoRefreshEvery5min` if you want automatic refresh.

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
