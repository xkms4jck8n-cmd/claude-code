import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { isOnlineConfigured } from "./config";
import { getClient } from "./client";
import * as api from "./api";
import type { Profile } from "./types";

type Status = "disabled" | "connecting" | "ready" | "error";

interface OnlineCtx {
  configured: boolean;
  status: Status;
  me: Profile | null;
  error: string | null;
  pendingInviteMatch: string | null;
  clearPendingInvite: () => void;
  refreshMe: () => Promise<void>;
  retry: () => void;
}

const Ctx = createContext<OnlineCtx | null>(null);

/** Read the player's chosen name/avatar from the offline game save to seed the
 *  online profile (so accounts are real and personalized, never "dummy"). */
function seedFromGame(): { name?: string; icon?: string; color?: string } {
  try {
    const raw = localStorage.getItem("kingdom-save-v5");
    if (!raw) return {};
    const pr = JSON.parse(raw)?.player?.profile || {};
    return { name: pr.name, icon: pr.icon, color: pr.color };
  } catch { return {}; }
}

export function OnlineProvider({ children }: { children: React.ReactNode }) {
  const configured = isOnlineConfigured();
  const [status, setStatus] = useState<Status>(configured ? "connecting" : "disabled");
  const [me, setMe] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingInviteMatch, setPendingInviteMatch] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const heartbeat = useRef<number | null>(null);

  const refreshMe = useCallback(async () => {
    if (!configured) return;
    const id = (await api.ensureSession());
    const p = await api.getProfile(id);
    if (p) setMe(p);
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    let unsubInvites: (() => void) | null = null;

    (async () => {
      try {
        setStatus("connecting");
        await api.ensureSession();
        await api.syncServerClock();
        const seed = seedFromGame();
        const prof = await api.ensureProfile(seed.name, seed.icon, seed.color);
        if (cancelled) return;
        setMe(prof);
        setStatus("ready");

        // Presence heartbeat → drives friends online/offline status.
        await api.touchLastSeen();
        heartbeat.current = window.setInterval(() => { void api.touchLastSeen(); }, 60_000);

        // Listen for friend duel invites addressed to me.
        unsubInvites = api.subscribeInvites(prof.id, async () => {
          // Surface the newest waiting invite (if any) to the UI.
          try {
            const sb = getClient();
            if (!sb) return;
            const { data } = await sb.from("matches").select("id")
              .eq("invited", prof.id).eq("status", "waiting")
              .order("created_at", { ascending: false }).limit(1).maybeSingle();
            if (data?.id) setPendingInviteMatch(data.id as string);
          } catch { /* ignore */ }
        });
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || String(e));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (heartbeat.current) window.clearInterval(heartbeat.current);
      if (unsubInvites) unsubInvites();
    };
  }, [configured, tick]);

  const value: OnlineCtx = {
    configured, status, me, error, pendingInviteMatch,
    clearPendingInvite: () => setPendingInviteMatch(null),
    refreshMe,
    retry: () => { setError(null); setTick((t) => t + 1); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnline(): OnlineCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useOnline must be used within OnlineProvider");
  return c;
}
