# NOTIFICATION SETUP — Knowledge Kingdom (iOS)

A complete **local** notification system. These are scheduled on the device and
fire **even when the app is fully closed** — no server, no push certificate, no
APNs token required. Implemented with `@capacitor/local-notifications@7`.

> Why local (not remote push)? Every required notification (welcome‑back, energy,
> daily reward/challenge, season, streak, weekly event) is derived from local game
> state and time. Local notifications deliver this reliably offline and need no
> backend or Apple Push certificate. (Remote push can be layered on later if the
> game adds a server.)

---

## Files

| File | Role |
|------|------|
| `src/notifications.ts` | The scheduler: permission, scheduling, cancel, dedupe, lifecycle. |
| `src/main.tsx` | Calls `initNotifications()` 1.2 s after first paint. |
| `src/BrainKingdom.tsx` → `writeSave()` | Publishes `kok_notif_ctx` (energy, streak, season, …) to `localStorage` on every save. |
| `ios/App/Podfile` | `CapacitorLocalNotifications` pod (auto‑added by `cap sync`). |
| `ios/App/App/capacitor.config.json` | `LocalNotificationsPlugin` registered. |

---

## Notifications implemented (all 7 required)

| # | Type | Arabic title | When it fires | Stable ID |
|---|------|--------------|---------------|-----------|
| 1 | Welcome‑back (inactivity, soft) | مملكة المعرفة 👑 | 24 h after last activity | 1001 |
| 2 | Welcome‑back (inactivity, strong) | عُد إلى المملكة 🏰 | 72 h after last activity | 1002 |
| 3 | Energy fully restored | طاقتك امتلأت ⚡ | when energy is estimated full (see note) | 1003 |
| 4 | Daily reward available | هديتك اليومية جاهزة 🎁 | next local **10:00** | 1004 |
| 5 | Daily challenge available | تحدّي اليوم متاح 🎯 | next local **18:00** | 1005 |
| 6 | New season | موسم جديد بدأ! ✨ | at the current season's end (`seasonEndsAt()`) | 1006 |
| 7 | Streak reminder | لا تكسر سلسلتك 🔥 | next local **20:00** (only if streak > 0) | 1007 |
| 8 | Weekly event | فعالية الأسبوع 🏆 | next **Friday 12:00** | 1008 |

> **Energy note:** in‑game energy regenerates from *active play time*, not wall‑clock.
> The "energy restored" notification therefore uses a wall‑clock **estimate**
> (`missing × 30 min`, capped at 8 h) so the player gets a timely "come back" nudge.
> Adjust the formula in `refreshNotifications()` if you change the regen model.

---

## How the requirements are met

**Works when the app is closed** — `LocalNotifications.schedule({ at, allowWhileIdle:true })`
hands the schedule to iOS; delivery does not require the app to be running.

**Scheduled automatically** — `initNotifications()` runs on launch, and
`refreshNotifications()` re‑runs on every `App.appStateChange` (foreground/background),
so the freshest state is captured before the app is backgrounded.

**Cancels outdated notifications** — each refresh first calls `getPending()` and cancels
all of the app's own IDs, then re‑schedules only future‑dated items. Anything stale is dropped.

**Prevents duplicates** — every type uses a **fixed integer ID**; re‑scheduling an ID
replaces (not stacks) the pending notification.

**Permission on first launch** — `ensurePermission()` calls `checkPermissions()` and only
shows the OS prompt when status is `prompt`. Idempotent and remembered.

---

## iOS configuration

- **Pod:** `CapacitorLocalNotifications` (in `ios/App/Podfile`) — installed by
  `npx cap sync ios` / `pod install` on macOS.
- **Plugin registration:** `LocalNotificationsPlugin` in `capacitor.config.json`'s
  `packageClassList` (auto‑generated).
- **Info.plist:** local notifications require **no** usage‑description key (those are for
  camera/mic/location/etc.). Permission is requested at runtime via
  `UNUserNotificationCenter`. Nothing to add.
- **AppDelegate:** **no change required.** The Capacitor LocalNotifications plugin sets
  itself as the `UNUserNotificationCenter` delegate and implements
  `willPresent` (foreground display) and `didReceive` (tap handling). Our JS listener
  `localNotificationActionPerformed` clears a tapped notification.
- **Latest‑iOS compatible:** plugin v7 targets the current iOS 14+ / Xcode 15–16 baseline.

---

## Test plan (on device/simulator)

1. `npm install && npm run build && npx cap sync ios && npx cap open ios`.
2. Run the app → accept the notification permission prompt on first launch.
3. Background the app. Within a minute you should be able to see scheduled items via
   debugging, or wait for time‑based ones (set device clock forward to verify 10:00/18:00/20:00).
4. Reduce energy in‑game, background the app → an "energy restored" notification is scheduled.
5. Re‑open after the welcome‑back window → nudges reschedule forward (no duplicates).

---

## Customization

- **Text / timing:** edit the `add(...)` calls in `refreshNotifications()` (`src/notifications.ts`).
- **Disable a type:** remove its `add(...)` line.
- **Reset all:** call `cancelAll()` (exported) on account reset/logout.
