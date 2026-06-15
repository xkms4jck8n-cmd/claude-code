// Shared palette + style helpers for the online UI (matches the game's theme).
export const T = {
  bg0: "#0b1020",
  bg1: "#121a33",
  card: "#161f3d",
  card2: "#1d2747",
  line: "rgba(154,166,198,.18)",
  ink: "#eef2fb",
  inkDim: "#9aa6c6",
  gold: "#e9c878",
  goldDeep: "#c6941f",
  cyan: "#54e0c8",
  green: "#5fd38c",
  red: "#ef6f7b",
  rose: "#f08bb0",
  violet: "#9182f2",
  blue: "#5aa9ff",
};

export const font =
  "'Tajawal','Cairo','Geeza Pro','Damascus','Al Nile',-apple-system,system-ui,'Segoe UI',Tahoma,Arial,sans-serif";

export const card: React.CSSProperties = {
  background: `linear-gradient(160deg, ${T.card}, ${T.card2})`,
  border: `1px solid ${T.line}`,
  borderRadius: 16,
};
