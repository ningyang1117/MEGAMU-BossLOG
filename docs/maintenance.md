# Maintenance Notes

## Main Sync Function

Run `refreshBossLog` to fetch and rewrite the sheet.

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

## Supported Boss Respawn Hours

Respawn windows are configured in `HOURS` inside `Code.gs`.

Add aliases in `ALIAS` when the website changes a monster name spelling.
