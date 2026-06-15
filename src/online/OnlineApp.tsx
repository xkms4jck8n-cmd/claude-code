import React, { useState } from "react";
import { OnlineProvider, useOnline } from "./useOnline";
import * as api from "./api";
import { pickQuestions } from "./questions";
import type { Profile } from "./types";
import { T, font } from "./ui/theme";
import { Btn, Spinner } from "./ui/parts";
import { DuelPanel } from "./ui/DuelPanel";
import { LeaderboardPanel } from "./ui/LeaderboardPanel";
import { FriendsPanel } from "./ui/FriendsPanel";
import { DuelMatch } from "./ui/DuelMatch";

type Tab = "duel" | "leaderboard" | "friends";
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "duel", label: "مبارزة", icon: "⚔️" },
  { id: "leaderboard", label: "الترتيب", icon: "🏆" },
  { id: "friends", label: "الأصدقاء", icon: "🫂" },
];

/** Mount this once at the app root. It renders a floating launcher + the whole
 *  online experience in an overlay, fully isolated from the offline game. */
export default function OnlineApp() {
  return (
    <OnlineProvider>
      <OnlineRoot />
    </OnlineProvider>
  );
}

function OnlineRoot() {
  const { configured, status, pendingInviteMatch } = useOnline();
  const [open, setOpen] = useState(false);
  if (!configured) return null; // no button until a backend is configured

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="اللعب أونلاين" style={{
        position: "fixed", bottom: `calc(18px + env(safe-area-inset-bottom))`, insetInlineStart: 18,
        zIndex: 99990, width: 58, height: 58, borderRadius: "50%", cursor: "pointer",
        border: `2px solid ${T.gold}66`, fontFamily: font, fontSize: 24,
        background: `linear-gradient(135deg, ${T.gold}, ${T.goldDeep})`, color: "#1c1407",
        boxShadow: "0 8px 24px rgba(0,0,0,.45)",
      }}>
        ⚔️
        {(status === "connecting") && <Dot color={T.cyan} />}
        {(status === "error") && <Dot color={T.red} />}
        {pendingInviteMatch && <Badge />}
      </button>
      {open && <OnlineModal onClose={() => setOpen(false)} />}
    </>
  );
}

function Dot({ color }: { color: string }) {
  return <span style={{ position: "absolute", top: 4, insetInlineEnd: 4, width: 12, height: 12, borderRadius: "50%", background: color, border: `2px solid ${T.bg0}` }} />;
}
function Badge() {
  return <span style={{ position: "absolute", top: -2, insetInlineEnd: -2, width: 18, height: 18, borderRadius: "50%", background: T.red, color: "#fff", fontSize: 11, fontWeight: 900, display: "grid", placeItems: "center", border: `2px solid ${T.bg0}` }}>!</span>;
}

function OnlineModal({ onClose }: { onClose: () => void }) {
  const { status, me, error, retry } = useOnline();
  const [tab, setTab] = useState<Tab>("duel");
  const [activeMatch, setActiveMatch] = useState<string | null>(null);

  const inviteFriend = async (friend: Profile) => {
    try {
      const questions = pickQuestions(null, 7);
      const id = await api.createInvite(friend.id, { category: null, count: 7, duration: 84, questions });
      setActiveMatch(id);
    } catch (e) { /* surfaced inside panel normally */ }
  };

  return (
    <div dir="rtl" style={{
      position: "fixed", inset: 0, zIndex: 99991, fontFamily: font, color: T.ink,
      background: `radial-gradient(ellipse at top, ${T.bg1}, ${T.bg0})`,
      display: "flex", flexDirection: "column",
      paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${T.line}` }}>
        <div style={{ fontWeight: 900, fontSize: 17, flex: 1 }}>
          {activeMatch ? "مبارزة مباشرة" : "أونلاين"}
          {me && !activeMatch && <span style={{ fontSize: 11.5, color: T.inkDim, fontWeight: 700 }}> · {me.player_code}</span>}
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: T.inkDim, fontSize: 26, cursor: "pointer", lineHeight: 1 }}>×</button>
      </div>

      {/* body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, maxWidth: 520, width: "100%", margin: "0 auto" }}>
        {status === "connecting" && <Spinner label="جارٍ الاتصال بالخادم…" />}
        {status === "error" && (
          <div style={{ textAlign: "center", padding: 30, color: T.inkDim }}>
            <div style={{ fontSize: 14, marginBottom: 12 }}>تعذّر الاتصال بالخادم.</div>
            <div style={{ fontSize: 12, color: T.red, marginBottom: 16, direction: "ltr" }}>{error}</div>
            <Btn onClick={retry}>إعادة المحاولة</Btn>
          </div>
        )}
        {status === "ready" && me && (
          activeMatch ? (
            <DuelMatch matchId={activeMatch} me={me} onExit={() => setActiveMatch(null)} />
          ) : (
            <>
              {tab === "duel" && <DuelPanel onStart={setActiveMatch} />}
              {tab === "leaderboard" && <LeaderboardPanel />}
              {tab === "friends" && <FriendsPanel onInvite={inviteFriend} />}
            </>
          )
        )}
      </div>

      {/* bottom tab nav (hidden during a live match) */}
      {status === "ready" && !activeMatch && (
        <div style={{ display: "flex", borderTop: `1px solid ${T.line}`, paddingBottom: 2 }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "11px 0 13px", background: "transparent", border: "none", cursor: "pointer",
              fontFamily: "inherit", color: tab === t.id ? T.gold : T.inkDim, fontWeight: 800, fontSize: 12.5,
              borderTop: `2px solid ${tab === t.id ? T.gold : "transparent"}`,
            }}>
              <div style={{ fontSize: 19 }}>{t.icon}</div>{t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
