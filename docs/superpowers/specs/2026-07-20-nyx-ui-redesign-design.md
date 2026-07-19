# Nyx — Native UI Redesign Design Spec

**Date:** 2026-07-20
**Status:** Approved (design), pending implementation plan
**Depends on:** shipped Nyx (v1 + v2 UI + detection-v2), all on `main`.
**Platform:** macOS 26.5.1, single-user personal app.

## 1. Purpose

The current UI reads as a flat web page. Make Nyx look and feel like a real, beautiful macOS
app: window **vibrancy** (frosted-glass material), SF Pro, the system **accent color**, HIG
spacing, and **native-style controls** (toggle switches, segmented control, steppers) — built
cleanly with **Tailwind** (compiled locally, offline) and **Lucide** icons. Dark appearance
always (bedside night app).

## 2. Goals

- Replace the flat dark theme with real macOS vibrancy/translucency on all windows.
- Rebuild all four surfaces (panel, settings, nudge, calibration) with Tailwind + a cohesive
  dark macOS design language.
- Native-feeling controls: pill toggles, a segmented control, number steppers, proper
  hover/active/focus states, system accent throughout.
- Lucide line icons (bundled, offline).
- Keep it fully offline; no behavior/logic changes; existing 68 unit tests stay green.
- Support dropping in an AI-generated logo → `.icns` + menu-bar template icon.

## 3. Non-Goals

- No light mode (dark only).
- No behavioral changes (state machine, detector, escalation, logging untouched).
- No React/component-kit rewrite (vanilla HTML/JS + Tailwind utility classes).
- No SF Symbols (Apple license forbids shipping them) — Lucide instead.
- No CDN anything (Tailwind compiled locally; icons bundled).

## 4. Key Decisions

| Decision | Choice |
|---|---|
| Native material | Electron `vibrancy` (transparent windows) — panel `popover`, settings/calibration `under-window`. |
| Styling | Tailwind, compiled locally to a static CSS file (no CDN, no runtime). |
| Icons | Lucide (`lucide-static` SVGs), bundled; only the used glyphs. |
| Appearance | Dark always. |
| Accent | System accent via `systemPreferences.getAccentColor()` → CSS var; default macOS blue. |
| Controls | Custom Tailwind: toggle switch, segmented control, number stepper. |
| Nudge overlay | Full-screen CSS `backdrop-blur` (overlay, not window material). |
| Logo | User generates via provided prompt; we convert PNG → `.icns` + tray template. |

## 5. Architecture

Presentation-only change. No `core/` or `services/` logic changes. Renderer files get
restyled markup + Tailwind classes; `windows.js` gets vibrancy options; `main.js` reads and
forwards the accent color; a Tailwind build step is added.

### Build pipeline (new)
- `tailwindcss` (devDependency). `tailwind.config.js` scans `src/renderer/**/*.{html,js}`.
- Input `src/renderer/styles/tailwind.css` (`@tailwind base/components/utilities` + a small
  `@layer base` for transparent body + font + accent var + component classes).
- Output `src/renderer/styles/app.css` (compiled, committed-ignored or committed — see §10).
- Scripts: `build:css` (one-shot) and `watch:css`; `build:css` runs in `prestart` and
  `predist` so the app never launches/packages without compiled CSS.
- `tokens.css` is removed; its values move into the Tailwind theme.

### Icons (new)
- `lucide-static` (devDependency). A tiny `scripts/copy-icons.js` copies the specific SVGs
  used (`moon`, `sliders-horizontal`, `sunrise`, `power`, `camera`, `check`, `scan-face`)
  into `src/renderer/icons/`. Renderer references them via `<img src="./icons/moon.svg">` or
  inlines them; they are recolored via CSS `filter`/`mask` to the accent/text color. Runs in
  `prestart`/`predist` alongside `build:css`.

## 6. Native Shell (vibrancy)

`windows.js`:
- **Panel:** `transparent: true`, `vibrancy: 'popover'`, `visualEffectState: 'active'`,
  `roundedCorners: true`, `backgroundColor: '#00000000'`, keep frameless/alwaysOnTop.
- **Settings / Calibration:** `transparent: true`, `vibrancy: 'under-window'`,
  `visualEffectState: 'active'`, `titleBarStyle: 'hiddenInset'` (settings) for a clean native
  chrome, `backgroundColor: '#00000000'`.
- **Detector:** unchanged (hidden, no UI).
- All renderer `<body>` backgrounds become transparent so the vibrancy shows; content sits on
  translucent surfaces (`bg-white/5`, hairline `border-white/10`).
- **Fallback:** if a window's vibrancy renders opaque/!rounded on this macOS build, the CSS
  still provides a dark translucent card with `backdrop-blur` so it degrades gracefully.

## 7. Design Language (dark, native)

Tailwind theme (`theme.extend`):
- Colors: `bg` transparent base; `surface` `rgba(255,255,255,0.05)`; `surface-2`
  `rgba(255,255,255,0.08)`; `hairline` `rgba(255,255,255,0.10)`; `text` `#F2F3F5`;
  `muted` `rgba(242,243,245,0.55)`; `accent` via `var(--accent)`; state dots
  grey/`accent`/amber.
- Font: SF Pro / `-apple-system` stack; tight, HIG-scale sizes.
- Radii: `xl` 12, `lg` 10, `md` 8. Soft shadows. Subtle top sheen on the panel.
- Accent: `--accent` set from `systemPreferences.getAccentColor()` (hex) forwarded to each
  window (query string on `loadFile`, e.g. `?accent=RRGGBB`); default `#7C8CF8`. Used for
  focus rings, active segmented segment, toggles-on, countdown ring, hovers.

### Native controls (Tailwind component classes in `@layer components`)
- **Toggle switch** (`.nyx-switch`): pill track + sliding knob, accent when on, spring-ish
  transition. Replaces the launch-at-login / logDetection / night-hours checkboxes.
- **Segmented control** (`.nyx-segmented`): rounded track, active segment gets a raised
  translucent pill. Used for **Monitoring** (Auto · Off · Snooze) and **Final action**
  (Sleep · Display · Pause).
- **Stepper** (`.nyx-stepper`): number field with − / + buttons for the delay/wait seconds.
- **Buttons**: translucent, accent hover; icon buttons for panel actions.

## 8. Redesigned Surfaces

All four keep their existing IPC/behavior (element IDs preserved where JS reads them).

- **Panel (popover):** frosted `popover` window. Header (moon mark + "Nyx" + state dot/label),
  large calm status line + subline, an inset translucent "Last night" card, a segmented
  Monitoring control, and an icon-button row (Settings · Calibrate · Quit) with accent hover.
- **Settings:** grouped cards (Detection / Escalation / Night hours / General) with hairline
  rows; toggles, steppers, and a segmented Final-action; "Recalibrate" and "Reveal log"
  buttons. Native hidden-inset title bar.
- **Nudge:** full-screen frosted overlay (`backdrop-blur`), breathing crescent (Lucide moon),
  soft copy, accent countdown ring.
- **Calibration:** framed live preview, accent progress dots, blink-score readout, primary
  Capture button.

## 9. Logo → App Icon

- User generates a 1024² PNG from the provided prompt (crescent-moon, midnight-navy squircle).
- A `scripts/make-icon.js` update: if `src/resources/logo.png` exists, build `icon.icns` from
  it (via `sips` to the iconset sizes + `iconutil`); else fall back to the current generated
  crescent. Also derive a monochrome menu-bar `trayTemplate.png` (+@2x) from the mark, or keep
  the existing template if no logo supplied.

## 10. Error Handling & Build Hygiene

- Missing compiled `app.css` at launch → `prestart` guarantees it; if run raw via `electron .`
  without build, the app still loads (unstyled but functional) — document `npm start` as the
  entry.
- Vibrancy unsupported / opaque → CSS `backdrop-blur` fallback (see §6).
- Accent color read fails → default `#7C8CF8`.
- `app.css` and `src/renderer/icons/` are generated; commit them OR git-ignore and regenerate
  in `prestart`/`predist`. Decision: **git-ignore generated `app.css`; commit the copied
  Lucide SVGs** (small, stable, avoids a build dep at runtime). (Locked to remove ambiguity.)

## 11. Testing

- No new logic → existing 68 Vitest tests must stay green (regression guard).
- One tiny pure helper worth a test: accent hex normalization
  (`normalizeAccent(raw)` → `#RRGGBB`, strips alpha, defaults on bad input) in
  `src/core/accent.js`.
- Everything else is visual → manual RUNBOOK pass (launch, see vibrancy, controls work,
  icons render, panel/settings/nudge/calibration look native) and the **frontend-design skill**
  applied during implementation for quality.

## 12. Open Items for Implementation Plan

- Exact Tailwind theme values + the three component-class implementations.
- `windows.js` vibrancy option set per window + the accent query-string plumbing.
- `make-icon.js` logo-PNG path + `sips` size derivation; tray template from the mark.
- Which Lucide glyphs to copy and how they're recolored (CSS mask vs filter).
