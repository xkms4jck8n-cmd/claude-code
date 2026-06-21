# QA REPORT — Kingdom of Knowledge

_Date: 2026-06-15 · Automated + static QA pass_

## Method & honesty
Interactive QA (tapping every button on a device) requires the iOS Simulator,
which this environment lacks. So this is a **static + automated** QA pass:
reference-graph integrity, content integrity, build/type integrity, and the
final-validation checklist run programmatically. Results are reproducible.

## Final-validation checklist (automated)

| Requirement | Result |
|-------------|:------:|
| No `???` text | ✅ 0 runs (whole project) |
| No corrupted Arabic (U+FFFD) | ✅ 0 |
| No duplicate questions | ✅ 0 (exact + near, 5,401 Qs) |
| No duplicate-answer defects | ✅ 0 structural (single-letter/numeric repeats are by-design in `word`/`logic`) |
| No incorrect answer mappings | ✅ 0 (answer ∈ options for every question) |
| No category mismatches | ✅ questions keyed by category; 11/11 titles valid |
| No broken navigation | ✅ 21/21 `setScreen` targets have a render branch |
| No placeholder/dummy data | ✅ none in app code |
| No fake leaderboard users | ✅ removed; leaderboard reads real Supabase profiles |
| No missing assets | ✅ icon (1024 opaque), splash (×3), 12 fonts embedded; no external img/audio refs |
| No console/runtime crash surface | ✅ ErrorBoundary isolates game + online; null-guards in online layer |
| No iOS build blockers | ✅ tsc 0, build clean, cap sync ok (see IOS_RELEASE_REPORT) |

## Navigation paths (every route reachable)
All game screens are reachable and have a back path: `hub, play, detective,
tower, roulette, escape, timetravel, odyssey, mystery, result, categories, modes,
profile, settings, achievements, leaderboard, friends, missions, store, seasons,
statistics, more`. Each screen component renders a `Header` with `onBack`, and the
online overlay (Duel/Leaderboard/Friends) has explicit back/close on every view.

## Game modes (present & wired)
Classic, Timed, Challenge (online duel), Rapid, Word-builder, Choose-the-question,
Detective, Tower, Roulette, Escape Room, Time-Traveler, Odyssey, Mystery City —
all have mode definitions, unlock gating, and a routed play screen.

## Content QA (question system)
- 5,401 questions across 11 categories; **0** duplicates, **0** structural
  defects, **0** placeholder/junk answers, **0** broken Arabic.
- Objective quality: **100% ≥85, 89.9% ≥95** (see `CONTENT_QUALITY_REPORT.md`).

## Social / online QA
- Friend ID system: unique `MK-#######` per account, copy, add-by-ID, accept/
  reject, friends list, persistent (Supabase). Graceful "not configured" + error
  states (no infinite spinners).
- Leaderboard: real global/weekly/friends; "No players ranked yet" when empty.
- Realtime channels use unique topics (no collision); subscriptions cleaned up on
  unmount (no leaks).

## Issues found & fixed in this/earlier passes
Font `?` rendering (cmap-exact unicode-range), realtime channel collision,
null-crash on anon-auth-disabled, missing error boundary, broken font asset refs,
deprecated iOS notification API, Podfile every-build phase, `@UIApplicationMain`.
All fixed and committed.

## Cannot be certified without a device (honest residual)
Touch-accuracy, gesture feel, exact visual layout per iPhone model, haptics, and
live 2-device multiplayer require Simulator/hardware. The static foundation is
clean; these need a final on-device QA sweep.
