# PERFORMANCE REPORT — Kingdom of Knowledge

## Bundle (production build)

| Chunk | Before this pass | After |
|-------|------------------|-------|
| Main (game) `index-*.js` | 1,457 KB (443 KB gz) — **included supabase + online UI** | **1,219 KB (380 KB gz)** |
| Online layer `OnlineApp-*.js` | (in main) | **240 KB (64 KB gz), lazy** |
| Fonts | 12 woff2, ~156 KB total | unchanged |

**Improvement:** the online layer (Supabase SDK + multiplayer UI) is now
`React.lazy` + `Suspense`, split into its own chunk that loads **off the
first-paint path**. The game's critical bundle dropped by ~240 KB (~63 KB gzip),
so startup parse/exec on mid-range iPhones is meaningfully lighter — and offline
players never download/parse the online code until it's needed.

## Rendering / re-renders

- **Game:** injects a single static `<style>{CSS}</style>` once; uses `useMemo`/
  `useCallback`/`useRef` throughout; animations are GPU-friendly CSS transforms with
  a global "reduce motion" switch (`data-motion`) honored for accessibility. Left
  intact — no regressions introduced.
- **Online UI:** local component state only; realtime subscriptions drive targeted
  refetches rather than global re-renders. Lists are small (≤100 leaderboard rows,
  friends, ≤10 duel questions). The duel countdown ticks at 250 ms and updates only
  a small timer node.
- **Error boundaries** add negligible overhead and prevent the worst performance
  failure of all — a white-screen requiring a force-quit.

## Memory

- No external image/audio assets are loaded (audio is synthesized on demand via
  WebAudio; icons are inline SVG), so there's no large media cache.
- Realtime channels are created on mount and **removed on unmount** (verified in
  every `subscribe*` cleanup), so subscriptions don't leak across screen changes.
- Presence uses a single 60 s `last_seen` heartbeat; leaderboards/friends use light
  20–30 s polling as a fallback to realtime — cheap and bounded.

## Inherent cost (documented, not a regression)

- The game embeds ~5,000 questions (`RAW_BANK`, ~980 KB JSON) parsed once at startup.
  This is intrinsic to the offline single-file design. It parses quickly on modern
  hardware; if future profiling shows it hurting cold-start on older devices, it can
  be moved to a lazily-fetched JSON asset without changing gameplay. Not changed here
  to avoid touching validated content.

## Net result
Lighter, code-split startup; bounded, leak-free realtime; crash-proof rendering.
Smooth gameplay is expected on mid-range iPhones; confirm cold-start feel on a
physical device as the final check.
