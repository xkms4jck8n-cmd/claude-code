import React, { useCallback, useEffect, useState } from "react";
import * as api from "../api";
import type { FriendView, HeadToHead, Profile } from "../types";
import { useOnline } from "../useOnline";
import { T, card } from "./theme";
import { Avatar, Btn, Empty, Pill, Spinner, fmtAcc } from "./parts";

export function FriendsPanel({ onInvite }: { onInvite: (friend: Profile) => void }) {
  const { me } = useOnline();
  const [friends, setFriends] = useState<FriendView[]>([]);
  const [requests, setRequests] = useState<api.RequestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [compare, setCompare] = useState<{ f: Profile; h2h: HeadToHead } | null>(null);

  const load = useCallback(async () => {
    if (!me) return;
    const [fr, rq] = await Promise.all([api.listFriends(me.id), api.listIncomingRequests(me.id)]);
    setFriends(fr); setRequests(rq); setLoading(false);
  }, [me]);

  useEffect(() => {
    void load();
    if (!me) return;
    const unsub = api.subscribeFriends(me.id, () => { void load(); });
    const iv = window.setInterval(load, 30_000); // refresh online status
    return () => { unsub(); window.clearInterval(iv); };
  }, [me, load]);

  const add = async () => {
    setMsg(null);
    try {
      const e = await api.sendFriendRequest(code);
      setCode("");
      setMsg({ t: e.status === "accepted" ? "تمت إضافة الصديق!" : "تم إرسال الطلب", ok: true });
      void load();
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
  };

  const openCompare = async (f: Profile) => {
    const h2h = await api.headToHead(f.id);
    setCompare({ f, h2h });
  };

  if (!me) return <Spinner label="جارٍ التحميل…" />;
  if (compare) return <Compare me={me} f={compare.f} h2h={compare.h2h} onBack={() => setCompare(null)}
    onInvite={() => { setCompare(null); onInvite(compare.f); }} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* My ID */}
      <div style={{ ...card, padding: 14 }}>
        <div style={{ fontSize: 12, color: T.inkDim, marginBottom: 6 }}>معرّفك (شاركه ليضيفك أصدقاؤك)</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, fontWeight: 900, fontSize: 18, letterSpacing: ".06em", color: T.gold }}>{me.player_code}</div>
          <Btn kind="ghost" onClick={() => { try { navigator.clipboard?.writeText(me.player_code); setMsg({ t: "تم نسخ المعرّف", ok: true }); } catch { /* noop */ } }}>نسخ</Btn>
        </div>
      </div>

      {/* Add friend */}
      <div style={{ ...card, padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>إضافة صديق بالمعرّف</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="KOK-XXXXXX"
            style={{ flex: 1, padding: "10px 12px", borderRadius: 12, background: T.bg0, border: `1px solid ${T.line}`, color: T.ink, fontFamily: "inherit", fontSize: 14, textAlign: "center", letterSpacing: ".05em" }} />
          <Btn onClick={add} disabled={!code.trim()}>إضافة</Btn>
        </div>
        {msg && <div style={{ marginTop: 8, fontSize: 12.5, color: msg.ok ? T.green : T.red }}>{msg.t}</div>}
      </div>

      {/* Requests */}
      {requests.length > 0 && (
        <div>
          <Header>طلبات الصداقة ({requests.length})</Header>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {requests.map((r) => (
              <Row key={r.edge.id} p={r.profile}>
                <Btn onClick={async () => { await api.respondFriend(r.edge.id, true); void load(); }} style={{ padding: "7px 12px" }}>قبول</Btn>
                <Btn kind="danger" onClick={async () => { await api.respondFriend(r.edge.id, false); void load(); }} style={{ padding: "7px 12px" }}>رفض</Btn>
              </Row>
            ))}
          </div>
        </div>
      )}

      {/* Friends */}
      <div>
        <Header>أصدقائي ({friends.length})</Header>
        {loading ? <Spinner /> : friends.length === 0 ? (
          <Empty icon="🫂" text="لا أصدقاء بعد — شارك معرّفك وابدأ التحدي!" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {friends.map((f) => (
              <Row key={f.profile.id} p={f.profile} online={f.online}>
                <Btn kind="ghost" onClick={() => openCompare(f.profile)} style={{ padding: "7px 10px", fontSize: 12.5 }}>مقارنة</Btn>
                <Btn onClick={() => onInvite(f.profile)} style={{ padding: "7px 10px", fontSize: 12.5 }}>تحدٍّ</Btn>
              </Row>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 900, color: T.inkDim, margin: "2px 2px 8px" }}>{children}</div>;
}

function Row({ p, online, children }: { p: Profile; online?: boolean; children?: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative" }}>
        <Avatar name={p.name} color={p.color} />
        {online !== undefined && (
          <span style={{ position: "absolute", bottom: 0, insetInlineEnd: 0, width: 11, height: 11, borderRadius: "50%", background: online ? T.green : T.inkDim, border: `2px solid ${T.card}` }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
        <div style={{ fontSize: 11, color: T.inkDim }}>{p.player_code} · فوز {p.wins} · {online === undefined ? "" : online ? "متصل" : "غير متصل"}</div>
      </div>
      {children}
    </div>
  );
}

function Compare({ me, f, h2h, onBack, onInvite }: { me: Profile; f: Profile; h2h: HeadToHead; onBack: () => void; onInvite: () => void }) {
  const acc = (p: Profile) => p.total_answers > 0 ? p.correct_answers / p.total_answers : 0;
  const rows: [string, string, string][] = [
    ["النقاط", String(me.total_score), String(f.total_score)],
    ["الانتصارات", String(me.wins), String(f.wins)],
    ["المباريات", String(me.games_played), String(f.games_played)],
    ["الدقّة", fmtAcc(acc(me)), fmtAcc(acc(f))],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Btn kind="ghost" onClick={onBack} style={{ alignSelf: "flex-start" }}>‹ رجوع</Btn>
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", textAlign: "center" }}>
          <div><Avatar name={me.name} color={me.color} size={52} /><div style={{ fontWeight: 800, marginTop: 6, fontSize: 13 }}>أنت</div></div>
          <div style={{ fontWeight: 900, color: T.gold, fontSize: 20 }}>VS</div>
          <div><Avatar name={f.name} color={f.color} size={52} /><div style={{ fontWeight: 800, marginTop: 6, fontSize: 13 }}>{f.name}</div></div>
        </div>
        {/* head-to-head */}
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: T.bg0, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: T.inkDim, marginBottom: 6 }}>المواجهات المباشرة ({h2h.total})</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 18, fontWeight: 900 }}>
            <span style={{ color: T.green }}>{h2h.my_wins} لك</span>
            <span style={{ color: T.inkDim }}>{h2h.draws} تعادل</span>
            <span style={{ color: T.red }}>{h2h.their_wins} له</span>
          </div>
        </div>
        {/* stat compare */}
        <div style={{ marginTop: 12 }}>
          {rows.map(([label, a, b]) => (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.line}` }}>
              <div style={{ textAlign: "start", fontWeight: 800 }}>{a}</div>
              <div style={{ fontSize: 11.5, color: T.inkDim }}>{label}</div>
              <div style={{ textAlign: "end", fontWeight: 800 }}>{b}</div>
            </div>
          ))}
        </div>
      </div>
      <Btn onClick={onInvite}>ادعُه إلى مبارزة ⚔️</Btn>
    </div>
  );
}
