// =============================================================================
// mockBackend.ts — fully local, offline simulation of the online multiplayer
// backend (accounts, friends, leaderboards, duels).
//
// WHY THIS EXISTS
// The online layer normally talks to Supabase. Without the two VITE_SUPABASE_*
// env vars the whole friends/duel/leaderboard system was *blocked* and showed
// "نظام الأصدقاء يتطلب تفعيل الخدمة الأونلاين (راجع ONLINE_SETUP.md)". That made
// the multiplayer features untestable in local/dev/Xcode builds.
//
// This module is a drop-in stand-in: it implements the exact same surface the
// `api.ts` service layer exposes, but entirely in-memory (with a little
// localStorage persistence for the account + friend graph) and with a simulated
// bot opponent for duels. It runs with ZERO external servers, so the game is
// fully testable locally. When real Supabase creds ARE provided, this module is
// never used (see config.ts → isLocalMode()).
// =============================================================================
import type {
  Profile, Match, MatchPlayer, FriendEdge, FriendView, HeadToHead, LeaderRow, Question,
} from "./types";
import { getLocalFriendId } from "./friendId";

export interface RequestView { edge: FriendEdge; profile: Profile; }
export interface MatchConfig {
  category: string | null;
  count: number;
  duration: number;
  questions: Question[];
}

const STORE_KEY = "kok_local_backend_v2";
const ONLINE_WINDOW_MS = 90_000;

// ---------- tiny realtime event bus ----------------------------------------
type Listener = () => void;
const buses: Record<string, Set<Listener>> = {};
function on(topic: string, cb: Listener): () => void {
  (buses[topic] ||= new Set()).add(cb);
  return () => { buses[topic]?.delete(cb); };
}
function emit(topic: string): void {
  buses[topic]?.forEach((cb) => { try { cb(); } catch { /* ignore */ } });
}

// ---------- persistent-ish store -------------------------------------------
interface Store {
  meId: string;
  profiles: Record<string, Profile>;
  edges: FriendEdge[];
  h2h: Record<string, HeadToHead>; // keyed by opponent id, from "me" perspective
}

let store: Store | null = null;

const nowISO = () => new Date().toISOString();
const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
const randCode = () => `MK-${String(Math.floor(Math.random() * 9_999_999)).padStart(7, "0")}`;

function emptyProfile(over: Partial<Profile>): Profile {
  return {
    id: over.id || uid("p"),
    player_code: over.player_code || randCode(),
    name: over.name || "لاعب",
    icon: over.icon || "crown",
    color: over.color || "#e9c878",
    created_at: over.created_at || nowISO(),
    last_seen: over.last_seen || nowISO(),
    total_score: over.total_score ?? 0,
    games_played: over.games_played ?? 0,
    wins: over.wins ?? 0,
    losses: over.losses ?? 0,
    draws: over.draws ?? 0,
    correct_answers: over.correct_answers ?? 0,
    total_answers: over.total_answers ?? 0,
    weekly_score: over.weekly_score ?? 0,
    weekly_period: over.weekly_period ?? 0,
  };
}

// A handful of believable demo players so the leaderboard/friends UI is alive
// and the flows (compare, challenge, accept request) are all exercisable.
function seedBots(): Profile[] {
  const defs: Array<Partial<Profile>> = [
    { name: "نورة", icon: "star", color: "#f08bb0", total_score: 4820, wins: 31, games_played: 44, correct_answers: 268, total_answers: 320 },
    { name: "خالد", icon: "rocket", color: "#5aa9ff", total_score: 3990, wins: 24, games_played: 40, correct_answers: 221, total_answers: 300 },
    { name: "سارة", icon: "gem", color: "#54e0c8", total_score: 3110, wins: 18, games_played: 33, correct_answers: 180, total_answers: 250 },
    { name: "يوسف", icon: "shield", color: "#9182f2", total_score: 2240, wins: 12, games_played: 26, correct_answers: 132, total_answers: 200 },
    { name: "ليان", icon: "feather", color: "#5fd38c", total_score: 1560, wins: 7, games_played: 19, correct_answers: 95, total_answers: 150 },
  ];
  return defs.map((d, i) => emptyProfile({
    ...d,
    weekly_score: Math.round((d.total_score || 0) * 0.3),
    // first two are "online" (recent last_seen), rest offline
    last_seen: new Date(Date.now() - (i < 2 ? 10_000 : 6 * 60_000)).toISOString(),
  }));
}

function persist(): void {
  if (!store) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      meId: store.meId, profiles: store.profiles, edges: store.edges, h2h: store.h2h,
    }));
  } catch { /* ignore (private mode / quota) */ }
}

function init(): Store {
  if (store) return store;
  // try restore
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      if (s && s.meId && s.profiles && s.profiles[s.meId]) { store = s; return store; }
    }
  } catch { /* ignore */ }

  // fresh seed
  const me = emptyProfile({
    id: uid("me"),
    player_code: getLocalFriendId(),
    name: "مستكشف المعرفة",
    icon: "crown",
    color: "#e9c878",
  });
  const bots = seedBots();
  const profiles: Record<string, Profile> = { [me.id]: me };
  bots.forEach((b) => { profiles[b.id] = b; });

  // bots[0..1] are accepted friends; bots[2] has sent ME a pending request.
  const edges: FriendEdge[] = [
    { id: uid("e"), requester: me.id, addressee: bots[0].id, status: "accepted", created_at: nowISO() },
    { id: uid("e"), requester: bots[1].id, addressee: me.id, status: "accepted", created_at: nowISO() },
    { id: uid("e"), requester: bots[2].id, addressee: me.id, status: "pending", created_at: nowISO() },
  ];

  store = { meId: me.id, profiles, edges, h2h: {} };
  persist();
  return store;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const me = () => init().profiles[init().meId];

// ---------- Auth / profile --------------------------------------------------
export async function ensureSession(): Promise<string> {
  return init().meId;
}

export async function ensureProfile(name?: string, icon?: string, color?: string, code?: string): Promise<Profile> {
  const s = init();
  const p = s.profiles[s.meId];
  if (name) p.name = name;
  if (icon) p.icon = icon;
  if (color) p.color = color;
  if (code && /^MK-\d{7}$/.test(code)) p.player_code = code;
  p.last_seen = nowISO();
  persist();
  return { ...p };
}

export async function getProfile(id: string): Promise<Profile | null> {
  return init().profiles[id] ? { ...init().profiles[id] } : null;
}

export async function touchLastSeen(): Promise<void> {
  const p = me(); p.last_seen = nowISO(); persist();
}

export async function syncServerClock(): Promise<void> { /* local clock is the source of truth */ }

// ---------- Friends ---------------------------------------------------------
export async function sendFriendRequest(code: string): Promise<FriendEdge> {
  const s = init();
  const c = code.trim().toUpperCase();
  if (!/^MK-\d{7}$/.test(c)) throw new Error("صيغة المعرّف غير صحيحة (MK-1234567)");
  if (c === me().player_code) throw new Error("لا يمكنك إضافة نفسك");

  // Already a known player with this code?
  let target = Object.values(s.profiles).find((p) => p.player_code === c && p.id !== s.meId);
  // In offline mode there is no global directory, so we materialize a believable
  // player for any well-formed code — the add-friend flow stays fully testable.
  if (!target) {
    target = emptyProfile({
      player_code: c,
      name: `لاعب ${c.slice(3, 7)}`,
      color: ["#54e0c8", "#5aa9ff", "#f08bb0", "#9182f2", "#5fd38c"][Math.floor(Math.random() * 5)],
      total_score: 200 + Math.floor(Math.random() * 2000),
      wins: Math.floor(Math.random() * 15),
      games_played: 5 + Math.floor(Math.random() * 25),
      last_seen: new Date(Date.now() - 20_000).toISOString(),
    });
    s.profiles[target.id] = target;
  }

  const existing = s.edges.find((e) =>
    (e.requester === s.meId && e.addressee === target!.id) ||
    (e.requester === target!.id && e.addressee === s.meId));
  if (existing) {
    if (existing.status !== "accepted") { existing.status = "accepted"; persist(); emit("friends"); }
    return { ...existing };
  }

  // Simulate the other side instantly accepting (so duels are testable at once).
  const edge: FriendEdge = {
    id: uid("e"), requester: s.meId, addressee: target.id, status: "accepted", created_at: nowISO(),
  };
  s.edges.push(edge);
  persist();
  emit("friends");
  return { ...edge };
}

export async function respondFriend(id: string, accept: boolean): Promise<void> {
  const s = init();
  const e = s.edges.find((x) => x.id === id);
  if (!e) return;
  if (accept) e.status = "accepted";
  else s.edges = s.edges.filter((x) => x.id !== id);
  persist();
  emit("friends");
}

export async function removeFriend(other: string): Promise<void> {
  const s = init();
  s.edges = s.edges.filter((e) => !(
    (e.requester === s.meId && e.addressee === other) ||
    (e.requester === other && e.addressee === s.meId)));
  persist();
  emit("friends");
}

export async function headToHead(other: string): Promise<HeadToHead> {
  return init().h2h[other] ?? { total: 0, my_wins: 0, their_wins: 0, draws: 0 };
}

export async function listFriendEdges(meId: string): Promise<FriendEdge[]> {
  return init().edges.filter((e) => e.requester === meId || e.addressee === meId).map((e) => ({ ...e }));
}

export async function listFriends(meId: string): Promise<FriendView[]> {
  const s = init();
  const edges = s.edges.filter((e) => e.status === "accepted" && (e.requester === meId || e.addressee === meId));
  const now = Date.now();
  return edges.map((e) => {
    const otherId = e.requester === meId ? e.addressee : e.requester;
    const profile = s.profiles[otherId];
    return profile ? {
      profile: { ...profile },
      edge: { ...e },
      online: now - new Date(profile.last_seen).getTime() < ONLINE_WINDOW_MS,
    } : null;
  }).filter(Boolean) as FriendView[];
}

export async function listIncomingRequests(meId: string): Promise<RequestView[]> {
  const s = init();
  return s.edges
    .filter((e) => e.addressee === meId && e.status === "pending")
    .map((e) => ({ edge: { ...e }, profile: s.profiles[e.requester] ? { ...s.profiles[e.requester] } : null }))
    .filter((x) => x.profile) as RequestView[];
}

// ---------- Leaderboards ----------------------------------------------------
function toLeaderRow(p: Profile, scoreField: "total_score" | "weekly_score", rank: number): LeaderRow {
  return {
    id: p.id, player_code: p.player_code, name: p.name, icon: p.icon, color: p.color,
    score: p[scoreField], wins: p.wins, games_played: p.games_played,
    accuracy: p.total_answers > 0 ? p.correct_answers / p.total_answers : 0,
    rank,
  };
}
function rank(list: Profile[], field: "total_score" | "weekly_score"): LeaderRow[] {
  return [...list].sort((a, b) => b[field] - a[field]).map((p, i) => toLeaderRow(p, field, i + 1));
}
export async function leaderboardGlobal(_limit = 100): Promise<LeaderRow[]> {
  return rank(Object.values(init().profiles), "total_score");
}
export async function leaderboardWeekly(_limit = 100): Promise<LeaderRow[]> {
  return rank(Object.values(init().profiles), "weekly_score");
}
export async function leaderboardFriends(): Promise<LeaderRow[]> {
  const s = init();
  const ids = new Set<string>([s.meId]);
  s.edges.filter((e) => e.status === "accepted" && (e.requester === s.meId || e.addressee === s.meId))
    .forEach((e) => ids.add(e.requester === s.meId ? e.addressee : e.requester));
  return rank(Object.values(s.profiles).filter((p) => ids.has(p.id)), "total_score");
}

// ---------- Duel (simulated bot opponent) -----------------------------------
interface LiveMatch { match: Match; players: MatchPlayer[]; timer?: number; }
const matches: Record<string, LiveMatch> = {};

function newPlayer(matchId: string, player: string): MatchPlayer {
  return { match_id: matchId, player, correct: 0, answered: 0, time_ms: 0, finished: false, ready: true, joined_at: nowISO() };
}

function startMatch(opponentId: string, mode: "quick" | "friend", cfg: MatchConfig): string {
  const s = init();
  const id = uid("m");
  const start = Date.now();
  const match: Match = {
    id, status: "active", mode, created_by: s.meId,
    invited: mode === "friend" ? opponentId : null,
    category: cfg.category, question_count: cfg.count, questions: cfg.questions,
    duration_s: cfg.duration, created_at: nowISO(),
    started_at: new Date(start).toISOString(),
    ends_at: new Date(start + cfg.duration * 1000).toISOString(),
    winner: null, finished_at: null,
  };
  const players = [newPlayer(id, s.meId), newPlayer(id, opponentId)];
  matches[id] = { match, players };

  // Simulate the bot answering through the round in real time.
  const bot = players[1];
  const acc = 0.55 + Math.random() * 0.3; // 55–85% accuracy
  const perQ = Math.max(900, (cfg.duration * 1000) / (cfg.count + 1));
  matches[id].timer = window.setInterval(() => {
    const lm = matches[id];
    if (!lm || lm.match.status !== "active") return;
    if (bot.answered < cfg.count) {
      bot.answered += 1;
      if (Math.random() < acc) bot.correct += 1;
      bot.time_ms += Math.round(perQ * (0.6 + Math.random() * 0.6));
      if (bot.answered >= cfg.count) bot.finished = true;
      emit(`match:${id}`);
    }
    if (Date.now() >= start + cfg.duration * 1000) { bot.finished = true; emit(`match:${id}`); }
  }, perQ) as unknown as number;

  return id;
}

export async function quickMatch(cfg: MatchConfig): Promise<string> {
  // brief "searching" delay so the matchmaking UI is visible
  await sleep(600);
  const s = init();
  // prefer an online friend as the opponent, else a seeded bot, else a fresh one
  const friendIds = s.edges.filter((e) => e.status === "accepted" && (e.requester === s.meId || e.addressee === s.meId))
    .map((e) => (e.requester === s.meId ? e.addressee : e.requester));
  const pool = (friendIds.length ? friendIds : Object.keys(s.profiles).filter((id) => id !== s.meId));
  let opp = pool[Math.floor(Math.random() * pool.length)];
  if (!opp) {
    const b = seedBots()[0]; s.profiles[b.id] = b; persist(); opp = b.id;
  }
  return startMatch(opp, "quick", cfg);
}

export async function createInvite(friend: string, cfg: MatchConfig): Promise<string> {
  await sleep(300);
  return startMatch(friend, "friend", cfg);
}

export async function acceptInvite(_matchId: string): Promise<void> { /* auto-active in local mode */ }

export async function cancelMatch(matchId: string): Promise<void> {
  const lm = matches[matchId];
  if (!lm) return;
  if (lm.timer) window.clearInterval(lm.timer);
  lm.match.status = "cancelled";
  emit(`match:${matchId}`);
}

export async function submitProgress(matchId: string, correct: number, answered: number, timeMs: number, finished: boolean): Promise<void> {
  const lm = matches[matchId];
  if (!lm) return;
  const mp = lm.players.find((p) => p.player === init().meId);
  if (!mp) return;
  mp.correct = correct; mp.answered = answered; mp.time_ms = timeMs; mp.finished = finished;
  emit(`match:${matchId}`);
}

export async function finishMatch(matchId: string): Promise<void> {
  const lm = matches[matchId];
  if (!lm || lm.match.status === "finished") return;
  const s = init();
  if (lm.timer) window.clearInterval(lm.timer);

  // Force-complete the bot at its current progress so results show immediately.
  lm.players.forEach((p) => { p.finished = true; });
  const [mine, theirs] = [lm.players.find((p) => p.player === s.meId)!, lm.players.find((p) => p.player !== s.meId)!];

  let winner: string | null = null;
  if (mine.correct !== theirs.correct) winner = mine.correct > theirs.correct ? mine.player : theirs.player;
  else if (mine.time_ms !== theirs.time_ms) winner = mine.time_ms < theirs.time_ms ? mine.player : theirs.player;

  lm.match.status = "finished";
  lm.match.winner = winner;
  lm.match.finished_at = nowISO();

  // Update durable stats + head-to-head from "my" perspective.
  const myP = s.profiles[s.meId];
  const oppP = s.profiles[theirs.player];
  const drew = winner === null;
  const iWon = winner === s.meId;
  if (myP) {
    myP.games_played += 1; myP.total_score += mine.correct * 100; myP.weekly_score += mine.correct * 100;
    myP.correct_answers += mine.correct; myP.total_answers += mine.answered;
    if (drew) myP.draws += 1; else if (iWon) myP.wins += 1; else myP.losses += 1;
  }
  if (oppP) {
    oppP.games_played += 1; oppP.total_score += theirs.correct * 100; oppP.weekly_score += theirs.correct * 100;
    if (drew) oppP.draws += 1; else if (iWon) oppP.losses += 1; else oppP.wins += 1;
  }
  const h = s.h2h[theirs.player] ?? { total: 0, my_wins: 0, their_wins: 0, draws: 0 };
  h.total += 1;
  if (drew) h.draws += 1; else if (iWon) h.my_wins += 1; else h.their_wins += 1;
  s.h2h[theirs.player] = h;

  persist();
  emit(`match:${matchId}`);
  emit("friends");
}

export async function getMatch(id: string): Promise<Match | null> {
  return matches[id] ? { ...matches[id].match } : null;
}
export async function getMatchPlayers(id: string): Promise<MatchPlayer[]> {
  return matches[id] ? matches[id].players.map((p) => ({ ...p })) : [];
}

// ---------- Realtime --------------------------------------------------------
type Unsub = () => void;
export function subscribeMatch(id: string, onChange: () => void): Unsub { return on(`match:${id}`, onChange); }
export function subscribeInvites(_me: string, _onInvite: () => void): Unsub { return () => {}; }
export function subscribeFriends(_me: string, onChange: () => void): Unsub { return on("friends", onChange); }

export const serverNow = (): number => Date.now();
