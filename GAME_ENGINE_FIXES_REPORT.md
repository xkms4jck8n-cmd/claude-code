# Critical Fixes — Knowledge Kingdom (مملكة المعرفة)

Engineering pass addressing the four reported critical issues. All changes are
verified locally (`tsc --noEmit` clean, `vite build` clean, mock-backend smoke
test green) and require **no external servers**.

---

## 1. Broken text rendering (emoji shown as `?`/tofu boxes)

**What was broken**
Arabic rendered fine, but every **emoji** (category/level icons, the 🔌 on the
Friends screen, ⚔️🏆🫂 tabs, and emoji used inside question content) showed as a
`.notdef` "tofu" box. Root cause: the app's font stack is Arabic-first —
`'Tajawal','Cairo','Geeza Pro','Damascus','Al Nile',…,sans-serif` — with **no
emoji family in the chain**. The bundled Arabic fonts (and the Arabic system
fallbacks Geeza Pro / Damascus / Al Nile) contain no emoji glyphs, so inside the
iOS WKWebView emoji codepoints resolved to an Arabic font's `.notdef` box instead
of falling back to color emoji.

**How it was fixed**
- Appended `'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji'` to **every**
  font stack so emoji always have a real glyph source:
  - `src/online/ui/theme.ts` (shared online-UI font)
  - `src/BrainKingdom.tsx` — both inline root stacks **and** a new global
    `body { font-family: … }` rule (catch-all so any element falls back to emoji)
  - `src/ErrorBoundary.tsx`
- The bundled `@font-face` rules already use `unicode-range` scoped to Arabic +
  Latin, so adding emoji families is purely additive (no effect on Arabic shaping).
- Replaced 4 questions whose **subject was an Alchemical-Symbols-block glyph**
  (`🜂 🜍 🜔 🝆`, U+1F702…) — these tofu even *with* an emoji font because they are
  not emoji and are absent from iOS fonts. Rewrote them to renderable geometric
  glyphs (`△`/`▽`) / descriptive Arabic text, preserving the answers & difficulty.

_No source files contained mojibake/`U+FFFD` — the corruption was a font-fallback
problem, not a UTF-8 encoding problem. The HTML is already `<meta charset="UTF-8">`._

## 2 & 3. Friends/online failure + hard dependency on `ONLINE_SETUP.md`

**What was broken**
The online layer keyed entirely off Supabase env vars. With none present,
`isOnlineConfigured()` was `false`, so:
- the floating online button was hidden, and
- Friends/Leaderboard screens rendered the blocking empty state
  *"نظام الأصدقاء يتطلب تفعيل الخدمة الأونلاين (راجع ONLINE_SETUP.md)"*.

Multiplayer was therefore **untestable** in local/dev/Xcode builds — exactly the
screenshot the report shows.

**How it was fixed — local simulation backend (no servers)**
- New `src/online/mockBackend.ts`: a complete in-memory implementation of the
  same surface as the service layer — accounts, Friend-ID, friend requests/accept,
  friends list with online status, global/weekly/friends leaderboards, and
  **duels against a simulated opponent** (real-time bot progress, winner
  resolution, head-to-head, durable stats). Account + friend graph persist to
  `localStorage`; it seeds 2 friends + 1 pending request + a 5-bot leaderboard so
  every flow is immediately exercisable.
- `src/online/config.ts`: added `isLocalMode()` / `hasSupabase()`.
  `isOnlineConfigured()` is now `true` whenever a real backend **or** the local
  simulation is active (i.e. always) → **removes the hard dependency**. Auto-on
  when no creds; force with `VITE_OFFLINE_MODE=1`.
- `src/online/api.ts`: each operation transparently delegates to the mock when
  `isLocalMode()` is true, otherwise hits Supabase exactly as before. The UI
  (`FriendsPanel`, `DuelPanel`, `LeaderboardPanel`, `DuelMatch`, …) is unchanged
  and now works end-to-end offline.

**Result:** adding a friend by ID, the Friend-ID display/copy, incoming requests,
the lobby/duel flow, and leaderboards all function in a debug environment with no
network. Production behavior is unchanged when real creds are supplied.

## 4. General stability

- `tsc --noEmit` and `vite build` both pass clean (98 modules).
- No initialization-order or missing-reference issues: in local mode the Supabase
  client is never constructed (`requireClient()` is never reached), so the app
  cannot throw on a missing backend during startup.
- Existing `ErrorBoundary` isolation (game vs online layer) retained.

> Note: the `failureReason … runningboard … entitlement` text visible at the edge
> of the screenshots is an iOS-simulator RunningBoard/entitlement console notice,
> not an app crash — no code change applies.

---

### Files changed
```
src/online/mockBackend.ts   (new — local simulation backend)
src/online/config.ts        (isLocalMode / always-configured)
src/online/api.ts           (delegate to mock in local mode)
src/online/ui/theme.ts      (emoji font fallback)
src/ErrorBoundary.tsx       (emoji font fallback)
src/BrainKingdom.tsx        (emoji font fallback + global body rule; 4 alchemical questions)
.env.example, ONLINE_SETUP.md (document offline/local mode)
```

### How to test locally
```bash
npm install
npm run dev          # open the app — no .env needed
# Tap the ⚔️ button (or the Friends / Leaderboard screens):
#   • Friends: your MK-####### ID, 2 friends, 1 pending request; add any MK-####### code
#   • Leaderboard: you + 5 ranked players (global/weekly/friends)
#   • Duel: "ابحث عن خصم" → play vs a simulated opponent → results + head-to-head
npm run build        # production build (clean)
```
