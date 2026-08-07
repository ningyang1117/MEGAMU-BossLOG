# Setup

This project is a Google Apps Script project designed for a Google Sheets workbook.

## Option A: Copy An Existing Template Sheet

Use this when you want the least work.

Template copy link:

```text
https://docs.google.com/spreadsheets/d/1nKGlU1-hYGLiy-wgKcekzkeWUr2W1IgJ2PsJVAti_T0/copy
```

1. Open the copy link.
2. Confirm `Make a copy`.
3. In the copied sheet, open `Extensions -> Apps Script`.
4. Select `refreshBossLog`.
5. Click `Run` and approve permissions.
6. Return to the spreadsheet and confirm `BOSS_LOG` has current rows.
7. Run `refreshBossLog` again and confirm an unchanged source adds no duplicate rows.
8. Optional: run `setAutoRefreshEvery5min` to create a time trigger.

## Option B: Import From GitHub With clasp

Use this when rebuilding from source or maintaining the script.

1. Install clasp:

```bash
npm install -g @google/clasp
clasp login
```

2. Clone this repository:

```bash
git clone https://github.com/ningyang1117/MEGAMU-BossLOG.git
cd MEGAMU-BossLOG
```

3. Create a new container-bound Apps Script project for Sheets:

```bash
clasp create --type sheets --title MEGAMU_BOSS_Refresh
clasp push
```

4. Open the generated sheet/script and run `refreshBossLog` once to authorize.

## Option C: Push To An Existing Apps Script Project

1. Copy the example config:

```bash
cp .clasp.json.example .clasp.json
```

2. Replace `PASTE_YOUR_APPS_SCRIPT_PROJECT_ID_HERE` with the script ID from the Apps Script URL:

```text
https://script.google.com/home/projects/<SCRIPT_ID>/edit
```

3. Push:

```bash
clasp push
```

## Recommended Trigger

For normal use, run:

```text
setAutoRefreshEvery5min
```

For aggressive testing only:

```text
setAutoRefreshEvery1min
```

To stop automatic refresh:

```text
stopAutoRefresh
```

The refresh keeps all previously stored events and inserts new ones below the
`BOSS_LOG` header. Do not replace the sheet with a fixed 500-row import.
