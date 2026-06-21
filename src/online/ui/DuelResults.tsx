import React, { useEffect, useState } from "react";
import * as api from "../api";
import type { Match, MatchPlayer, HeadToHead } from "../types";
import { T, card } from "./theme";
import { Avatar, Btn, Pill, fmtTime } from "./parts";

export function DuelResults({ match, players, me, onExit }: {
  match: Match; players: { id: string; name: string; color: string; mp?: MatchPlayer }[];
  me: string; onExit: () => void;
}) {
  const [h2h, setH2h] = useState<HeadToHead | null>(null);
  const other = players.find((p) => p.id !== me);

  useEffect(() => {
    if (other) api.headToHead(other.id).then(setH2h).catch(() => {});
  }, [other?.id]);

  const iWon = match.winner === me;
  const draw = !match.winner;
  const banner = draw ? "تعادل!" : iWon ? "فزت! 🎉" : "حظ أوفر المرة القادمة";
  const bannerColor = draw ? T.cyan : iWon ? T.gold : T.red;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: bannerColor }}>{banner}</div>
        {match.winner && (
          <div style={{ fontSize: 13, color: T.inkDim, marginTop: 4 }}>
            الفائز: {players.find((p) => p.id === match.winner)?.name}
          </div>
        )}
      </div>

      {/* side-by-side comparison */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {players.map((p) => {
          const winner = match.winner === p.id;
          return (
            <div key={p.id} style={{
              ...card, padding: 14, textAlign: "center",
              border: `1px solid ${winner ? T.gold : T.line}`,
              background: winner ? `linear-gradient(160deg, ${T.gold}22, ${T.card2})` : (card.background as string),
            }}>
              <Avatar name={p.name} color={p.color} size={46} />
              <div style={{ fontWeight: 800, marginTop: 6, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.name}{p.id === me ? " (أنت)" : ""}
              </div>
              {winner && <div style={{ marginTop: 4 }}><Pill color={T.gold}>الفائز 👑</Pill></div>}
              <div style={{ marginTop: 10, fontSize: 30, fontWeight: 900, color: T.cyan }}>{p.mp?.correct ?? 0}</div>
              <div style={{ fontSize: 11, color: T.inkDim }}>إجابات صحيحة من {match.question_count}</div>
              <div style={{ marginTop: 8, display: "flex", justifyContent: "center", gap: 12, fontSize: 12 }}>
                <span>⏱ {fmtTime(p.mp?.time_ms ?? 0)}</span>
                <span>{p.mp?.finished ? "أكمل ✅" : "لم يُكمل"}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* head-to-head */}
      {other && h2h && (
        <div style={{ ...card, padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: T.inkDim, marginBottom: 6 }}>سجل المواجهات مع {other.name} ({h2h.total})</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 18, fontWeight: 900 }}>
            <span style={{ color: T.green }}>{h2h.my_wins} لك</span>
            <span style={{ color: T.inkDim }}>{h2h.draws} تعادل</span>
            <span style={{ color: T.red }}>{h2h.their_wins} له</span>
          </div>
          {h2h.total > 0 && (
            <div style={{ fontSize: 11.5, color: T.inkDim, marginTop: 6 }}>
              نسبة فوزك: {Math.round((h2h.my_wins / h2h.total) * 100)}%
            </div>
          )}
        </div>
      )}

      <Btn onClick={onExit}>عودة</Btn>
    </div>
  );
}
