# FULL AUDIT REPORT — Kingdom of Knowledge (مملكة المعرفة)

_Date: 2026-06-15 · Framework: web React (React DOM) + Capacitor 7 (iOS) + Supabase (online)_

## Methodology & honest scope

This pass is a **static, build-level** production audit: TypeScript type-checking,
production build, and automated **integrity analysis** of the codebase (reference
graphs, navigation graph, asset existence, null-safety, realtime correctness),
followed by **concrete repairs**.

What this environment **can** do: compile, type-check, bundle, and statically
prove things like "every navigation target has a screen" or "every referenced
font file exists." What it **cannot** do: run the iOS Simulator or a device, so
pixel-level layout/overlap/scaling per iPhone model and live end-to-end
multiplayer were validated **structurally and by build**, not by visual
observation. Items that genuinely require a device are called out as such rather
than claimed as "verified." The 8,700-line single-file game is a vendored
artifact (under `@ts-nocheck`); it was audited statically and hardened, not
rewritten, to avoid destabilizing working logic.

---

## Bugs found and fixed this pass

| # | Severity | Bug | Fix |
|---|----------|-----|-----|
| 1 | **High** | **Broken font asset references** — the CSS declared 18 `@font-face` rules but **6 Cairo files (700/800/900 × arabic/latin) did not exist on disk**. Cairo is a *variable* font: Google served one woff2 for all weights; the generator deduped the download but still emitted per-weight filenames pointing at missing files → bold Arabic silently fell back. | Repointed the bold-weight `@font-face` rules to the actual variable file (which contains all weights), and fixed `scripts/fetch_fonts.py` so regeneration always references the file written to disk. **All 18 refs now resolve.** |
| 2 | **High** | **Realtime channel collision** — `subscribeFriends` used a constant Supabase channel topic `friends`, but `FriendsPanel` and `LeaderboardPanel` subscribe simultaneously → duplicate-topic conflict (one subscriber could miss live updates). | Every subscription now gets a unique topic suffix (`friends:<uid>`, `match:<id>:<uid>`, `invites:<me>:<uid>`). |
| 3 | **Med** | **Null-crash risk** — `ensureSession()` used `data.user!` after anonymous sign-in; if anonymous auth is disabled in Supabase, `user` is null → `TypeError`. | Guard added with a clear Arabic error instructing to enable anonymous sign-ins. |
| 4 | **High** | **No error boundary** — any render/runtime error anywhere would white-screen the entire app with no recovery (violates "never freeze silently"). | Added `src/ErrorBoundary.tsx`; the game and the online layer are wrapped in **separate** boundaries so one cannot crash the other, with an RTL Arabic recovery card + reload. |
| 5 | **Med** (perf) | **Online layer on the critical path** — `supabase-js` + multiplayer UI were bundled into the main chunk and parsed at startup even though they render nothing offline. | `OnlineApp` is now `React.lazy` + `Suspense`; it's a separate **64 KB-gzip** chunk loaded off the first-paint path. |

---

## Systems verified healthy (static proof)

| Area | Check | Result |
|------|-------|--------|
| **Navigation** | Every `setScreen("x")` target vs. render guards | **21/21 targets routed — no dead-ends / no inaccessible screens** |
| **Icons** | 64 dynamic `icon:"…"` ids + all static `I.x` refs vs. the 82-key glyph map | **0 missing icons** (the earlier "empty boxes" were the font bug, now fixed) |
| **Assets** | All `url(fonts/…)` refs vs. files on disk; external image/audio/`require` refs | **0 missing** after fix #1; game has **no external image/sound files** (sound is synthesized via WebAudio, icons are inline SVG) — nothing to break |
| **Arabic / UTF-8** | Source encoding, bundle, `@font-face`, fallback stack | UTF-8 throughout; **self-hosted** Cairo+Tajawal (no remote CDN); hardened stack ending in iOS **Geeza Pro** |
| **Type safety** | `tsc --noEmit` over strict-checked code (online, notifications, main, error boundary) | **exit 0** |
| **Build** | `vite build` | **no errors, no warnings** |
| **iOS bundle** | `cap sync ios` | 6 plugins; 12 fonts copied; **0** `googleapis` references |

---

## Per-screen audit notes

All in-game screens (Main Menu/Hub, Daily Missions, Shop, Challenge, Season,
Category Selection, Wheel/Roulette, Judge/Detective, Escape Room, Tower, Time
Traveler, Profile, Settings, Statistics, Achievements, Leaderboard, and the
online Duel/Leaderboard/Friends panels) were checked **structurally**: each is
reachable (navigation graph), renders real content (no missing icons/labels
after the font fix), uses a responsive centered column (`max-width:470`, no
`100vw`), RTL `dir="rtl"`, an explicit dark theme, and safe-area insets. See
`UI_FIXES_REPORT.md` for detail. Pixel-level QA on physical devices remains the
recommended final step (see "Remaining device-only checks").

## Files modified this pass
- `src/BrainKingdom.tsx` — repointed 6 Cairo `@font-face` srcs to the variable file.
- `src/online/api.ts` — unique realtime topics; null-safe `ensureSession`.
- `src/main.tsx` — error boundaries + lazy-loaded online layer.
- `src/ErrorBoundary.tsx` — **new** crash isolation + recovery UI.
- `scripts/fetch_fonts.py` — correct variable-font reference generation.

## Remaining device-only checks (recommended before submission)
1. Visual sweep on iPhone SE (smallest) and Pro Max (largest) for any overlap/clipping.
2. Live 2-device duel: matchmaking, synced timer, first-finish end, results, head-to-head.
3. Notification permission prompt + delivery while app closed.
4. VoiceOver/Dynamic-Type spot check (accessibility).

See also: `UI_FIXES_REPORT.md`, `CODEBASE_HEALTH_REPORT.md`, `PERFORMANCE_REPORT.md`.
