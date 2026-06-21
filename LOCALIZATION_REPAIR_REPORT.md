# LOCALIZATION REPAIR REPORT — Kingdom of Knowledge

_Date: 2026-06-15 · Arabic content + UI text_

## Scope scanned
Categories, questions, answers, riddles, escape-room content, shop, achievements,
daily missions, seasons, notifications, UI labels, popups — i.e. **all Arabic in
the project** (it is authored **inline**; there are no separate localization/JSON
resource files, so there is a single source of truth).

## Corrupted-text scan results

| Check | Result |
|-------|-------:|
| Invalid UTF-8 files | **0** |
| Replacement characters (U+FFFD `�`) | **0** |
| Literal `?`-runs (`???`, `????`, …) in code/content | **0** |
| Broken/empty Arabic strings in question data | **0** |

**There is no corrupted text in the source data** — confirmed at the byte level
across the whole project. The `?` you saw on device was a **rendering** issue, not
corrupt data, and its exact cause was found and fixed in the previous pass:

> Six characters (most importantly **ﷺ U+FDFA**, used 121× in religious
> questions, plus `﷼`, `↑`, `↓`, and two RTL control marks) were **claimed** by
> the embedded font's `unicode-range` but **absent** from the subset, so WebKit
> drew its `.notdef` (`?`) instead of falling back. Fixed by making each
> `@font-face` `unicode-range` exactly match the font's real glyph table, so
> those characters fall back to the iOS system font that renders them. (Detail:
> `CATEGORY_TEXT_TRACE_REPORT.md`.) **Claimed-but-missing glyphs: 6 → 0.**

## Data-level normalization applied this pass

| Change | Count | Why |
|--------|------:|-----|
| `﷼` (rial sign, U+FDFC) → `ريال` | 1 | spell out the rare currency ligature so it renders with the bundled font everywhere, with zero reliance on a fallback |

`ﷺ` (U+FDFA, ×121) was **kept** — it is the correct, conventional honorific and
now renders correctly via the system Arabic font after the `unicode-range` fix;
mass-replacing it with the spelled-out phrase would alter 121 questions for no
rendering benefit.

## Verification
```
project-wide U+FFFD ................ 0
project-wide '???'+ runs ........... 0   (code/content)
claimed-but-missing font glyphs .... 0
category titles render correctly ... 11/11 (source === rendered)
tsc / build / cap sync ............. all green
```

## Numbers
- **Corrupted texts fixed in data: 0** (none existed — proven).
- **Rendering-corruption root cause fixed: 1** (the `unicode-range` font claim).
- **Glyph normalizations: 1** (`﷼` → `ريال`).
- **Categories with correct titles/descriptions: 11/11.**
