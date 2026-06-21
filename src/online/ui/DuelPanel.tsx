import React, { useState } from "react";
import * as api from "../api";
import { pickQuestions, CATEGORY_LIST } from "../questions";
import { useOnline } from "../useOnline";
import { T, card } from "./theme";
import { Btn, Spinner } from "./parts";

const COUNTS = [5, 7, 10];
const SECS_PER_Q = 12;

export function DuelPanel({ onStart }: { onStart: (matchId: string) => void }) {
  const { pendingInviteMatch, clearPendingInvite } = useOnline();
  const [category, setCategory] = useState<string | null>(null);
  const [count, setCount] = useState(7);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const duration = Math.max(30, count * SECS_PER_Q);

  const quick = async () => {
    setErr(null); setSearching(true);
    try {
      const questions = pickQuestions(category, count);
      const id = await api.quickMatch({ category, count, duration, questions });
      onStart(id);
    } catch (e: any) { setErr(e.message || String(e)); setSearching(false); }
  };

  const acceptInvite = async () => {
    if (!pendingInviteMatch) return;
    try { await api.acceptInvite(pendingInviteMatch); const id = pendingInviteMatch; clearPendingInvite(); onStart(id); }
    catch (e: any) { setErr(e.message); }
  };

  if (searching) return <Spinner label="جارٍ مطابقتك مع لاعب حقيقي…" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {pendingInviteMatch && (
        <div style={{ ...card, padding: 14, border: `1px solid ${T.gold}`, background: `linear-gradient(160deg, ${T.gold}1f, ${T.card2})` }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>⚔️ صديق يتحدّاك في مبارزة!</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={acceptInvite}>قبول التحدي</Btn>
            <Btn kind="ghost" onClick={clearPendingInvite}>لاحقاً</Btn>
          </div>
        </div>
      )}

      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 4 }}>المبارزة الفورية</div>
        <div style={{ fontSize: 12.5, color: T.inkDim, marginBottom: 14 }}>
          نفس الأسئلة، نفس الترتيب، ومؤقّت متزامن للطرفين — الأسرع والأدقّ يفوز.
        </div>

        {/* category */}
        <Label>الفئة</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
          <Chip active={category === null} color={T.cyan} onClick={() => setCategory(null)}>منوّعة</Chip>
          {CATEGORY_LIST.map((c) => (
            <Chip key={c.id} active={category === c.id} color={c.color} onClick={() => setCategory(c.id)}>{c.name}</Chip>
          ))}
        </div>

        {/* count */}
        <Label>عدد الأسئلة</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {COUNTS.map((n) => (
            <button key={n} onClick={() => setCount(n)} style={{
              padding: "10px 0", borderRadius: 11, fontWeight: 800, fontFamily: "inherit", cursor: "pointer",
              border: `1px solid ${count === n ? T.gold : T.line}`,
              background: count === n ? `linear-gradient(135deg, ${T.gold}, ${T.goldDeep})` : "transparent",
              color: count === n ? "#1c1407" : T.ink,
            }}>{n}</button>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: T.inkDim, marginTop: 8 }}>المدّة: {duration} ثانية</div>
      </div>

      {err && <div style={{ color: T.red, fontSize: 13, textAlign: "center" }}>{err}</div>}

      <Btn onClick={quick} style={{ padding: "14px 16px", fontSize: 16 }}>🔎 ابحث عن خصم</Btn>
      <div style={{ fontSize: 11.5, color: T.inkDim, textAlign: "center" }}>
        لتحدّي صديق معيّن، افتح تبويب «الأصدقاء» واضغط «تحدٍّ».
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, fontWeight: 800, color: T.inkDim, marginBottom: 7 }}>{children}</div>;
}

function Chip({ children, active, color, onClick }: { children: React.ReactNode; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 12px", borderRadius: 10, fontWeight: 800, fontSize: 12.5, fontFamily: "inherit", cursor: "pointer",
      border: `1px solid ${active ? color : T.line}`,
      background: active ? `${color}26` : "transparent", color: active ? color : T.ink,
    }}>{children}</button>
  );
}
