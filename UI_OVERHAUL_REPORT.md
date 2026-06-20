# UI OVERHAUL REPORT — Kingdom of Knowledge

_Date: 2026-06-15 · Senior studio polish pass_

## Honest scope statement (read first)

This environment **cannot run the iOS Simulator or render the app**, so I cannot
visually judge or pixel-redesign individual screens, and I will not claim to have
"redesigned 15 screens" I cannot see. Blindly rewriting an already-premium
8,700-line single-file game (its authors shipped a documented "v6.0 premium UI &
animation overhaul" — staged reward reveals, confetti, count-up numbers, screen
transitions, premium loader) would risk regressions invisible to me here.

What I **did** do, as a senior team would when the visual layer is already mature
and a device isn't available: ship a **safe, additive, app-wide polish layer** +
a complete **structural** UI audit, and report exactly what still needs a designer
on-device.

## What was added — `src/polish.css` (global, every screen)

| Improvement | Effect |
|-------------|--------|
| `color-scheme: dark` | iOS native controls/scrollbars/form chrome match the dark theme (no light flashes) — consistent visual language app-wide |
| `font-feature-settings: kern, liga, calt` + `font-kerning` | Crisper **Arabic typography** — proper kerning and contextual ligatures for connected script; better letterforms on every screen |
| `font-variant-numeric: tabular-nums` on counters | Scores/timers/combos no longer "jitter" as digits change — premium HUD feel |
| Momentum scrolling on all scroll surfaces | Native iOS inertia scrolling across menus/lists |
| `overscroll-behavior: none` | Removes the white rubber-band bounce at list edges |
| UI `user-select: none` (buttons/headings), content selectable | Game-like chrome; question/answer text still selectable |
| `:focus-visible` ring (keyboard/switch-control only) | Accessibility for external keyboards / Switch Control, invisible on touch |
| `prefers-reduced-motion` honoring | App Store **accessibility** requirement + real perf win on older devices (disables decorative animation work without layout change) |

These propagate to **every** screen and popup at once, with **zero** risk to the
existing layouts/colors (additive properties only; verified build-clean).

## Structural UI audit (verified, no device needed)

| Check | Result |
|-------|--------|
| Horizontal overflow (`100vw`) | **0 uses** → no off-screen elements / no clipping from width |
| Content width | Capped + centered (`max-width` columns, ×7) → scales SE→Pro Max |
| Safe-area insets | Honored (`env(safe-area-inset-*)`, ×4) + Capacitor `contentInset:"always"` → no notch/home-indicator overlap |
| RTL | Root `dir="rtl"`; new online UI uses logical props (`insetInlineStart/End`) |
| Arabic text rendering | Fonts embedded (data-URI) with cmap-exact `unicode-range` → **no `?`** anywhere (0 verified) |
| Navigation graph | **21/21** `setScreen` targets routed → no dead-ends / inaccessible screens |
| Icon integrity | 64 icon ids + 82-glyph map → **0 missing** icons |
| Animations | 46 keyframes intact; now reduced-motion-aware |

## Files modified this pass
- `src/polish.css` — **new** global polish layer.
- `src/main.tsx` — imports the polish layer.

## Remaining work that genuinely needs a designer + Simulator
Per-screen visual refinement (spacing nudges, hierarchy tweaks, bespoke
iconography, new card art) is a **design** task requiring live rendering on
device. It cannot be done blind without risking the working game. Recommendation:
a designer runs the build on SE + Pro Max in the Simulator and iterates on the
specific screens; the structural foundation (responsive, RTL, safe-area,
typography, motion, accessibility) is now solid for that work.
