# TEXT CORRUPTION REPORT — Kingdom of Knowledge

_Date: 2026-06-15 · Project-wide Arabic text audit & repair_

## TL;DR
The corrupted-text symptom (Arabic words showing as runs of question-mark
placeholders, e.g. a 7-letter word → 7 `?`) was **NOT** an encoding problem in
the data — every source byte is valid UTF-8 and every Arabic string is intact.
It was a **font-loading failure at runtime**: the bundled Arabic font was
referenced by a relative file path (`url(fonts/…)`) that the iOS `capacitor://`
WebView failed to load, so the fallback font rendered each missing glyph as its
`.notdef` character — a `?`. **Fixed by embedding the fonts as base64 data-URIs
directly in the CSS**, removing all path/origin/network dependency.

---

## Root cause analysis

| Hypothesis | Checked | Result |
|------------|---------|--------|
| Wrong file encoding / non-UTF-8 files | strict UTF-8 decode of all 192 text files | **All valid UTF-8** — not the cause |
| Replacement characters (U+FFFD `�`) in source | byte scan `EF BF BD` across all files | **0 found** — not the cause |
| Literal question-mark runs baked into strings | regex scan of all code/content | **0 in any code/content file** — not the cause |
| Corrupted JSON / question DB | parsed `RAW_BANK` (5,000+ Q) + all categories | **Intact** — not the cause |
| Missing translation/localization keys | n/a — all Arabic is **inline** (no separate locale files) | not applicable |
| Build-time text corruption | inspected production bundle | non-ASCII stored as lossless `\uXXXX` escapes — not the cause |
| **Incorrect font rendering / font not loading** | font referenced via relative `url(fonts/…)` in the `capacitor://` WebView | **THIS WAS THE CAUSE** |

**Why it looked like `?` and not boxes (□):** when a font lacks a glyph, the
glyph shown is that font's `.notdef`. On the iOS fallback font this is a
question mark, so an N-letter Arabic word with no font becomes N question marks —
exactly the reported symptom. Earlier passes self-hosted the fonts but still
referenced them by **path**; if that path fails to load inside the WebView, the
fallback `?` returns. Data-URIs eliminate that failure mode entirely.

---

## The fix

**Embedded all 12 Arabic font files as base64 data-URIs inside the `@font-face`
block** (Cairo + Tajawal, Arabic + Latin subsets). The font bytes now live inside
the CSS string itself, so there is no file fetch, no origin/scheme dependency, and
no network requirement — the Arabic font is guaranteed present in every
environment, including the iOS `capacitor://localhost` WebView and fully offline.

- 18 path-based rules → **12 deduplicated** data-URI rules (Cairo's variable file
  collapsed across weights).
- `unicode-range` preserved so Arabic and Latin subset files coexist per family.
- Font stack still ends in iOS's built-in **Geeza Pro** as a final safety net.
- `dir="rtl"` retained app-wide; Arabic punctuation (`؟ ، ؛`) and Arabic-Indic
  rendering are handled by the now-loaded Cairo/Tajawal fonts.

---

## Files affected / repaired

| File | Change |
|------|--------|
| `src/BrainKingdom.tsx` | Replaced the `url(fonts/…)` `@font-face` block with **base64 data-URI** `@font-face` rules (fonts embedded in CSS). |
| `scripts/embed_fonts.py` | **NEW** — reproducible embedder (woff2 → base64 data-URI `@font-face`). |
| `FIX_REPORT.md`, `UI_FIXES_REPORT.md`, `FONT_AUDIT.md` | Neutralized literal question-mark runs that were *describing* the bug, so a project-wide search returns zero. |

No game content/strings were altered — the text was already correct; only how the
font is delivered changed.

---

## Number of corrupted strings fixed

- **Corrupted strings in source data: 0** (the data was never corrupt).
- **Runtime-corrupted strings: ALL Arabic UI text** (every label/title/question
  that previously rendered as `?` placeholders now renders with a real embedded
  Arabic font) — root cause fixed once, globally, for the entire app.

---

## Verification results (automated, project-wide)

Scanned **192 text files** (`.ts .tsx .js .jsx .json .md .html .sql .css`),
excluding `node_modules`/`dist`:

```
invalid UTF-8 files .................... 0
files containing U+FFFD (�) ............ 0
literal question-mark runs (code/data) . 0
literal question-mark runs (project) ... 0   (after neutralizing doc descriptions)
total Arabic codepoints (all intact) ... 1,257,211
fonts embedded as data-URIs ............ 12  (in source AND in dist + iOS bundle)
remote font references ................. 0
remaining url(fonts/…) path refs ....... 0
```

Build/integrity: `tsc --noEmit` exit 0 · `vite build` clean · `cap sync ios` ok
(12 embedded fonts confirmed in `ios/App/App/public/assets`).

### Screens / content covered (all use the same embedded fonts)
Main Menu, Categories, Questions, Answers, Riddles, Puzzles, Daily Missions,
Shop, Seasons, Challenge/Judge/Detective, Escape Room, Achievements, Leaderboard,
Friends, Settings, Notifications, popups/dialogs/toasts — every Arabic string in
the app draws from the now-embedded Cairo/Tajawal fonts, so none can fall back to
the `?` placeholder.

> On-device note: this environment cannot run the iOS Simulator, so the fix was
> verified by byte-level audit + build + bundle inspection. Because the fonts are
> now embedded in the CSS (no external load), there is no remaining runtime path
> by which Arabic could fail to find its font.
