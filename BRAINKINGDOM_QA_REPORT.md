# مملكة المعرفة (Brain Kingdom) — v5.0 QA Report

Audit & polish pass covering UI/UX, content, gameplay, profile, settings, and economy.
Run `node brainkingdom.qa.mjs` (requires `bun`) to re-verify everything below — current status: **QA PASSED, 0 failures**.

## 1. Questions per category (total **5,451**, was 1,241)

| Category | Before | After |
|---|---|---|
| ثقافة عامة (general) | 135 | 502 |
| علوم (science) | 130 | 494 |
| جغرافيا (geo) | 130 | 538 |
| أسئلة دينية (islamic) | 116 | 490 |
| تاريخ (history) | 123 | 494 |
| كلمات (word) | 127 | 511 |
| أمثال (proverb) | 121 | 476 |
| رموز وأشكال (image) | 121 | 519 |
| منطق (logic) | 119 | 472 |
| ألغاز (riddle) | 119 | 483 |
| أدب وفنون (literature) | 0 (placeholder) | 472 |

Every category covers all 5 difficulty tiers. A few categories sit slightly under the 500 mark **by design**: the duplicate/similarity/fatigue gates prune aggressively, and quality won over the round number.

## 2. Puzzles per mode

| Mode | Content |
|---|---|
| المحقق (Detective) | 10 cases × 8 phases — unique titles, culprit always among 4 suspects, ≥4 clues each |
| غرفة الهروب (Escape) | 4 rooms × 5 chained puzzles — every room uses 5 **distinct** mechanics, reward→needs chain verified |
| مسافر عبر الزمن (Time Travel) | 13 unique eras × 6-stage adventures (dialogue, exploration, anomaly, puzzle, boss, relic) |
| برج المعرفة (Tower) | Infinite floors, boss every 10, tier scales every 4 floors |
| عجلة الفئات (Roulette) | 8-category wheel × 5 surprise modifiers |
| Classic / Timed / Rapid / Builder / Choose / Challenge | Draw from the full validated bank with no-repeat selection |

## 3. Duplicates found and removed
- **Exact duplicates** (normalized Arabic text): removed at merge time; final bank has **0**.
- **Near-duplicates / rewordings** (same answer + question differing by ≤1 meaningful token): **91 removed**.
- **Concept fatigue** (same answer appearing >6 times in a category): **141 removed** (single-letter answers exempt — they're structural in missing-letter questions).
- **Unverifiable salvaged logic content**: dropped entirely; only items whose answers could be re-verified arithmetically were kept. All generated logic answers are computed, not written.

## 4. Duplicate puzzles
- **0 found.** Validator confirms: no duplicated puzzle prompts across escape rooms, 5 distinct mechanics per room, unique case titles, unique era names.

## 5. Broken buttons fixed
- Helper buttons (50/50, hint, skip) displayed coin costs but **never charged** — now charge, and refuse with feedback when the wallet can't cover it.
- Store "XP ×2 boost" did nothing — now a consumable that doubles the next round's XP.
- Store frames did nothing — now unlock avatar frames usable in the profile editor.
- Season "Premium pass" was a "coming soon" toast — now purchasable (250 gems) with claimable premium rewards.
- Season tier rewards were display-only — now actually claimable (free + premium tracks).
- Settings "link account" / "restore purchases" placeholder toasts — removed; replaced with real profile editing entry.
- Energy counter was decorative — now a real system: rounds cost 1 energy, +1 regenerates per 5 minutes of play, store refill works and respects the cap.

## 6. Navigation issues fixed
- Category-based modes forced "general" category — now open a proper **category picker** (incl. "all categories").
- Hub quick action "التحديات" misrouted to Achievements — now starts the friends challenge.
- Missions badge was hardcoded "3" — now computed from actually claimable missions (hub + bottom nav).
- Bottom nav had a hardcoded dark background that broke light theme — now theme-aware.
- Daily missions never reset at midnight — daily rollover now resets them; day-streak counts real consecutive play days.
- Hub "best score" / "rank" showed fake seeded values — best score now updates from real rounds; rank is dynamic and shows "—" before the first game.
- Leaderboard "me" entry used a hardcoded name/score — now uses the player's profile name and earned score.

## 7. New profile features
- Player name (editable, 24-char cap), avatar icon (12 choices), avatar color (8 choices), store-unlockable frames.
- Join date, total playtime, favorite category (from mastery), best answer streak (all-modes), correct-answer count, day streak, dynamic rank, gems.
- Profile identity survives a progress reset.
- New achievements: 10 and 25 consecutive correct answers.
- **Durable saves**: progress + settings persist via localStorage (Sets packed/unpacked), silently falling back to in-memory when storage is unavailable.

## 8. Remaining known issues
- 5 categories are 472–494 questions (target was 500) after quality pruning — see §1.
- Question content is curated/generated and validated structurally; a native-speaker editorial review pass is still recommended before store release.
- Leaderboard opponents are simulated locally (no backend); challenge mode is pass-and-play only.
- Notification toggles store preferences but no push system exists (no backend).
- The game ships as a single ~1.4 MB TSX file by design; a store build would want code-splitting and asset extraction.
