import React, { useCallback, useEffect, useState } from "react";
import * as api from "../api";
import type { LeaderRow } from "../types";
import { useOnline } from "../useOnline";
import { T, card } from "./theme";
import { Avatar, Empty, Spinner, fmtAcc } from "./parts";

type Scope = "global" | "weekly" | "friends";

const TABS: { id: Scope; label: string }[] = [
  { id: "global", label: "عالمي" },
  { id: "weekly", label: "أسبوعي" },
  { id: "friends", label: "الأصدقاء" },
];

export function LeaderboardPanel() {
  const { me } = useOnline();
  const [scope, setScope] = useState<Scope>("global");
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = scope === "global" ? await api.leaderboardGlobal()
        : scope === "weekly" ? await api.leaderboardWeekly()
        : await api.leaderboardFriends();
      setRows(data);
    } finally { setLoading(false); }
  }, [scope]);

  useEffect(() => {
    void load();
    // Live-ish: refresh on any profile change + light poll.
    const unsub = me ? api.subscribeFriends(me.id, () => { void load(); }) : () => {};
    const iv = window.setInterval(load, 20_000);
    return () => { unsub(); window.clearInterval(iv); };
  }, [load, me]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setScope(t.id)} style={{
            padding: "9px 0", borderRadius: 11, fontWeight: 800, fontSize: 13, fontFamily: "inherit", cursor: "pointer",
            border: `1px solid ${scope === t.id ? T.gold : T.line}`,
            background: scope === t.id ? `linear-gradient(135deg, ${T.gold}, ${T.goldDeep})` : "transparent",
            color: scope === t.id ? "#1c1407" : T.ink,
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? <Spinner label="جارٍ تحميل الترتيب…" /> : rows.length === 0 ? (
        <Empty icon="🏆" text="لا توجد بيانات بعد — العب مبارزة لتظهر في الترتيب!" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {rows.map((r) => {
            const mine = me && r.id === me.id;
            return (
              <div key={r.id} style={{
                ...card, padding: "9px 12px", display: "flex", alignItems: "center", gap: 11,
                border: `1px solid ${mine ? T.gold : T.line}`,
                background: mine ? `linear-gradient(160deg, ${T.gold}1f, ${T.card2})` : (card.background as string),
              }}>
                <div style={{ width: 26, textAlign: "center", fontWeight: 900, color: rank3(r.rank) }}>{medal(r.rank)}</div>
                <Avatar name={r.name} color={r.color} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.name}{mine ? " (أنت)" : ""}
                  </div>
                  <div style={{ fontSize: 11, color: T.inkDim }}>فوز {r.wins} · دقّة {fmtAcc(r.accuracy)} · {r.games_played} مباراة</div>
                </div>
                <div style={{ fontWeight: 900, color: T.gold, fontSize: 15 }}>{r.score.toLocaleString("en")}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}`);
const rank3 = (rank: number) => (rank <= 3 ? T.gold : T.inkDim);
