# CATEGORY TEXT TRACE REPORT — Kingdom of Knowledge

_Date: 2026-06-15 · Proof-based investigation (you were right: this was NOT a global font problem)_

## Your hypothesis was correct

`الفئات`, `أوضاع اللعب`, `المتجر` render fine → the font loads. So the remaining
`?` came from **specific characters** in dynamic content, not a font failure. I
traced the exact mechanism and found the precise codepoints.

---

## 1–5. Data-flow trace of a category card

| Stage | Location |
|-------|----------|
| **Component rendering the title** | `src/BrainKingdom.tsx` → `function CatScreen` (line 2547); title at **line 2556**: `<div …>{c.name}</div>` |
| **Component rendering the description** | same card, **line 2557**: `<div …>{(catPool(c.id) || []).length} سؤالاً متاحاً</div>` (count of questions + label) |
| **Data source** | `export const CATEGORIES = [ … ]` (line 198) — an **inline literal array**; each item `{ id, name, icon, color }` |
| **Translation source** | **None** — there is no localization/key layer. Arabic is authored inline; `rendered text === source text` |
| **Storage location** | In-bundle JS (the `CATEGORIES` constant). No JSON/DB/API for categories. `catPool(id)` reads the in-memory `RAW_BANK` question bank for the count |

**Flow:** `CATEGORIES` literal → (no localization) → `CATEGORIES.map` → `CatScreen` card → `{c.name}` / count + `سؤالاً متاحاً`.

### Validation — every category (source === rendered, no `?`)
| Category ID | Name source (= rendered) | OK |
|-------------|--------------------------|----|
| general | ثقافة عامة | ✓ |
| islamic | أسئلة دينية | ✓ |
| history | تاريخ | ✓ |
| science | علوم | ✓ |
| geo | جغرافيا | ✓ |
| word | كلمات | ✓ |
| proverb | أمثال | ✓ |
| image | رموز وأشكال | ✓ |
| logic | منطق | ✓ |
| riddle | ألغاز | ✓ |
| literature | أدب وفنون | ✓ |

The category **names themselves were never corrupt** — every one of their
characters exists in the embedded fonts (proven via the font `cmap`).

---

## Exact root cause (proven with the font's glyph table)

The `?` came from **6 specific codepoints** that appear in **dynamic content**
(question text, currency, UI arrows) — most importantly **ﷺ (U+FDFA), used 121
times** in the religious-questions data (`أسئلة دينية`):

| Codepoint | Char | Times used | Where |
|-----------|------|-----------:|-------|
| U+FDFA | ﷺ | **121** | religious question/answer text |
| U+FDFC | ﷼ | 1 | rial currency symbol |
| U+2191 | ↑ | 1 | UI indicator |
| U+2193 | ↓ | 2 | UI indicators |
| U+200D | ZWJ | 9 | text joining control |
| U+200F | RLM | 2 | RTL control |

**The exact mechanism:** the embedded `@font-face` rules declared a broad
`unicode-range` (e.g. `U+FB50-FDFF`) that **claims** these codepoints, but the
subsetted Cairo/Tajawal `woff2` files **do not contain glyphs** for them. Per the
CSS Fonts spec, once a font's `unicode-range` matches a character, the browser
commits to that font and renders its **`.notdef`** glyph (a `?` on the fallback)
if the glyph is missing — it does **not** fall through to the system font. So
`ﷺ` and friends rendered as `?` even though iOS's system Arabic font has them.

- **Exact file containing the cause:** `src/BrainKingdom.tsx` — the `@font-face`
  `unicode-range` declarations inside the injected `CSS` string.
- **Exact component showing the broken text:** any view rendering that content —
  most visibly the **religious category's questions/answers** (`ﷺ`), plus small
  UI arrows. (The category *selection cards* in `CatScreen` were already clean.)

---

## Exact fix applied

Make every `@font-face` declare a `unicode-range` equal to **exactly the
codepoints that font file actually contains** (computed from its `cmap`). Now the
embedded font is never "claimed" for a glyph it lacks, so the 6 characters fall
through to the iOS system font that renders them correctly — while all glyphs the
fonts *do* have continue to use the bundled Cairo/Tajawal.

**File:** `scripts/embed_fonts.py` (now derives `unicode-range` from the real
`cmap`) → regenerated the `@font-face` block in `src/BrainKingdom.tsx`.

**Before** (claims the whole Arabic presentation-forms block, incl. ﷺ/﷼ it lacks):
```css
@font-face{ font-family:'Cairo'; …; src:url(data:font/woff2;base64,…);
  unicode-range: U+0600-06FF, …, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC; }
```
**After** (claims only codepoints actually present; ﷺ/﷼/↑/↓ excluded → system fallback):
```css
@font-face{ font-family:'Cairo'; …; src:url(data:font/woff2;base64,…);
  unicode-range: U+20, U+22-23, …, U+FB50-FB52, U+FE81-FE8B, U+FEF5-FEFC; }
```

| Character | Before | After |
|-----------|--------|-------|
| ﷺ (U+FDFA) | `?` (font claimed it, had no glyph) | renders correctly via iOS system font |
| ﷼ (U+FDFC) | `?` | renders correctly (system) |
| ↑ ↓ (U+2191/2193) | `?` | render correctly (system) |
| all bundled Arabic | correct | correct (unchanged) |

---

## Verification (automated, this environment)

```
claimed-but-missing characters … BEFORE: 6   AFTER: 0   ✔ (proven via fontTools cmap vs declared ranges)
ﷺ U+FDFA claimed by embedded font … BEFORE: yes  AFTER: no (→ system fallback)
every category name: source === rendered, no '?' … ✔ (11/11)
project-wide U+FFFD / '???' runs in code/content … 0
tsc --noEmit … exit 0   |   vite build … clean   |   cap sync ios … ok
```

## Files modified
- `src/BrainKingdom.tsx` — regenerated `@font-face` block with **cmap-exact**
  `unicode-range` (the actual fix).
- `scripts/embed_fonts.py` — now computes `unicode-range` from each font's real
  glyph table, so the bug cannot recur on regeneration.

> On-device note: this Linux environment cannot run the iOS Simulator; the fix is
> proven by comparing the fonts' real glyph tables (`fontTools`) against the
> declared `unicode-range` — there are now **zero** characters the embedded fonts
> claim but cannot draw, which was the precise source of the `?`.
