# UI / UX FIXES REPORT — Kingdom of Knowledge

Covers UI/UX, Arabic language & fonts, RTL, dark mode, and navigation. Combines
fixes from this audit with the relevant fixes from earlier passes (kept here as
the single UI reference).

## 1. Arabic text / fonts / RTL  ✅

| Issue | Root cause | Fix | Status |
|-------|------------|-----|--------|
| Arabic rendered as `????` / boxes; menu cards looked empty | UI fonts loaded via a **remote Google Fonts `@import`**, blocked by WKWebView under the `capacitor://` origin and offline | Self-hosted Cairo + Tajawal (`public/fonts/`, 12 woff2), 18 local `@font-face`; removed the remote import | Fixed (prior pass) |
| **Bold Arabic weights fell back unexpectedly** | 6 Cairo `@font-face` rules pointed at **non-existent** `Cairo-700/800/900` files (variable-font dedup bug) | Repointed to the single Cairo variable file (covers all weights); fixed the generator | **Fixed this pass** |
| Weak fallback could mis-render Arabic | Stack ended in bare `sans-serif` | Hardened to `'Tajawal','Cairo','Geeza Pro','Damascus','Al Nile',-apple-system,system-ui,…` (Geeza Pro = iOS built-in Arabic) | Fixed |
| Encoding | — | Verified UTF-8 across source, bundle, and `<meta charset>`; no separate JSON/string files to mis-encode (all inline) | Verified |
| RTL | — | Root `dir="rtl"` on the game and on the online modal; logical props (`insetInlineStart/End`) used in new UI | Verified |

## 2. Layout / spacing / scaling  ✅ (structural)

- **"Empty boxes + missing labels"** on the Hub were a symptom of the font failure
  (the card's gradient box rendered, its icon+Arabic label did not). Fixed by the
  font repairs above.
- **Invisible glass bars** on iOS: `backdrop-filter` lacked the `-webkit-` prefix
  (3 spots) → prefixed.
- **Responsiveness:** content is a centered column capped at `max-width:470` with
  `overflow:hidden` on the root and **no `100vw`** anywhere → no horizontal scroll
  or clipping across iPhone widths (SE 320–375 pt … Pro Max 430 pt). Height uses the
  correct `100vh`→`100dvh` fallback. Safe-area insets are honored, and Capacitor's
  `contentInset:"always"` prevents notch overlap.
- **New online UI** uses the same dark palette, RTL, safe-area padding, fluid
  grids/flex with `gap`, ellipsis on long names, and `max-width:520` centering.

## 3. Navigation  ✅ (proven)

- Automated graph check: **all 21 `setScreen` targets have a matching render guard**
  → no dead-ends, no inaccessible screens, no broken routes.
- The game's "quick actions" each route to a real destination (verified in source).
- Online overlay has explicit back/close on every view (lobby → match → results →
  tabs), and a live match hides the tab bar to prevent mid-duel navigation.

## 4. Dark mode  ✅

The app ships an **explicit** dark theme (with an in-app light option); all colors
are hard-set, so iOS light/dark cannot corrupt rendering. Status bar is configured
to light content over the dark background; `index.html` paints the dark background
immediately to avoid a white flash on launch.

## 5. Buttons / interaction  ✅

- New UI buttons use real `<button>` elements with adequate hit-area (≥34 px) and
  press feedback; disabled states are explicit.
- The game's `.k-press` interaction class and `onClick` handlers were left intact
  (no regressions introduced).

## Device-only follow-ups
Pixel-level overlap/scaling on physical iPhone sizes and live multiplayer visuals
should be eyeballed once on hardware — see `FULL_AUDIT_REPORT.md`.
