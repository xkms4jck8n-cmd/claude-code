# LEADERBOARD REPAIR REPORT

The production leaderboard was rendering **hardcoded fake users**. It has been
fully replaced with a real-player, Supabase-backed leaderboard. When no real
players are ranked, it shows **"No players ranked yet"** — never fake data.

## The exact component & file that was rendering fake data

**`src/BrainKingdom.tsx` → `function Leaderboard(...)`** — this is the active
production component for the `leaderboard` screen (routed at
`screen === "leaderboard" && <Leaderboard .../>`).

### Before (fake)
```js
const bots = useMemo(() => {
  const names = ["أبو فهد", "نورة", "خالد العتيبي", "ريم", "سلطان", "مها",
                 "عبدالله", "لمى", "تركي", "جواهر", "يوسف", "دانة", "فيصل",
                 "هند", "ماجد"];
  return names.map((nm, i) => ({ nm, score: 9800 - i*540 + (i%2?120:0), lvl: 40 - i*2 }));
}, []);
// "friends" tab was just bots.slice(0, 6) — also fake
```

### After (real)
```jsx
function Leaderboard({ setScreen }) {
  return (
    <div className="k-fade" style={{ padding: 16 }}>
      <Header title="لوحة المتصدّرين" onBack={() => setScreen("hub")} icon="rank" color={C.violet} />
      <LeaderboardPanel />   {/* live Supabase data: Global / Weekly / Friends */}
    </div>
  );
}
```

Additionally, the Hub/Profile **"ترتيب العام" (global rank)** tile was fed by a
fabricated formula:
```js
// before
const globalRank = (p) => (p.stats.rounds ? Math.max(1, 25000 - p.level*150 - ...) : 0);
// after — no fabricated number; shows "—" until really ranked
const globalRank = (_p) => 0;
```

## Exact files changed

| File | Change |
|------|--------|
| `src/BrainKingdom.tsx` | Deleted the fake `bots` generator and the entire fake leaderboard body; `Leaderboard` now renders the real `<LeaderboardPanel/>`. Neutralized the fabricated `globalRank` → "—". |
| `src/online/ui/LeaderboardPanel.tsx` | Real Global / Weekly / Friends rankings from Supabase; empty state text set to **"لا يوجد لاعبون في الترتيب بعد · No players ranked yet"**; added error catch so an unconfigured/failed backend shows the empty state (never fake data). |
| `supabase/schema.sql` | (already present) `leaderboard_global`, `leaderboard_weekly`, `leaderboard_friends` RPCs read only real `profiles` rows with `games_played > 0`, ranked by real score/wins/accuracy. |

## Requirements satisfied

| Requirement | Status |
|-------------|--------|
| Delete all generated / demo / placeholder users | ✅ removed the `bots` array + generator |
| Delete all hardcoded leaderboard data | ✅ none remains (grep-verified) |
| Leaderboard shows only real players, scores, statistics | ✅ Supabase `profiles` (real anonymous accounts), server-authoritative score/wins/accuracy |
| "No players ranked yet" when none exist | ✅ exact empty-state copy |
| Global Ranking | ✅ `leaderboard_global` (total score) |
| Friends Ranking | ✅ `leaderboard_friends` (you + accepted friends) — also a Weekly tab |
| No fake users anywhere in the project | ✅ verified (only matches left are the currency word "جواهر/gems" and in-question content) |

## Verification performed here
- `grep` for the old fake names / `bots` generator → **0 remaining** in UI code.
- `tsc --noEmit` exit 0 · `vite build` clean · `cap sync ios` ok.
- Live ranking populates from real duels once Supabase is configured
  (`ONLINE_SETUP.md`); not executed here (no project credentials in this environment).

> Note: the local **pass-and-play** result screens (`Result`) still show the
> winner among players entered by the user for that local session — these are
> real participants of a local match, not leaderboard/online data, and were left
> intact by design.
