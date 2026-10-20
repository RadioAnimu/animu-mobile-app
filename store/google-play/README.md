# Google Play listing

Everything the Play Console asks for in the store listing and the release form,
in the five listing languages: **pt-BR** (default), **en-US**, **pt-PT**,
**es-419** and **ja-JP**.

Each locale folder follows the [fastlane `supply`](https://docs.fastlane.tools/actions/supply/)
metadata layout, so the files can be pasted by hand or uploaded by a tool later:

```
<locale>/
  title.txt                     App name (≤ 30)
  short_description.txt         Short description (≤ 80)
  full_description.txt          Full description (≤ 4000)
  changelogs/<versionCode>.txt  Release notes (≤ 500)
  images/phoneScreenshots/      8 phone screenshots, 1080x1920 (9:16)
release-notes-3.0.0.txt         All languages in one block, for the release form
screenshots.json                Screenshot order and captions per language
```

## Filling in the Play Console

| Play Console field | File |
| --- | --- |
| Store listing → App name | `<locale>/title.txt` |
| Store listing → Short description | `<locale>/short_description.txt` |
| Store listing → Full description | `<locale>/full_description.txt` |
| Store listing → Phone screenshots | `<locale>/images/phoneScreenshots/1–8.jpg` |
| Production release → Release notes | `release-notes-3.0.0.txt` (paste the whole block) |

pt-BR is the default listing; add the other four under *Store listing →
Manage translations → Add your own translations*. A translation without its own
screenshots shows the default (pt-BR) ones, so upload each language's set.

The pt-PT and pt-BR screenshots share the same captures (the app has a single
Portuguese UI); only the captions differ.

## Search (ASO) notes

Play search indexes the title, short description and full description, the
title weighting most. The listing is written for that:

- The title keeps the brand and adds the main search term
  ("Rádio Animu: Músicas de Anime", "Anime Music Radio", "アニソンラジオ").
- The first sentence of each full description carries the main keywords, as it
  is all Play shows before "read more"; section headings repeat them.
- Search terms are localised, not translated (e.g. "openings" in es-419,
  アニソン / アニメソング in ja-JP).

Policy watch-outs: the station slogan ("a rádio mais moe do Brasil") is a
superlative, and Play may flag superlatives in metadata. Don't add emoji,
"best"/"#1"/"free" claims or keyword lists.

## Regenerating the screenshots

1. Boot the `animu-pixel7` emulator, set `adb shell wm size 1080x2400` and
   `adb shell wm density 420`, and turn on System UI demo mode (clock 12:00,
   full battery, no network or notification icons).
2. For each app language (Settings → App language), capture the screens named
   in `screenshots.json` (`adb exec-out screencap -p > <name>.png`) into
   `<raw-dir>/{pt,en,es,ja}/`. The lyrics screen has no UI text, so only `pt/`
   needs it.
3. Compose them:

   ```bash
   CJK_FONT=/path/to/NotoSansCJKjp-Bold.otf node scripts/store-screenshots.mjs <raw-dir>
   ```

   Captions live in `screenshots.json`; the script fails if one wraps past two
   lines. Proxima Nova must be installed (`pnpm fonts`).
