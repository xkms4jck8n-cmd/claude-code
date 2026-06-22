# "???" boxes — root-cause trace & fix

## TL;DR
The boxes are **not** corrupted Arabic. Arabic is clean UTF-8 everywhere and the
bundled fonts shape every Arabic string correctly. The boxes are the iOS
**"unknown glyph" placeholder** (blue square + `?`) emitted for **emoji/symbol
codepoints used as question content**, concentrated in the `image`
("رموز وأشكال") category of `RAW_BANK` in `src/BrainKingdom.tsx`. The always-broken
ones were non‑emoji **symbols** (Alchemical/Geometric/Astrological blocks) used as
if they were emoji. Those are fixed at the data source, and a CI guard prevents
regressions.

## How the data flow was traced (storage → UI)
1. **Byte scan of the whole project.** Zero invalid‑UTF‑8 files. `U+FFFD` appears
   only inside two documentation `.md` files — never in code or data. → No encoding
   corruption, no escaped/double‑encoded Arabic.
2. **Font coverage.** Decoded all 12 embedded base64 `@font-face` subsets. Every
   Arabic face (Cairo + Tajawal weights 400–900) **fully covers** its declared
   `unicode-range` (claimed‑but‑missing = 0).
3. **Shaping proof (HarfBuzz).** Shaped the real UI strings — category names
   (`ثقافة عامة`, `علوم`), `سؤال`, `مدينة الأسرار`, diacritic strings
   (`تحدَّ عقلك`, `قضايا تتولّد`) — against each embedded font. Result: **0
   `.notdef`** for every string, every weight. → Arabic is never the box.
4. **Pixel inspection.** Magnifying the screenshot, the boxes are the distinctive
   blue‑rounded‑square‑with‑`?` (iOS unknown‑emoji), clustered exactly where the
   app renders **emoji content**.
5. **Data source.** `RAW_BANK.image` = 517 "identify this symbol" questions where
   the prompt *is* an emoji/symbol (`"🦁 ما هذا الحيوان؟"`). Classifying all 400
   distinct codepoints against the RGI emoji set surfaced the unrenderable ones.

## Exact file & root cause
`src/BrainKingdom.tsx` → `RAW_BANK.image`. Ten questions used **non‑emoji symbol
codepoints** as the visual prompt. These have no color‑emoji glyph and are absent
from iOS text fonts, so they render as `.notdef`/blue‑`?` on every device:

| was | block | fix |
|-----|-------|-----|
| `☤` caduceus | Misc Symbols | → `⚕️` (RGI medical symbol) |
| `☉` sun (alchemy) | Misc Symbols | → glyph‑free text |
| `☼` white sun | Misc Symbols | → `☀️` (RGI sun) |
| `★` black star | Misc Symbols | → `⭐` (RGI star) |
| `✶` six‑pointed star | Dingbats | → glyph‑free text |
| `⬟ ⬢ ⬡` pentagon/hexagons | Geometric Ext | → glyph‑free text |
| `⬤` black large circle | Geometric Ext | → `🌕` (RGI full moon) |
| `⬢⬢` | Geometric Ext | → glyph‑free text |

(Plus 4 Alchemical‑block prompts `🜂🜍🜔🝆` fixed in the prior pass.)

After the fix, **every** remaining content codepoint in the bank is either a
standard **RGI emoji** (renders on real iOS) or a **flag pair** — no unrenderable
symbols remain (`scripts/check_content_glyphs.py` → OK).

## Regression guard
`scripts/check_content_glyphs.py` parses `RAW_BANK` and fails the build if any
question uses a codepoint from the unrenderable symbol blocks. Run in CI/pre‑build.

## Also fixed (latent correctness bug)
The home category‑strip `<button>` (BrainKingdom hub) was the only card button
missing `fontFamily: "inherit"`. Native `<button>`s don't inherit `font-family`,
so its label fell back to the UA font instead of the app's Arabic stack — added
`fontFamily: "inherit"` to match every other card.

## Environment note (not a data bug)
Standard emoji and **flag** emoji (`🇸🇦`…) render on real iOS devices but **flags do
not render in the iOS Simulator** (a long‑standing Simulator limitation) and show
the same placeholder there. That is environmental, not corruption. If the app must
display emoji identically across Simulator/old OSes, the robust option is to render
content emoji via bundled SVGs (e.g. Twemoji) instead of the OS emoji font — a
larger change; say the word and I'll wire it up for the `image` category.

## Verified
- `tsc --noEmit` clean · `vite build` clean.
- HarfBuzz: all Arabic UI strings shape with 0 `.notdef`.
- `scripts/check_content_glyphs.py`: OK (no unrenderable content glyphs).
