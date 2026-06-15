// Supabase connection config, read from Vite env at build time.
// Provide these in a .env file (see .env.example) or your CI secrets:
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJ...
// When absent, the online features degrade gracefully to a "not configured"
// state and the rest of the game keeps working offline.

export const SUPABASE_URL: string = (import.meta.env.VITE_SUPABASE_URL as string) || "";
export const SUPABASE_ANON_KEY: string = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";

export const isOnlineConfigured = (): boolean =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
