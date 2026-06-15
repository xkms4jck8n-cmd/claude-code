import React from "react";
import { T } from "./theme";

export function Avatar({ name, color, size = 38 }: { name: string; color: string; size?: number }) {
  const letter = (name || "?").trim().charAt(0);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      display: "grid", placeItems: "center", fontWeight: 900, color: "#1c1407",
      fontSize: size * 0.42, background: `linear-gradient(135deg, ${color}, ${T.gold})`,
      border: `2px solid ${color}66`,
    }}>{letter}</div>
  );
}

export function Btn({ children, onClick, kind = "primary", disabled, style }: {
  children: React.ReactNode; onClick?: () => void;
  kind?: "primary" | "ghost" | "danger"; disabled?: boolean; style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = {
    padding: "10px 16px", borderRadius: 12, fontWeight: 800, fontSize: 14,
    cursor: disabled ? "default" : "pointer", border: "1px solid transparent",
    opacity: disabled ? 0.5 : 1, fontFamily: "inherit", transition: "filter .15s, transform .15s",
  };
  const kinds: Record<string, React.CSSProperties> = {
    primary: { background: `linear-gradient(135deg, ${T.gold}, ${T.goldDeep})`, color: "#1c1407" },
    ghost: { background: "transparent", color: T.ink, border: `1px solid ${T.line}` },
    danger: { background: "transparent", color: T.red, border: `1px solid ${T.red}55` },
  };
  return (
    <button disabled={disabled} onClick={onClick} style={{ ...base, ...kinds[kind], ...style }}
      onMouseDown={(e) => { if (!disabled) (e.currentTarget.style.transform = "scale(.96)"); }}
      onMouseUp={(e) => (e.currentTarget.style.transform = "none")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}>
      {children}
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div style={{ display: "grid", placeItems: "center", gap: 12, padding: 30, color: T.inkDim }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        border: `3px solid ${T.line}`, borderTopColor: T.gold, animation: "kok-spin .9s linear infinite",
      }} />
      {label && <div style={{ fontSize: 13 }}>{label}</div>}
      <style>{`@keyframes kok-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export function Empty({ icon = "✦", text }: { icon?: string; text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "34px 18px", color: T.inkDim }}>
      <div style={{ fontSize: 30, marginBottom: 8, opacity: 0.6 }}>{icon}</div>
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  );
}

export function Pill({ children, color = T.cyan }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 8,
      background: `${color}22`, color, border: `1px solid ${color}44`, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

export const fmtTime = (ms: number) => {
  if (!ms) return "—";
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}ث` : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

export const fmtAcc = (a: number) => `${Math.round((a || 0) * 100)}%`;
