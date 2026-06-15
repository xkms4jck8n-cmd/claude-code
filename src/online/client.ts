import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isOnlineConfigured } from "./config";

// A single shared Supabase client for the whole app, or null if the backend
// has not been configured yet. Session is persisted in localStorage so the
// anonymous account survives app restarts (works inside the iOS WKWebView).
let _client: SupabaseClient | null = null;

export function getClient(): SupabaseClient | null {
  if (!isOnlineConfigured()) return null;
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "kok_online_auth",
      },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return _client;
}

/** Throwing accessor for code paths that require a configured client. */
export function requireClient(): SupabaseClient {
  const c = getClient();
  if (!c) throw new Error("الخدمة غير مهيّأة (Supabase not configured)");
  return c;
}
