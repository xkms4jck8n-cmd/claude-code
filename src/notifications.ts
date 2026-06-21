// ============================================================================
//  Local notification system — مملكة المعرفة · Knowledge Kingdom
// ----------------------------------------------------------------------------
//  Pure LOCAL notifications (no server / no push token). They are scheduled on
//  the device with @capacitor/local-notifications, so they fire even when the
//  app is fully closed. The scheduler is idempotent: every refresh cancels the
//  app's own pending notifications and re-schedules from the latest game state,
//  which guarantees no duplicates and removes anything outdated.
//
//  Permission is requested once on first launch. On the web (no native bridge)
//  every function is a safe no-op so the game still runs in a browser.
// ============================================================================
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { App } from "@capacitor/app";

// ---- Stable IDs: one per notification type. Re-using the ID replaces the
//      pending notification instead of stacking a duplicate. ----
const ID = {
  welcomeBack1: 1001, // gentle nudge after a day away
  welcomeBack2: 1002, // stronger nudge after several days away
  energyFull: 1003,
  dailyReward: 1004,
  dailyChallenge: 1005,
  newSeason: 1006,
  streak: 1007,
  weeklyEvent: 1008,
} as const;

const ALL_IDS = Object.values(ID);

// localStorage key the game writes its notification context into.
export const NOTIF_CTX_KEY = "kok_notif_ctx";
const PERM_ASKED_KEY = "kok_notif_perm_asked";

export interface NotifContext {
  ts: number; // when the context was written (last activity)
  energy: number;
  maxEnergy: number;
  streak: number;
  seasonEndsAt: number; // epoch ms when the current season ends / next begins
  seasonName: string;
}

const HOUR = 3600_000;
const DAY = 86_400_000;

const isNative = () => Capacitor.isNativePlatform();

/** Next occurrence of a given local wall-clock hour:minute, from `from`. */
function nextAt(hour: number, minute: number, from = new Date()): Date {
  const d = new Date(from);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

/** Next given weekday (0=Sun..6=Sat) at hour:minute. */
function nextWeekday(weekday: number, hour: number, minute: number): Date {
  const now = new Date();
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  let delta = (weekday - d.getDay() + 7) % 7;
  if (delta === 0 && d.getTime() <= now.getTime()) delta = 7;
  d.setDate(d.getDate() + delta);
  return d;
}

/**
 * Request notification permission. Safe to call repeatedly; the OS prompt only
 * appears the first time. Returns true if granted.
 */
export async function ensurePermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === "prompt" || perm.display === "prompt-with-rationale") {
      perm = await LocalNotifications.requestPermissions();
    }
    try { localStorage.setItem(PERM_ASKED_KEY, "1"); } catch { /* ignore */ }
    return perm.display === "granted";
  } catch {
    return false;
  }
}

function readContext(): NotifContext | null {
  try {
    const raw = localStorage.getItem(NOTIF_CTX_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NotifContext;
  } catch {
    return null;
  }
}

/**
 * Cancel the app's pending notifications and re-schedule everything that should
 * fire in the future, based on the latest game context. Idempotent.
 */
export async function refreshNotifications(ctx?: NotifContext | null): Promise<void> {
  if (!isNative()) return;
  const c = ctx ?? readContext();
  const granted = (await LocalNotifications.checkPermissions()).display === "granted";
  if (!granted) return;

  // 1) Clear our own pending notifications → prevents duplicates & stale ones.
  try {
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter((n) => ALL_IDS.includes(n.id as any));
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  } catch { /* ignore */ }

  const now = Date.now();
  const list: any[] = [];
  const add = (id: number, title: string, body: string, at: Date) => {
    if (at.getTime() > now + 30_000) {
      list.push({
        id,
        title,
        body,
        schedule: { at, allowWhileIdle: true },
        sound: "default",
        smallIcon: "ic_stat_icon_config_sample",
      });
    }
  };

  // 2) Welcome-back nudges after inactivity (from last activity timestamp).
  const last = c?.ts ?? now;
  add(ID.welcomeBack1, "مملكة المعرفة 👑", "اشتقنا إليك! تحدٍّ جديد بانتظارك في المملكة.", new Date(last + DAY));
  add(ID.welcomeBack2, "عُد إلى المملكة 🏰", "لقد مرّ وقت طويل — استأنف رحلتك واستعد عرشك المعرفي!", new Date(last + 3 * DAY));

  // 3) Energy fully restored. Regen is ~ one point per rest period; estimate a
  //    wall-clock time to full so the player knows when to return.
  if (c && c.energy < c.maxEnergy) {
    const missing = c.maxEnergy - c.energy;
    const restoreAt = new Date(now + Math.min(missing * 30 * 60_000, 8 * HOUR));
    add(ID.energyFull, "طاقتك امتلأت ⚡", "عادت طاقتك بالكامل — ادخل والعب جولة جديدة الآن!", restoreAt);
  }

  // 4) Daily reward available — next local 10:00.
  add(ID.dailyReward, "هديتك اليومية جاهزة 🎁", "استلم مكافأتك اليومية قبل أن تفوتك!", nextAt(10, 0));

  // 5) Daily challenge available — next local 18:00.
  add(ID.dailyChallenge, "تحدّي اليوم متاح 🎯", "تحدٍّ جديد بانتظارك — أثبت معرفتك واربح جوائز.", nextAt(18, 0));

  // 6) New season — when the current season window ends.
  if (c && c.seasonEndsAt > now) {
    add(ID.newSeason, "موسم جديد بدأ! ✨", "انطلق موسم جديد بمكافآت حصرية — كن أول الصاعدين على القمة.", new Date(c.seasonEndsAt));
  }

  // 7) Streak reminder — today/next 20:00, only if a streak is at stake.
  if (c && c.streak > 0) {
    add(ID.streak, "لا تكسر سلسلتك 🔥", `سلسلتك ${c.streak} يوم! العب جولة اليوم للحفاظ عليها.`, nextAt(20, 0));
  }

  // 8) Weekly event — next Friday 12:00.
  add(ID.weeklyEvent, "فعالية الأسبوع 🏆", "فعالية المملكة الأسبوعية متاحة — شارك واربح جوائز كبرى!", nextWeekday(5, 12, 0));

  if (list.length) {
    try { await LocalNotifications.schedule({ notifications: list }); } catch { /* ignore */ }
  }
}

/** Cancel every notification this app scheduled (e.g. on logout/reset). */
export async function cancelAll(): Promise<void> {
  if (!isNative()) return;
  try { await LocalNotifications.cancel({ notifications: ALL_IDS.map((id) => ({ id })) }); } catch { /* ignore */ }
}

/**
 * Bootstrap: request permission on first launch, schedule from current state,
 * and re-schedule whenever the app goes to the background (so the freshest
 * state is captured for while-closed delivery). Tapping a notification opens
 * the app normally.
 */
export async function initNotifications(): Promise<void> {
  if (!isNative()) return;
  await ensurePermission();
  await refreshNotifications();

  // Re-schedule when the app is backgrounded or resumed.
  App.addListener("appStateChange", ({ isActive }) => {
    // On entering background, lock in notifications for the closed period.
    // On returning to foreground, push the inactivity nudges forward.
    void refreshNotifications();
    void isActive;
  });

  // When a notification is tapped, clearing it keeps the tray tidy.
  LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
    const id = action.notification.id;
    LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => { /* ignore */ });
  });
}
