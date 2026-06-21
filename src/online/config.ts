// Supabase connection config, read from Vite env at build time.
// Provide these in a .env file (see .env.example) or your CI secrets:
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJ...
//
// LOCAL / OFFLINE MODE
// When the Supabase vars are absent, the online layer no longer disables itself
// and blocks behind "configure ONLINE_SETUP.md". Instead it runs against a fully
// local, in-memory simulation backend (see mockBackend.ts) so friends, duels and
// leaderboards are testable with ZERO external servers (local dev + Xcode).
//
//   • Default (no env):      LOCAL MODE on  → simulated backend, everything works
//   • Real Supabase creds:   LOCAL MODE off → talks to the real server
//   • Force local for QA even when creds exist: VITE_OFFLINE_MODE=1

export const SUPABASE_URL: string = (import.meta.env.VITE_SUPABASE_URL as string) || "";
export const SUPABASE_ANON_KEY: string = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";

/** True only when real Supabase credentials are present. */
export const hasSupabase = (): boolean => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const FORCE_OFFLINE = ((import.meta.env.VITE_OFFLINE_MODE as string) || "").toString() === "1"
  || ((import.meta.env.VITE_OFFLINE_MODE as string) || "").toString().toLowerCase() === "true";

/** When true, the online layer uses the local simulation backend instead of
 *  Supabase. Auto-enabled whenever no real backend is configured. */
export const isLocalMode = (): boolean => FORCE_OFFLINE || !hasSupabase();

/** The online layer is "configured" (UI visible, flows enabled) whenever a real
 *  backend is present OR the local simulation is active — i.e. always. This is
 *  what removes the hard dependency on ONLINE_SETUP.md / Supabase. */
export const isOnlineConfigured = (): boolean => hasSupabase() || isLocalMode();
