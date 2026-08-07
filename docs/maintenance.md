# Maintenance Notes

## Main Sync Function

Run `refreshBossLog` to fetch the current source window and insert only unseen events.

`BOSS_LOG` is the persistent history store. A successful refresh must never clear
or replace existing rows. New events are inserted directly below the header so
the newest event remains at the top and existing pivot-table ranges expand with
the inserted rows.

## Source Handling

The script currently prefers:

```text
https://r.jina.ai/http://en.megamu.net/boss-log
```

Fallbacks include the `vi`, root, `www`, and direct MEGAMU URLs.

## Parser Notes

MEGAMU/Jina has emitted both:

```text
dd/MM/yyyy HH:mm:ss
yyyy-MM-dd HH:mm:ss
```

Both formats are accepted by:

```text
looksLikeBossLogTable_
parseBossLogMarkdownTable_
```

If sync falls back to cache even though the website works, inspect those two functions first.

## Cache Behavior

When all live sources fail, the script uses cached last-good text from DocumentProperties and writes a cache status into `A2` on each Summary tab.

When live fetch succeeds, `A2` is cleared and `B2` is updated with the refresh time.

## History and Deduplication

The MEGAMU page currently exposes 500 rows. `prependNewBossLogRows_` compares the
incoming window with the recent stored history and inserts only events whose
five-field key is new:

```text
kill time + monster + player + server + map
```

Kill text is normalized before comparison so values such as `03/08/2026 4:58:22`
and `03/08/2026 04:58:22` are treated as the same event. Column A is written as
plain text to prevent an `en_US` spreadsheet locale from interpreting `dd/MM` as
`MM/dd`.

Run the local regression test after changing this logic:

```bash
node tests/boss_log_history.test.js
```

## Supported Boss Respawn Hours

Respawn windows are configured in `HOURS` inside `Code.gs`.

Add aliases in `ALIAS` when the website changes a monster name spelling.

## Boss Map Eligibility

Boss-specific map allowlists are configured in `RESPAWN_ALLOWED_MAPS` inside
`RespawnRules.gs`:

| Boss | Eligible map |
| --- | --- |
| Core Magriffy | Nars |
| God of Darkness | Swamp of Darkness |
| Lord of Ferea | Ferea |
| Lord Silvester | Urk Mountain |
| Nightmare | Kanturu |
| Nix | Nixies Lake |
| Selupan | Raklion |

Aliases inherit the canonical boss rule. Off-map temporary-event kills remain
in `BOSS_LOG`, but columns F:I stay blank so the Summary pivots ignore them.

When a map rule changes, bump `RESPAWN_MAP_RULES_VERSION`. The next refresh
clears now-ineligible stored respawn values once. To force the same repair
manually, run `repairStoredRespawns` or choose `Boss Log -> Repair stored respawns`.

Run both regression tests after changing parser, history, or map rules:

```bash
node tests/boss_log_history.test.js
node tests/respawn_map_rules.test.js
```
