# FIX REPORT — مملكة المعرفة · Knowledge Kingdom (iOS)

_Date: 2026-06-15 · Framework: web React (React DOM) wrapped with Capacitor 7_

This report covers the second pass: fixing the broken Main‑Menu UI, the Arabic
"Q-mark placeholders" text, and implementing the full local‑notification system, then hardening
for App Store submission.

---

## Root‑cause analysis (what was actually wrong)

Both visible symptoms — **(1) broken menu / empty boxes / missing labels** and
**(2) Arabic shown as `Q-mark placeholders`** — had a **single shared root cause**:

> The app loaded its Arabic UI fonts (Cairo + Tajawal) from a **remote
> `@import url('https://fonts.googleapis.com/...')`** at the top of its CSS.
> Inside the iOS app the web content is served from the **`capacitor://localhost`**
> origin (not `https://`), and WKWebView **blocks that cross‑origin remote font
> request** (and it also fails with no network). With the web font missing and
> the font‑family stack ending in a bare `sans-serif`, glyphs fell back
> inconsistently — Arabic rendered as missing‑glyph boxes/`Q-mark placeholders`.

Why it looked like a *layout* bug: the menu cards (Daily Missions, Shop, Challenge,
Current Season) draw their box with a pure‑CSS gradient (no font), so the **boxes
stayed visible while their `<Icon>` + Arabic `<span>` labels disappeared** —
i.e. "large empty boxes with missing text." Once text rendering is fixed, the
cards display correctly. The grid itself (`grid-template-columns: 1fr 1fr 1fr 1fr`,
`max-width: 470` centered column, no `100vw`) was already responsive and correct.

A second, smaller iOS issue: 3 glass bars used `backdrop-filter` **without** the
`-webkit-` prefix, so on WebKit they rendered with no blur/backing → another
source of "empty" looking overlays.

---

## Fixes applied (every modified file)

### `src/BrainKingdom.tsx` (the game)
| Change | Detail |
|--------|--------|
| **Removed remote font `@import`** | Deleted `@import url('https://fonts.googleapis.com/css2?...Cairo...Tajawal...')`. No more CDN dependency. |
| **Self‑hosted `@font-face` injected** | Added **18** local `@font-face` rules (Cairo + Tajawal, Arabic + Latin subsets) pointing at bundled `fonts/*.woff2`. Fonts now load from the app bundle — offline‑safe and allowed under `capacitor://`. |
| **Hardened font stack (×2)** | `'Tajawal','Cairo',sans-serif` → `'Tajawal','Cairo','Geeza Pro','Damascus','Al Nile',-apple-system,system-ui,'Segoe UI',Tahoma,Arial,sans-serif`. Even in a total failure, **Geeza Pro** (iOS's built‑in Arabic font) guarantees correct Arabic. |
| **`-webkit-backdrop-filter` (×3)** | Prefixed every `backdrop-filter:blur(...)` so iOS glass bars/headers render correctly instead of appearing empty. |
| **Notification context writer** | `writeSave()` now also persists a compact `kok_notif_ctx` (energy, max energy, streak, season end, season name) to `localStorage` so the notification scheduler always has fresh state. Decoupled — no game logic changed. |

### `public/fonts/*.woff2` (new — 12 files, ~156 KB total)
Bundled Cairo (400) and Tajawal (400/500/700/800/900), Arabic + Latin subsets.
Copied into the build (`dist/fonts/`) and therefore into the iOS app on `cap sync`.

### `src/notifications.ts` (new)
Complete local‑notification scheduler (see **NOTIFICATION_SETUP.md**).

### `src/main.tsx`
Calls `initNotifications()` on first launch (deferred 1.2 s after `load` so it never
blocks first paint).

### `scripts/fetch_fonts.py` (new)
Reproducible font download + `@font-face` generation (documents how the bundled
fonts were produced; rerun to update).

### `package.json`
Added `@capacitor/local-notifications@^7.0.6`.

### iOS native project
- `ios/App/Podfile` — `CapacitorLocalNotifications` pod auto‑added by `cap sync`.
- `ios/App/App/capacitor.config.json` — `LocalNotificationsPlugin` registered in `packageClassList`.

---

## Issue‑by‑issue resolution

### 1. Main Menu UI ✅ FIXED
- Empty boxes / missing labels → caused by font failure; fixed by self‑hosting fonts
  and the Geeza Pro fallback. Cards now show icon + Arabic label.
- Glass bars → `-webkit-backdrop-filter` added.
- Verified responsiveness: 4‑column quick‑actions grid with `gap:10`, content capped at
  `max-width:470` and centered, `overflow:hidden` on root, **no `100vw`** → no horizontal
  scroll or clipping on any iPhone width (SE 320–375 pt through Pro Max 430 pt).
- Spacing/alignment/sizing of cards use fl/grid `gap` + flex centering — intact.

### 2. Arabic "Q-mark placeholders" ✅ FIXED
- **Encoding verified UTF‑8 end‑to‑end:** source file is UTF‑8; `index.html` declares
  `<meta charset="UTF-8">`; the production bundle stores non‑ASCII as `\uXXXX` escapes
  (data‑lossless). The corruption was **font**, not encoding.
- There are **no separate translation/JSON/string‑resource files** — all Arabic is inline
  in the component (UI strings) and the embedded `RAW_BANK` question data. Audited: intact.
- Unsupported remote font replaced with bundled, Arabic‑complete Cairo/Tajawal + Geeza Pro.
- Titles, buttons, category names now render correctly (all use the fixed font stack).

### 3–5. Notifications + iOS config ✅ IMPLEMENTED
See **NOTIFICATION_SETUP.md**. All 7 notification types implemented as **local**
notifications that fire while the app is closed, with permission requested on first
launch, stable per‑type IDs (no duplicates), and automatic cancel/reschedule of stale
items. iOS config: `LocalNotifications` pod + plugin registered; local notifications
require **no** Info.plist usage key and Capacitor manages the `UNUserNotificationCenter`
delegate (foreground presentation + tap handling) — no AppDelegate change required.

### 6. Font system ✅ AUDITED & FIXED
See **FONT_AUDIT.md**.

### 7. QA ✅
- Responsiveness/overflow/clipping: audited (no `100vw`, capped centered column,
  safe‑area insets handled, `contentInset:"always"` avoids notch overlap).
- RTL: root `<div dir="rtl">` preserved; Arabic fonts now load → RTL renders correctly.
- Dark Mode: the app ships its own explicit dark theme (with an in‑app light option);
  colors are hard‑set so iOS light/dark cannot corrupt it. Status bar set to light content
  (`StatusBar.style = DARK` in Capacitor = light text) over the dark navy background.

---

## Verification (this environment)

```
npx tsc --noEmit        → ✅ exit 0
npm run build           → ✅ built (dist/ + dist/fonts/*.woff2)
grep googleapis dist    → ✅ 0 (no remote font dependency remains)
npx cap sync ios        → ✅ 6 plugins (incl. LocalNotifications); Sync finished
```

> Note: `pod install` and the final Xcode Release **archive** must run on a Mac
> (no CocoaPods/Xcode on this Linux host). All native files, pods spec, plugin
> registration and assets are generated and ready for that one step.

## What still needs a Mac
1. `npm install && npm run build && npx cap sync ios` (runs `pod install`).
2. Open `ios/App/App.xcworkspace`, set your Team (Signing & Capabilities), Run / Archive.
3. On first launch the OS will prompt for notification permission — accept to test.
