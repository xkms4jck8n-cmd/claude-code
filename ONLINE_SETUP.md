# ONLINE MULTIPLAYER SETUP — Knowledge Kingdom

Real-time duels, real-player leaderboards, and a real friends system, powered by
**Supabase** (Postgres + Auth + Realtime) with **anonymous device accounts**.
Everything is **server-authoritative** — clients cannot forge wins, scores, or
ranks. No placeholder data anywhere; every row is a real account.

The app builds and runs fully **offline** without any of this; the online layer
stays hidden until you add the two environment variables below.

---

## 1. Create the backend (one-time, ~5 min)

1. Create a free project at <https://supabase.com>.
2. **Enable anonymous sign-ins:** Dashboard → **Authentication → Sign In / Providers →**
   toggle **Allow anonymous sign-ins** ON.
3. **Create the schema:** Dashboard → **SQL Editor** → paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql) → **Run**. This creates the tables,
   row-level-security policies, the realtime publication, and all RPC functions.
4. **Get your keys:** Dashboard → **Settings → API** → copy the **Project URL** and the
   **anon / public** key.

## 2. Configure the app

```bash
cp .env.example .env
# edit .env:
#   VITE_SUPABASE_URL=https://YOUR-ref.supabase.co
#   VITE_SUPABASE_ANON_KEY=eyJ...
npm run build          # bakes the values into the web build
npx cap sync ios       # copies the build into the iOS app
```

That's it — launch the app and the ⚔️ button appears bottom-start.

---

## 3. Architecture

```
src/online/
  config.ts        env vars + isOnlineConfigured()
  client.ts        single Supabase client (persisted anon session)
  types.ts         shared TS types
  questions.ts     reuses the game's 5,000+ question bank for duels
  api.ts           service layer — every call goes through here (RPCs + queries + realtime)
  useOnline.tsx    React provider: session bootstrap, profile, presence heartbeat, invite listener
  OnlineApp.tsx    floating launcher + modal shell + tab navigation + live-match view
  ui/              FriendsPanel, LeaderboardPanel, DuelPanel, DuelMatch, DuelResults, parts, theme
supabase/schema.sql  tables + RLS + RPC functions + realtime publication
```

- **Identity:** `supabase.auth.signInAnonymously()` → a real `auth.users` row → one
  `profiles` row (bootstrapped by `ensure_profile()`), with a unique human **Player ID**
  like `KOK-AB12CD`. The display name/avatar are seeded from the player's offline profile.
- **Server-authoritative stats:** all writes to wins/score/accuracy happen **only** inside
  the `finish_match()` security-definer function. RLS forbids direct stat edits → no cheating.
- **Realtime:** Supabase `postgres_changes` channels stream match + player + friendship
  changes to subscribers (RLS-filtered), so the UI updates live with no manual refresh.

---

## 4. How each requirement is met

### Online Duel Mode
- **Same questions, same order, for everyone:** the match creator picks the questions once;
  they're stored in `matches.questions` (jsonb) and every client renders that exact array.
- **Synchronized timer:** when the second player joins (`quick_match`) or a friend accepts
  (`accept_invite`), the server stamps `started_at`/`ends_at`. Clients compute the countdown
  from `ends_at` minus a **server-clock offset** (`server_now()` RPC), so timers match across
  devices regardless of local clock skew.
- **Independent answering + tracking:** each client records correct / answered / time and
  pushes live progress via `submit_progress()`; opponents see it update in real time.
- **Ends on first-finish OR timeout:** `finish_match()` finalizes the moment anyone finishes
  or `ends_at` passes; the realtime stream flips every client to the results screen instantly.
- **Results:** winner (most correct, tiebreak fastest time; equal = draw), per-player correct
  answers, time taken, completion status, side-by-side.
- **Match history / head-to-head:** `head_to_head()` aggregates all finished matches between
  two players → total duels, wins each, win-rate %.

### Real-player Leaderboards
- `leaderboard_global` (total score), `leaderboard_weekly` (ISO-week bucketed `weekly_score`),
  `leaderboard_friends` (you + accepted friends). All ranked by real `profiles` data
  (score, wins, accuracy, games played). No fake names.

### Friends system
- Unique **Player ID** per account (shown in the Friends tab, copyable).
- `friend_request(code)` / `respond_friend` / `remove_friend`; reverse-pending auto-accepts.
- View profiles, **compare stats**, **invite to a duel**, and **online/offline** status
  (driven by a 60-second `last_seen` heartbeat).

### Friends leaderboard
- Dedicated scope in the Leaderboard tab, ranked among friends, live-updating.

### UI
- Clean separation via three tabs (Duel / Leaderboard / Friends) + an isolated live-match
  view; everything updates in real time (realtime subscriptions + light polling fallback).

---

## 5. Notes, limits & next steps

- **"Jointly selected questions":** represented by the match creator's chosen category +
  count, which both sides then play identically (satisfies the same-questions/same-order
  fairness rule). A full pre-match category negotiation UI can be layered on later.
- **2 players per duel** today. The schema (`match_players` is a set) and `finish_match`
  generalize to N players; the UI currently renders the 1-v-1 case.
- **Scale:** Supabase Realtime + Postgres with `for update skip locked` matchmaking handles
  many concurrent duels. For very high volume, add a periodic job to finalize timed-out
  `active` matches whose players all disconnected (clients normally finalize on timeout).
- **Privacy / App Store:** anonymous accounts store no personal data; the only user content
  is a chosen display name. If you later add third-party login, add Sign in with Apple to
  satisfy App Store guideline 4.8.
- **Could not be live-tested here** (this environment has no Supabase project/keys). The code
  type-checks and builds; run the steps above against your project to go live.
