// Service layer: every online operation goes through here. UI never touches the
// Supabase client directly. All stat-mutating operations call security-definer
// RPCs so the server stays authoritative (real, un-forgeable data).
import { requireClient, getClient } from "./client";
import type {
  Profile, Match, MatchPlayer, FriendEdge, FriendView, HeadToHead, LeaderRow, Question,
} from "./types";

// ---------- Auth / profile --------------------------------------------------

/** Ensure an anonymous session exists (creates a real account on first run). */
export async function ensureSession(): Promise<string> {
  const sb = requireClient();
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) return session.user.id;
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) {
    throw new Error("تعذّر إنشاء الحساب — فعّل تسجيل الدخول المجهول في Supabase");
  }
  return data.user.id;
}

export async function ensureProfile(name?: string, icon?: string, color?: string, code?: string): Promise<Profile> {
  const sb = requireClient();
  const { data, error } = await sb.rpc("ensure_profile", {
    p_name: name ?? null, p_icon: icon ?? null, p_color: color ?? null, p_code: code ?? null,
  });
  if (error) throw error;
  return data as Profile;
}

export async function getProfile(id: string): Promise<Profile | null> {
  const sb = requireClient();
  const { data } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
  return (data as Profile) ?? null;
}

export async function touchLastSeen(): Promise<void> {
  const sb = getClient(); if (!sb) return;
  await sb.rpc("touch_last_seen");
}

let _offset = 0; // serverNow - clientNow, in ms
export async function syncServerClock(): Promise<void> {
  const sb = getClient(); if (!sb) return;
  const t0 = Date.now();
  const { data } = await sb.rpc("server_now");
  const t1 = Date.now();
  if (typeof data === "number") _offset = data - (t0 + (t1 - t0) / 2);
}
/** Server-synchronized "now" used for the duel countdown. */
export const serverNow = (): number => Date.now() + _offset;

// ---------- Friends ---------------------------------------------------------

export async function sendFriendRequest(code: string): Promise<FriendEdge> {
  const sb = requireClient();
  const { data, error } = await sb.rpc("friend_request", { p_code: code.trim().toUpperCase() });
  if (error) throw new Error(mapErr(error.message));
  return data as FriendEdge;
}
export async function respondFriend(id: string, accept: boolean): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.rpc("respond_friend", { p_id: id, p_accept: accept });
  if (error) throw error;
}
export async function removeFriend(other: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.rpc("remove_friend", { p_other: other });
  if (error) throw error;
}
export async function headToHead(other: string): Promise<HeadToHead> {
  const sb = requireClient();
  const { data, error } = await sb.rpc("head_to_head", { p_other: other });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as HeadToHead) ?? { total: 0, my_wins: 0, their_wins: 0, draws: 0 };
}

const ONLINE_WINDOW_MS = 90_000; // last_seen within 90s = online
function edgesToFriendIds(edges: FriendEdge[], me: string): string[] {
  return edges.filter((e) => e.status === "accepted")
    .map((e) => (e.requester === me ? e.addressee : e.requester));
}

export async function listFriendEdges(me: string): Promise<FriendEdge[]> {
  const sb = requireClient();
  const { data } = await sb.from("friendships").select("*")
    .or(`requester.eq.${me},addressee.eq.${me}`);
  return (data as FriendEdge[]) ?? [];
}

export async function listFriends(me: string): Promise<FriendView[]> {
  const sb = requireClient();
  const edges = await listFriendEdges(me);
  const ids = edgesToFriendIds(edges, me);
  if (!ids.length) return [];
  const { data } = await sb.from("profiles").select("*").in("id", ids);
  const profiles = (data as Profile[]) ?? [];
  const now = Date.now();
  return profiles.map((p) => ({
    profile: p,
    edge: edges.find((e) => e.requester === p.id || e.addressee === p.id)!,
    online: now - new Date(p.last_seen).getTime() < ONLINE_WINDOW_MS,
  }));
}

export interface RequestView { edge: FriendEdge; profile: Profile; }
export async function listIncomingRequests(me: string): Promise<RequestView[]> {
  const sb = requireClient();
  const { data: edges } = await sb.from("friendships").select("*")
    .eq("addressee", me).eq("status", "pending");
  const list = (edges as FriendEdge[]) ?? [];
  if (!list.length) return [];
  const { data: profs } = await sb.from("profiles").select("*")
    .in("id", list.map((e) => e.requester));
  const pm = new Map((profs as Profile[] ?? []).map((p) => [p.id, p]));
  return list.map((e) => ({ edge: e, profile: pm.get(e.requester)! })).filter((x) => x.profile);
}

// ---------- Leaderboards ----------------------------------------------------

async function lb(rpc: string, args: Record<string, unknown> = {}): Promise<LeaderRow[]> {
  const sb = requireClient();
  const { data, error } = await sb.rpc(rpc, args);
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => ({
    id: r.id, player_code: r.player_code, name: r.name, icon: r.icon, color: r.color,
    score: Number(r.score), wins: r.wins, games_played: r.games_played,
    accuracy: Number(r.accuracy), rank: Number(r.rank),
  }));
}
export const leaderboardGlobal = (limit = 100) => lb("leaderboard_global", { p_limit: limit });
export const leaderboardWeekly = (limit = 100) => lb("leaderboard_weekly", { p_limit: limit });
export const leaderboardFriends = () => lb("leaderboard_friends");

// ---------- Duel ------------------------------------------------------------

export interface MatchConfig {
  category: string | null;
  count: number;
  duration: number;
  questions: Question[];
}

export async function quickMatch(cfg: MatchConfig): Promise<string> {
  const sb = requireClient();
  const { data, error } = await sb.rpc("quick_match", {
    p_count: cfg.count, p_category: cfg.category, p_duration: cfg.duration, p_questions: cfg.questions,
  });
  if (error) throw error;
  return data as string;
}
export async function createInvite(friend: string, cfg: MatchConfig): Promise<string> {
  const sb = requireClient();
  const { data, error } = await sb.rpc("create_invite", {
    p_friend: friend, p_count: cfg.count, p_category: cfg.category,
    p_duration: cfg.duration, p_questions: cfg.questions,
  });
  if (error) throw new Error(mapErr(error.message));
  return data as string;
}
export async function acceptInvite(matchId: string): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.rpc("accept_invite", { p_match: matchId });
  if (error) throw error;
}
export async function cancelMatch(matchId: string): Promise<void> {
  const sb = getClient(); if (!sb) return;
  await sb.rpc("cancel_match", { p_match: matchId });
}
export async function submitProgress(matchId: string, correct: number, answered: number,
                                     timeMs: number, finished: boolean): Promise<void> {
  const sb = requireClient();
  const { error } = await sb.rpc("submit_progress", {
    p_match: matchId, p_correct: correct, p_answered: answered, p_time_ms: timeMs, p_finished: finished,
  });
  if (error) throw error;
}
export async function finishMatch(matchId: string): Promise<void> {
  const sb = getClient(); if (!sb) return;
  await sb.rpc("finish_match", { p_match: matchId });
}
export async function getMatch(id: string): Promise<Match | null> {
  const sb = requireClient();
  const { data } = await sb.from("matches").select("*").eq("id", id).maybeSingle();
  return (data as Match) ?? null;
}
export async function getMatchPlayers(id: string): Promise<MatchPlayer[]> {
  const sb = requireClient();
  const { data } = await sb.from("match_players").select("*").eq("match_id", id);
  return (data as MatchPlayer[]) ?? [];
}

// ---------- Realtime --------------------------------------------------------

type Unsub = () => void;

// Unique suffix per subscription so two components subscribing to the "same"
// logical stream never collide on a Supabase channel topic name.
let _chSeq = 0;
const chId = () => `${Date.now().toString(36)}-${_chSeq++}`;

/** Live updates for a single match row + its players. */
export function subscribeMatch(id: string, onChange: () => void): Unsub {
  const sb = requireClient();
  const ch = sb.channel(`match:${id}:${chId()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${id}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "match_players", filter: `match_id=eq.${id}` }, onChange)
    .subscribe();
  return () => { sb.removeChannel(ch); };
}

/** Live notifications of friend duel invites + accepts addressed to me. */
export function subscribeInvites(me: string, onInvite: () => void): Unsub {
  const sb = requireClient();
  const ch = sb.channel(`invites:${me}:${chId()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `invited=eq.${me}` }, onInvite)
    .subscribe();
  return () => { sb.removeChannel(ch); };
}

/** Live friend-graph changes (requests, accepts, removals) touching me. */
export function subscribeFriends(_me: string, onChange: () => void): Unsub {
  const sb = requireClient();
  const ch = sb.channel(`friends:${chId()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, onChange)
    .subscribe();
  return () => { sb.removeChannel(ch); };
}

function mapErr(msg: string): string {
  if (msg.includes("PLAYER_NOT_FOUND")) return "لا يوجد لاعب بهذا المعرّف";
  if (msg.includes("CANNOT_ADD_SELF")) return "لا يمكنك إضافة نفسك";
  if (msg.includes("NOT_FRIENDS")) return "هذا اللاعب ليس في قائمة أصدقائك";
  return msg;
}
