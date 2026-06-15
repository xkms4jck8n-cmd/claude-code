import React from "react";
import { createRoot } from "react-dom/client";
import Kingdom from "./BrainKingdom";
import { ErrorBoundary } from "./ErrorBoundary";
import { initNotifications } from "./notifications";

// Lazy-load the online layer so supabase-js + the multiplayer UI are split into
// their own chunk and never block the game's first paint.
const OnlineApp = React.lazy(() => import("./online/OnlineApp"));

const container = document.getElementById("root");
if (!container) {
  throw new Error('Root element "#root" was not found in index.html');
}

createRoot(container).render(
  <React.StrictMode>
    {/* Game and online layer are isolated: a crash in one cannot take down the
        other, and neither can white-screen the app. */}
    <ErrorBoundary name="game">
      <Kingdom />
    </ErrorBoundary>
    <ErrorBoundary name="online" fallback={false}>
      <React.Suspense fallback={null}>
        <OnlineApp />
      </React.Suspense>
    </ErrorBoundary>
  </React.StrictMode>
);

// Request notification permission on first launch and schedule local
// notifications (welcome-back, energy, daily reward/challenge, season, streak,
// weekly event). Safe no-op on web. Deferred so it never blocks first paint.
window.addEventListener("load", () => {
  setTimeout(() => { void initNotifications(); }, 1200);
});
