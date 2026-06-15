import React, { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../api";
import type { Match, MatchPlayer, Profile } from "../types";
import { T, card } from "./theme";
import { Avatar, Btn, Spinner } from "./parts";
import { DuelResults } from "./DuelResults";

export function DuelMatch({ matchId, me, onExit }: { matchId: string; me: Profile; onExit: () => void }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<MatchPlayer[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [remaining, setRemaining] = useState<number>(0);

  // local quiz state
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const finalizedRef = useRef(false);
  const lastSubmitRef = useRef(0);

  const refetch = useCallback(async () => {
    const [m, ps] = await Promise.all([api.getMatch(matchId), api.getMatchPlayers(matchId)]);
    if (m) setMatch(m);
    setPlayers(ps);
    // load any profiles we don't have yet
    const need = ps.map((p) => p.player).filter((id) => !profiles[id]);
    if (need.length) {
      const fetched = await Promise.all(need.map((id) => api.getProfile(id)));
      setProfiles((cur) => {
        const next = { ...cur };
        fetched.forEach((pr) => { if (pr) next[pr.id] = pr; });
        return next;
      });
    }
  }, [matchId, profiles]);

  useEffect(() => {
    void refetch();
    const unsub = api.subscribeMatch(matchId, () => { void refetch(); });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  // capture authoritative start time once the match goes active
  useEffect(() => {
    if (match?.status === "active" && match.started_at && !startedAtRef.current) {
      startedAtRef.current = new Date(match.started_at).getTime();
    }
  }, [match?.status, match?.started_at]);

  // Pass final correct/answered explicitly (state updates are async, so reading
  // them from a closure here would risk dropping the last answer).
  const finalizeSelf = useCallback(async (finished: boolean, timeMs: number, c: number, a: number) => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    try {
      await api.submitProgress(matchId, c, a, timeMs, finished);
      await api.finishMatch(matchId);
    } catch { /* server will also finalize on timeout */ }
  }, [matchId]);

  // synchronized countdown driven by the server clock + ends_at
  useEffect(() => {
    if (match?.status !== "active" || !match.ends_at) return;
    const end = new Date(match.ends_at).getTime();
    const tick = () => {
      const left = Math.max(0, Math.ceil((end - api.serverNow()) / 1000));
      setRemaining(left);
      if (left <= 0 && !finalizedRef.current) {
        const t = api.serverNow() - (startedAtRef.current || api.serverNow());
        void finalizeSelf(idx >= (match.questions?.length || 0), t, correct, idx);
      }
    };
    tick();
    const iv = window.setInterval(tick, 250);
    return () => window.clearInterval(iv);
  }, [match?.status, match?.ends_at, idx, correct, finalizeSelf, match?.questions]);

  if (!match) return <Spinner label="جارٍ تجهيز المبارزة…" />;

  // ----- WAITING (quick match looking for opponent / invite pending) -----
  if (match.status === "waiting") {
    const mine = match.created_by === me.id;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", padding: "20px 0" }}>
        <Spinner label={match.mode === "friend" ? "بانتظار قبول صديقك للتحدي…" : "جارٍ البحث عن خصم…"} />
        <div style={{ fontSize: 12.5, color: T.inkDim, textAlign: "center" }}>
          {match.question_count} أسئلة · {match.duration_s} ثانية
        </div>
        <Btn kind="danger" onClick={async () => { if (mine) await api.cancelMatch(matchId); onExit(); }}>إلغاء</Btn>
      </div>
    );
  }

  // ----- FINISHED -----
  if (match.status === "finished" || match.status === "cancelled") {
    const cells = players.map((mp) => {
      const pr = profiles[mp.player];
      return { id: mp.player, name: pr?.name || "لاعب", color: pr?.color || T.cyan, mp };
    });
    if (match.status === "cancelled") return <Centered text="أُلغيت المبارزة" onExit={onExit} />;
    return <DuelResults match={match} players={cells} me={me.id} onExit={onExit} />;
  }

  // ----- ACTIVE: the quiz -----
  const qs = match.questions || [];
  const opp = players.find((p) => p.player !== me.id);
  const oppPr = opp ? profiles[opp.player] : undefined;
  const q = qs[idx];

  const pick = async (opt: string) => {
    if (picked || !q) return;
    setPicked(opt);
    const isRight = opt === q.a;
    const newCorrect = correct + (isRight ? 1 : 0);
    if (isRight) setCorrect(newCorrect);
    const answered = idx + 1;
    // push live progress to opponent (lightly throttled)
    const now = Date.now();
    if (now - lastSubmitRef.current > 250) {
      lastSubmitRef.current = now;
      api.submitProgress(matchId, newCorrect, answered, api.serverNow() - (startedAtRef.current || api.serverNow()), false).catch(() => {});
    }
    window.setTimeout(() => {
      setPicked(null);
      if (answered >= qs.length) {
        const t = api.serverNow() - (startedAtRef.current || api.serverNow());
        void finalizeSelf(true, t, newCorrect, answered);
      } else {
        setIdx(answered);
      }
    }, 650);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* top bar: timer + progress + opponent */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ ...card, padding: "6px 12px", fontWeight: 900, color: remaining <= 5 ? T.red : T.gold, fontSize: 18, minWidth: 56, textAlign: "center" }}>
          {remaining}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ height: 8, borderRadius: 6, background: T.bg0, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(idx / Math.max(1, qs.length)) * 100}%`, background: T.cyan, transition: "width .3s" }} />
          </div>
          <div style={{ fontSize: 11, color: T.inkDim, marginTop: 3 }}>سؤال {Math.min(idx + 1, qs.length)} / {qs.length}</div>
        </div>
        {oppPr && (
          <div style={{ textAlign: "center" }}>
            <Avatar name={oppPr.name} color={oppPr.color} size={30} />
            <div style={{ fontSize: 10, color: T.inkDim, marginTop: 2 }}>خصمك: {opp?.correct ?? 0}✓</div>
          </div>
        )}
      </div>

      {/* question */}
      {q ? (
        <>
          <div style={{ ...card, padding: 18, minHeight: 90, display: "grid", placeItems: "center", textAlign: "center", fontWeight: 800, fontSize: 17, lineHeight: 1.5 }}>
            {q.q}
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {q.opts.map((opt) => {
              const isRight = opt === q.a;
              const show = picked !== null;
              const bg = show && isRight ? `${T.green}26`
                : show && opt === picked ? `${T.red}26` : (card.background as string);
              const bd = show && isRight ? T.green : show && opt === picked ? T.red : T.line;
              return (
                <button key={opt} disabled={show} onClick={() => pick(opt)} style={{
                  padding: "14px 16px", borderRadius: 13, textAlign: "start", fontFamily: "inherit",
                  fontWeight: 700, fontSize: 15, color: T.ink, cursor: show ? "default" : "pointer",
                  background: bg, border: `1.5px solid ${bd}`, transition: "background .15s, border-color .15s",
                }}>{opt}</button>
              );
            })}
          </div>
        </>
      ) : (
        <Spinner label="بانتظار انتهاء الخصم…" />
      )}
    </div>
  );
}

function Centered({ text, onExit }: { text: string; onExit: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", padding: "30px 0" }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: T.inkDim }}>{text}</div>
      <Btn onClick={onExit}>عودة</Btn>
    </div>
  );
}
