# FRIEND ID IMPLEMENTATION REPORT

Implements a complete, real Friend-ID system wired into the **actual production
screens** of the game (`src/BrainKingdom.tsx`), backed by the real Supabase
accounts layer. No fake/placeholder friend data anywhere.

## Exact files changed

| File | Change |
|------|--------|
| `src/online/friendId.ts` | **NEW** — generates & persists a unique `MK-#######` Friend ID per device; syncs to the server code. |
| `src/BrainKingdom.tsx` | **Profile screen** now shows the Friend ID + **Copy** button + a button opening the Friends page. Added a **`friends` screen** (`FriendsScreen`) and its route in the screen router. New imports. |
| `src/online/ui/FriendsPanel.tsx` | The real Add-Friend / Requests / Friends-List UI; made `onInvite` optional for in-game embedding; added not-configured/error states; placeholder → `MK-1234567`. |
| `src/online/useOnline.tsx` | `OnlineProvider` now wraps the whole app; proposes the device Friend ID as the account code and syncs the authoritative value back. |
| `src/online/api.ts` | `ensureProfile(...)` forwards the proposed `p_code`. |
| `src/online/OnlineApp.tsx` | No longer self-wraps the provider (shared with the game). |
| `src/main.tsx` | Wraps game + overlay in a single `OnlineProvider`. |
| `supabase/schema.sql` | `ensure_profile` accepts a client-proposed `p_code`, validates `^MK-\d{7}$`, uses it if free, else issues a unique `MK-#######`. |

## How each requirement is satisfied

| Requirement | Implementation |
|-------------|----------------|
| Every account auto-receives a unique ID (e.g. `MK-4829137`) | `getLocalFriendId()` creates `MK-` + 7 digits on first use; the server (`ensure_profile`) adopts it as the account's unique `player_code` (or issues a unique one on collision). |
| Display the ID in Profile | Profile screen renders **معرّف الصداقة (Friend ID)** = `online.me.player_code` (falls back to the local ID before the session resolves). |
| Copy button | `DarkBtn` with `navigator.clipboard.writeText` + toast "تم نسخ المعرّف". |
| Add Friend page | Friends screen (`setScreen("friends")`) embeds `FriendsPanel`. |
| Search field for Friend ID | Text input + **إضافة** button → `friend_request(code)` RPC (looks up `player_code`). |
| Send Friend Request | `sendFriendRequest()` → inserts a `pending` friendship; reverse-pending auto-accepts. |
| Incoming friend requests | `listIncomingRequests()` renders pending requests addressed to me. |
| Accept / Reject | `respond_friend(id, true/false)` via Accept/Reject buttons. |
| Friends List page | `listFriends()` renders accepted friends with online/offline status. |
| Store friendships persistently | `friendships` table in Postgres (durable), RLS-scoped. |
| Remove all fake friend data | The old fake "friends" tab (hardcoded bot names) was deleted (see `LEADERBOARD_REPAIR_REPORT.md`). |
| Real user records only | All data comes from the `profiles`/`friendships` tables (real anonymous accounts). |

## Navigation wired
- **Profile → "إضافة صديق · قائمة الأصدقاء"** → `friends` screen.
- `friends` screen has a Header back button → Hub. Route added to the screen
  router next to `leaderboard` (verified: `screen === "friends"` renders `FriendsScreen`).

## End-to-end validation

Build/type integrity verified here (`tsc --noEmit` exit 0, `vite build` clean,
`cap sync ios` ok). The **live** flow (search → request → accept → appears in
list) runs against your Supabase project once configured (URL + anon key, and
"Allow anonymous sign-ins" enabled — see `ONLINE_SETUP.md`). This environment has
no Supabase credentials, so live execution was not run here; the wiring, RPCs,
RLS, and UI are complete and type-checked.

| Validation step | Status |
|-----------------|--------|
| 1. New account gets a unique Friend ID | ✅ implemented (`MK-#######`, shown in Profile immediately) |
| 2. Search another player by Friend ID | ✅ `friend_request` looks up by `player_code` |
| 3. Send a friend request | ✅ |
| 4. Accept a friend request | ✅ |
| 5. Friendship appears in Friends List | ✅ |
