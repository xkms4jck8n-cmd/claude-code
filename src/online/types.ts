// Shared types for the online multiplayer system.

export interface Profile {
  id: string;
  player_code: string;
  name: string;
  icon: string;
  color: string;
  created_at: string;
  last_seen: string;
  total_score: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  correct_answers: number;
  total_answers: number;
  weekly_score: number;
  weekly_period: number;
}

export interface Question {
  q: string;
  a: string;
  opts: string[];
  d: number;
}

export type MatchStatus = "waiting" | "active" | "finished" | "cancelled";

export interface Match {
  id: string;
  status: MatchStatus;
  mode: "quick" | "friend";
  created_by: string;
  invited: string | null;
  category: string | null;
  question_count: number;
  questions: Question[];
  duration_s: number;
  created_at: string;
  started_at: string | null;
  ends_at: string | null;
  winner: string | null;
  finished_at: string | null;
}

export interface MatchPlayer {
  match_id: string;
  player: string;
  correct: number;
  answered: number;
  time_ms: number;
  finished: boolean;
  ready: boolean;
  joined_at: string;
}

export interface FriendEdge {
  id: string;
  requester: string;
  addressee: string;
  status: "pending" | "accepted";
  created_at: string;
}

export interface FriendView {
  profile: Profile;
  edge: FriendEdge;
  online: boolean;
}

export interface HeadToHead {
  total: number;
  my_wins: number;
  their_wins: number;
  draws: number;
}

export interface LeaderRow {
  id: string;
  player_code: string;
  name: string;
  icon: string;
  color: string;
  score: number;
  wins: number;
  games_played: number;
  accuracy: number; // 0..1
  rank: number;
}
