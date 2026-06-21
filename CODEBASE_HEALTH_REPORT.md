# CODEBASE HEALTH REPORT — Kingdom of Knowledge

## Overall

| Metric | Result |
|--------|--------|
| `tsc --noEmit` (strict-checked: online, notifications, main, error boundary) | **exit 0** |
| `vite build` | **success, no warnings** |
| Navigation integrity (setScreen → render guard) | **21/21 routed** |
| Icon reference integrity | **0 missing** of 64 ids / 82-key map |
| Asset reference integrity | **0 missing** after the font fix |
| External file assets that could break | **none** (synthesized audio, inline SVG icons) |

## Structure

```
src/
  BrainKingdom.tsx     the game (vendored single-file artifact, @ts-nocheck)
  main.tsx             entry: mounts game + lazy online layer, both error-boundaried
  ErrorBoundary.tsx    crash isolation + RTL recovery UI                     [new]
  notifications.ts     local notification scheduler (Capacitor)
  online/              real-time multiplayer (Supabase): config, client, api,
                       useOnline, OnlineApp, ui/*, questions, types
supabase/schema.sql    DB schema + RLS + RPCs
scripts/               asset + font generators
```

## Issues found & fixed (integrity / runtime)

1. **Broken imports / missing deps:** none found. All `import`s resolve; the game's
   `RAW_BANK`/`CATEGORIES` are now properly `export`ed and consumed by the online
   question provider.
2. **Realtime correctness:** fixed a Supabase **channel-topic collision**
   (`subscribeFriends` shared a constant topic across two components). All channels
   now use unique topics. (Detail in `FULL_AUDIT_REPORT.md`.)
3. **Null/undefined safety:**
   - `ensureSession()` no longer dereferences a possibly-null `user` (anon-auth-disabled case).
   - The duel finalizer passes final correct/answered **explicitly** (fixed in the
     previous pass) so an async state update can't drop the last answer.
   - Optional chaining/guards across the online UI for absent profiles/opponents.
4. **Async loading bugs:** the online provider has explicit `connecting / ready /
   error` states with a retry path; failures surface in UI instead of hanging.
   Notifications and online init are deferred so they never block first paint.
5. **Error handling (#9):** new `ErrorBoundary` wraps the game and the online layer
   **independently** — a fault in one renders a recovery card (game) or silently
   no-ops (online overlay) without taking down the other. The online layer also
   degrades gracefully to "not configured" with no backend.
6. **Placeholder / dummy logic:** none in the application code. The online system is
   built on **real accounts + server-authoritative stats** (no fake users/data); the
   only literal "placeholder" string is an `<input placeholder>` attribute, which is
   correct usage.

## State management

- Game: self-contained React state + durable `localStorage` save (with in-memory
  fallback). The save path now also publishes a compact context for the notification
  scheduler — decoupled, wrapped in try/catch, non-fatal on failure.
- Online: a single React context (`useOnline`) owns session/profile/presence; feature
  panels own their local view state and subscribe to realtime + a light poll fallback.
  No duplicated/conflicting global stores.

## Known constraints (intentional, documented)

- `BrainKingdom.tsx` is type-checked-exempt (`@ts-nocheck`) because it's a large
  vendored artifact authored for a loose runtime; it builds via esbuild and is audited
  structurally. Rewriting it for strict types is out of scope (high risk, no runtime
  benefit). New code (`src/online`, `src/notifications.ts`, `src/ErrorBoundary.tsx`)
  **is** fully type-checked.
- Multiplayer duels are 1-v-1 in the UI; the schema generalizes to N players.
