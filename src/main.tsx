import React from "react";
import { createRoot } from "react-dom/client";
import Kingdom from "./BrainKingdom";
import OnlineOverlay from "./online/OnlineApp";
import { OnlineProvider } from "./online/useOnline";
import { ErrorBoundary } from "./ErrorBoundary";
import { initNotifications } from "./notifications";

const container = document.getElementById("root");
if (!container) {
  throw new Error('Root element "#root" was not found in index.html');
}

createRoot(container).render(
  <React.StrictMode>
    {/* One OnlineProvider wraps everything so the game's own Profile / Leaderboard
        / Friends screens AND the online overlay share a single real session and
        live data. Game and online layer are isolated by error boundaries: a crash
        in one cannot white-screen the other. */}
    <OnlineProvider>
      <ErrorBoundary name="game">
        <Kingdom />
      </ErrorBoundary>
      <ErrorBoundary name="online" fallback={false}>
        <OnlineOverlay />
      </ErrorBoundary>
    </OnlineProvider>
  </React.StrictMode>
);

// Request notification permission on first launch and schedule local
// notifications (welcome-back, energy, daily reward/challenge, season, streak,
// weekly event). Safe no-op on web. Deferred so it never blocks first paint.
window.addEventListener("load", () => {
  setTimeout(() => { void initNotifications(); }, 1200);
});
