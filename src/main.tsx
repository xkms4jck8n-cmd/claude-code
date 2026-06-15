import React from "react";
import { createRoot } from "react-dom/client";
import Kingdom from "./BrainKingdom";
import OnlineApp from "./online/OnlineApp";
import { initNotifications } from "./notifications";

const container = document.getElementById("root");
if (!container) {
  throw new Error('Root element "#root" was not found in index.html');
}

createRoot(container).render(
  <React.StrictMode>
    <Kingdom />
    {/* Real-time online layer (duels, leaderboards, friends). Self-contained;
        renders nothing until a Supabase backend is configured via env vars. */}
    <OnlineApp />
  </React.StrictMode>
);

// Request notification permission on first launch and schedule local
// notifications (welcome-back, energy, daily reward/challenge, season, streak,
// weekly event). Safe no-op on web. Deferred so it never blocks first paint.
window.addEventListener("load", () => {
  setTimeout(() => { void initNotifications(); }, 1200);
});
