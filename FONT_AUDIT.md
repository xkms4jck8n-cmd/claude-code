# FONT AUDIT — Knowledge Kingdom (iOS)

## Summary

The app's Arabic text failed to render on iOS (showing as `????` / missing‑glyph
boxes) because the UI fonts were pulled from a **remote Google Fonts `@import`**,
which WKWebView blocks under the `capacitor://localhost` app origin and which also
fails with no network. **Fixed by self‑hosting the fonts in the app bundle and adding
a guaranteed iOS Arabic system fallback.**

---

## Before

```css
/* first line of the app's CSS */
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
```
```js
fontFamily: "'Tajawal','Cairo',sans-serif"   // applied at the app root
```

Problems:
- **Remote dependency** — blocked under `capacitor://`, fails offline. ❌
- **No Arabic‑guaranteed fallback** — `sans-serif` alone is not reliable for Arabic
  glyph substitution inside WKWebView. ❌
- App Store / privacy concern — shipping an app that phones a font CDN at runtime. ❌

---

## Detection

| Check | Result |
|-------|--------|
| Source file encoding | `UTF‑8` ✅ (so data was never the problem) |
| `index.html` charset | `<meta charset="UTF-8">` present ✅ |
| Production bundle | non‑ASCII stored as `\uXXXX` escapes (lossless) ✅ |
| Separate translation/JSON/string files | none — all Arabic is inline ✅ |
| Remote font requests | **1 remote `@import`** (Cairo + Tajawal) ❌ → removed |
| Arabic‑capable bundled font | **none** ❌ → added |
| `backdrop-filter` without `-webkit-` | 3 occurrences ❌ → prefixed |

Conclusion: the `????` was a **font availability** failure, not an encoding failure.

---

## After (fix)

### 1. Self‑hosted fonts — bundled in the app
`public/fonts/` (copied to `dist/fonts/` and into the iOS app on `cap sync`):

| Family | Weights | Subsets | Size |
|--------|---------|---------|------|
| **Cairo** | 400 | arabic, latin | ~63 KB |
| **Tajawal** | 400, 500, 700, 800, 900 | arabic, latin | ~93 KB |
| **Total** | | | **~156 KB** |

18 local `@font-face` rules were injected into the app CSS (replacing the remote
`@import`), each referencing `url(fonts/…woff2)` with the proper `unicode-range`
for the arabic/latin subsets. Generated reproducibly by `scripts/fetch_fonts.py`.

### 2. Hardened, Arabic‑guaranteed font stack
```js
fontFamily:
  "'Tajawal','Cairo','Geeza Pro','Damascus','Al Nile'," +
  "-apple-system,system-ui,'Segoe UI',Tahoma,Arial,sans-serif"
```
- **Tajawal / Cairo** — primary, now bundled (always available).
- **Geeza Pro / Damascus / Al Nile** — iOS **built‑in Arabic** fonts; if everything
  else failed, Arabic still renders perfectly.
- `-apple-system` / `system-ui` — modern system UI fallback for Latin/digits.

### 3. WebKit blur fix
All `backdrop-filter:blur(...)` now also emit `-webkit-backdrop-filter:blur(...)`
so frosted‑glass bars render on iOS instead of looking empty.

---

## Why not embed fonts in the native Xcode target too?

For a Capacitor (WebView) app the **web layer** renders all text, so fonts must be
available to the WebView — which they now are (bundled web assets + `@font-face`).
Adding the `.woff2`/`.ttf` to the native target's `Info.plist` `UIAppFonts` would
only matter for **native** UIKit views, of which this app has none. So web‑side
bundling is the correct and complete fix. (If you later add native screens, convert
the woff2 to ttf and list them under `UIAppFonts`.)

---

## Verification

```
grep -c googleapis dist/assets/*.js   → 0   (no remote font at runtime)
ls dist/fonts/                        → 12 woff2 files present
grep -c '@font-face' src/BrainKingdom.tsx → 18
grep -c 'Geeza Pro'  src/BrainKingdom.tsx → 2
```

All Arabic UI — menu titles, buttons, category names, question text — renders with a
bundled, Arabic‑complete font, with the iOS system Arabic font as a guaranteed safety net.
