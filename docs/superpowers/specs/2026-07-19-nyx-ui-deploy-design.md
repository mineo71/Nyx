# Nyx — UI & Deploy Design Spec

**Date:** 2026-07-19
**Status:** Approved (design), pending implementation plan
**Depends on:** the shipped Nyx v1 (menu-bar app, core logic, services, detector).
**Platform:** macOS 26.5.1, single-user personal app.

## 1. Purpose

Turn the functional-but-bare Nyx v1 into a polished, minimalistic, deploy-ready macOS
menu-bar app: a click-to-open popover panel, a proper Settings window, restyled
nudge/calibration surfaces, a dark "night" visual system, and a double-clickable
`.app`/`.dmg` produced by electron-builder (unsigned — no Apple Developer account).

This unblocks everything else: the app must be pleasant and installable before we can
judge whether the detection heuristic needs a trained model.

## 2. Goals

- Replace the tray context-menu with a native-feeling popover panel.
- Add a Settings window bound to the existing `electron-store` settings.
- Restyle the nudge overlay and calibration wizard; calibration shows a live preview.
- A cohesive dark "night" design system (shared CSS tokens).
- Launch-at-login option.
- Package as an unsigned `.app` + `.dmg` via electron-builder; menu-bar-only (no dock).
- Fix resource paths so bundled assets (media-key binary, MediaPipe, icons) resolve when
  packaged.

## 3. Non-Goals

- No code-signing / notarization (unsigned; first launch is right-click → Open).
- No detection changes (data-logging, closure-strength, owner-ID are a separate later spec).
- No UI framework / bundler — vanilla HTML/CSS/JS, no build step for renderer.
- No cross-platform packaging (macOS only).

## 4. Key Decisions

| Decision | Choice |
|---|---|
| UI surface | Menu-bar popover panel + separate Settings window. |
| Popover mechanics | Hand-rolled tray-anchored frameless window, hide-on-blur. No `menubar` dep. |
| UI tech | Vanilla HTML/CSS/JS; shared `tokens.css`. |
| Aesthetic | Dark "night" theme, moonlit-indigo accent, crescent motif. |
| Packaging | electron-builder → unsigned `dmg` + `zip`; `LSUIElement: true`; `identity: null`. |
| Launch at login | `app.setLoginItemSettings`, toggled in Settings. |

## 5. Architecture

Builds on v1. Changes are additive; core/services untouched except resource-path fixes.

### Changed
- **`src/main/tray.js`** — no longer builds a context menu. It shows the tray icon and, on
  click, calls a callback to toggle the popover. Still exposes `refresh()` (updates tooltip
  + notifies the panel of new state/recap).
- **`src/main/main.js`** — wires the popover toggle, the Settings window, the login-item
  setting, and pushes state/recap updates to the panel over IPC.
- **`src/main/windows.js`** — add `createPanelWindow()`, `createSettingsWindow()`; restyle
  detector/nudge/calibration remain here.
- **Resource paths** — a small `src/main/resources-path.js` returns the correct base dir
  (`__dirname`-relative in dev, `process.resourcesPath` when packaged) for the media-key
  binary and any bundled assets. `os-actions.js` and the detector asset loading use it.

### New
- **`src/main/popover.js`** — pure `computePanelPosition(trayBounds, panelSize, workArea)`
  returning `{x, y}` (clamped on-screen), plus a `Popover` controller that owns the panel
  window's show/hide/toggle and blur handling.
- **`src/renderer/panel.html` / `panel.js`** — the popover UI.
- **`src/renderer/settings.html` / `settings.js`** — the Settings UI.
- **`src/renderer/styles/tokens.css`** — design tokens + shared base styles, imported by
  all renderer HTML.
- **`src/core/settings-schema.js`** — pure clamp/validate for settings values (delay ≥ 5s,
  waits ≥ 1s, hours 0–23, threshold 0–1, finalAction enum). Used by the Settings IPC handler.
- **electron-builder config** in `package.json` + generated `src/resources/icon.icns`.

## 6. Popover Panel

Click the tray icon → toggle a frameless, non-resizable, always-on-top window (~300×360)
positioned just under the tray icon; hides on blur or Escape.

```
┌─────────────────────────────┐
│  🌙 Nyx            ● Watching │  state dot: grey Idle / blue Watching / amber Escalating
│                              │
│   Watching over you          │  large calm status line (state-dependent copy)
│   Camera ok · armed by video │  subline; shows "Camera unavailable" warning if detector errored
│                              │
│  ┌────────────────────────┐ │
│  │ Last night              │ │  recap card; empty state "No sleep events yet"
│  │ Paused "The Bear S2E4"  │ │
│  │ at 2:14 AM              │ │
│  └────────────────────────┘ │
│                              │
│  Monitoring   [ Auto ▾ ]     │  Auto / Off tonight / Snooze 1h
│                              │
│  Calibrate    Settings    ⏻  │  quit
└─────────────────────────────┘
```

- **State** is pushed from main via IPC (`nyx:panel-state` with `{state, recap, cameraOk,
  monitoringMode}`); the panel re-renders on receipt and on open.
- **Monitoring mode** (`Auto` / `Off tonight` / `Snooze 1h`) is a manual override on top of
  auto-arm: `Off tonight` disables arming until local morning; `Snooze 1h` disables for 60
  min. Stored in memory (resets on quit) and consulted by the arm path in `main.js`.
- Buttons: Calibrate (opens calibration), Settings (opens Settings window), Quit.

## 7. Settings Window

Normal window (~460×520), dark, sectioned. All fields load from and save to the existing
`electron-store` `settings`, passed through `settings-schema` clamp on save.

```
Detection
  Fall-asleep delay        [ 90 ] s          (min 5)
  Eye-closed threshold     0.53   [Recalibrate]   (read-only; button opens calibration)
Escalation ladder
  Nudge wait     [ 30 ] s
  Pause wait     [ 45 ] s
  Final action   [ Sleep Mac ▾ ]             (Sleep Mac / Display off / Pause only)
Night hours
  [x] Only monitor at night    from [ 21 ] to [ 07 ]
General
  [x] Launch at login
```

- Save is **immediate on change** per field: each control persists its clamped value to
  `electron-store` right away (no Save button). Main reads values live — it already calls
  `settings.get(...)` at each use for ladder/timings; the machine's `tAsleepMs`/`nightHours`
  config is refreshed for each new arming session.
- "Recalibrate" triggers the calibration flow.
- "Launch at login" calls `app.setLoginItemSettings({ openAtLogin })`.

## 8. Nudge & Calibration Restyle

- **Nudge overlay:** fullscreen dim with a blurred backdrop, a centered slowly-breathing
  crescent, soft "Still watching?" copy, and a thin countdown ring indicating time until the
  next ladder step. Low-glare for a dark bedroom. Same `nyx:nudge` `{level}` contract; loud
  level brightens and plays the chime.
- **Calibration wizard:** dark two-step flow with a small live camera preview, progress
  dots, and a live blink-score readout so the user sees detection working. Uses the existing
  calibration IPC (`nyx:calibrate-request` / `nyx:calibrate-capture` / `nyx:calibrate-result`).

## 9. Visual System (`tokens.css`)

CSS custom properties + shared base styles:

- Colors: `--bg #0B0E14`, `--surface #141824`, `--border #232838`, `--text #E6E8EC`,
  `--muted #868DA0`, `--accent #7C8CF8` (moonlit indigo), `--success #5FB98B`,
  `--warn #E0A45C`, state dots grey/blue/amber.
- Type: SF/system font stack; sizes via a small scale.
- Spacing: 8px scale (4/8/12/16/24/32). Radius: 12px cards, 8px controls.
- Soft shadows, subtle 1px borders, generous whitespace, crescent-motif accents.

All renderer pages import `tokens.css` first.

## 10. Packaging

- Add `electron-builder` (devDependency) and a `build` config in `package.json`:
  - `appId` `com.oleh.nyx`, `productName` `Nyx`.
  - `mac`: `category: public.app-category.utilities`, `target: [dmg, zip]`,
    `icon: src/resources/icon.icns`, `identity: null` (unsigned),
    `extendInfo: { LSUIElement: true }` (menu-bar only, no dock).
  - `extraResources`: bundle `src/resources/mediakey`, `trayTemplate*.png`, `chime.wav`,
    and the MediaPipe wasm + (optionally vendored) model, so they ship inside the `.app`.
  - `files`: include `src/**`, exclude tests/docs.
- `npm run dist` → `dist/Nyx-0.1.0.dmg` (+ zip). First launch: right-click → Open.
- `npm run build:mediakey` must run before packaging (documented; optionally a
  `beforePack`/`pack` hook).
- **Resource-path fix:** `resources-path.js` returns `process.resourcesPath` when
  `app.isPackaged`, else the dev path; media-key invocation and detector asset URLs use it.
  MediaPipe: vendor `face_landmarker.task` + wasm locally under resources for offline use, or
  keep the CDN URL (documented trade-off) — either way the wasm must resolve when packaged.

## 11. Error Handling

- Panel/settings windows fail to load → log; tray still works; app never crashes.
- Camera-unavailable state surfaces in the panel subline (warning) and disables the
  auto-sleep expectation, as in v1.
- Invalid settings input → clamped by `settings-schema`; never persisted out of range.
- Packaged resource missing (e.g., media-key binary) → the existing fire-and-forget error
  handling logs and skips, no crash.

## 12. Testing

- **Pure/unit (Vitest):**
  - `computePanelPosition(trayBounds, panelSize, workArea)` → correct clamped `{x,y}` for
    left/right/notch/multi-monitor edge cases.
  - `settings-schema` clamp/validate → out-of-range inputs corrected; enums enforced.
- **Manual (RUNBOOK additions):** popover open/close/blur, Settings persistence + live
  effect, restyled nudge/calibration, launch-at-login, `npm run dist` produces a `.dmg`, the
  packaged `.app` launches, shows the tray, opens the popover, and the media-key + camera
  still work from inside the bundle.

## 13. Open Items for Implementation Plan

- Exact panel copy per state (Idle/Watching/Drowsy/Escalating).
- Monitoring-mode override wiring in the arm path (Auto/Off-tonight/Snooze).
- `.icns` generation from the crescent artwork.
- Decision executed: vendor MediaPipe model locally vs CDN (default: vendor for offline).
- electron-builder `extraResources` exact globs and the packaged resource-path mapping.
