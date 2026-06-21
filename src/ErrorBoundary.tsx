import React from "react";

interface Props {
  children: React.ReactNode;
  /** Optional label shown in console for which subtree failed. */
  name?: string;
  /** When false, a crash renders nothing instead of the fallback card
   *  (used to isolate the optional online layer without covering the game). */
  fallback?: boolean;
}
interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors in a subtree so a single failure never
 * white-screens the whole app. Shows an RTL Arabic recovery card with a
 * reload action. Used to isolate the game and the online layer from each other.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surfaced for diagnostics; never throws further.
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ""}]`, error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback === false) return null;

    return (
      <div dir="rtl" style={{
        position: "fixed", inset: 0, zIndex: 100000,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 16, padding: 24, textAlign: "center",
        fontFamily: "'Tajawal','Cairo','Geeza Pro','Damascus','Al Nile',-apple-system,system-ui,'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif",
        background: "radial-gradient(ellipse at top, #121a33, #0b1020)", color: "#eef2fb",
      }}>
        <div style={{ fontSize: 40 }}>👑</div>
        <div style={{ fontSize: 18, fontWeight: 900 }}>حدث خطأ غير متوقع</div>
        <div style={{ fontSize: 13.5, color: "#9aa6c6", maxWidth: 320, lineHeight: 1.6 }}>
          نعتذر عن المقاطعة. تقدّمك محفوظ — أعد تحميل اللعبة للمتابعة.
        </div>
        <button onClick={() => window.location.reload()} style={{
          marginTop: 6, padding: "12px 22px", borderRadius: 12, border: "none", cursor: "pointer",
          fontFamily: "inherit", fontWeight: 800, fontSize: 15, color: "#1c1407",
          background: "linear-gradient(135deg, #e9c878, #c6941f)",
        }}>إعادة التحميل</button>
      </div>
    );
  }
}
