# Nyx P2 — Full-Size Dashboard Window

**Date:** 2026-07-20
**Status:** Approved (proceed without gates, per user)
**Depends on:** Nyx on `main` (menu-bar app + detection-v2 + native UI).

## 1. Purpose

Add a real, full-size app: a main **dashboard window** with a dock icon, alongside the
existing menu-bar popover. Same dark/vibrancy design language. Purely additive — no detection
or behavior change.

## 2. Goals

- A resizable main window (dock icon, standard traffic-light chrome, vibrancy).
- Dashboard content: big live status, quick controls (Monitoring, Calibrate, Settings), and a
  **Recent nights** list (past sleep events from the recap store).
- Keep the menu-bar popover working; app stays alive when the window is closed.
- Open on launch; reopen via dock click / app activate.

## 3. Non-Goals

- No i18n (P3), landing/README (P4), ML (P5).
- No new detection features; no charts/graphs (a simple recents list only).
- No settings duplication — the window links to the existing Settings window.

## 4. Design

### 4a. Window (`src/main/windows.js`)
- `createMainWindow()`: `BrowserWindow` ~760×560, resizable, `transparent: true`,
  `vibrancy: 'under-window'`, `visualEffectState: 'active'`, `titleBarStyle: 'hiddenInset'`,
  `backgroundColor: '#00000000'`, accent query. Loads `main-window.html`.
- Close hides instead of destroying (prevent-default → hide) so it reopens instantly and the
  app keeps running in the menu bar. A module-level ref + `showMainWindow()` (create-or-show).

### 4b. Dock + lifecycle (`src/main/main.js`)
- Remove `app.dock.hide()` → dock icon visible (it's now a real app).
- On `whenReady`: create + show the main window.
- `app.on('activate')` and dock click → `showMainWindow()`.
- `pushPanelState()` also sends `nyx:panel-state` to the main window (shared state contract).
- `ipcMain.handle('nyx:get-recaps', () => recentRecaps(10))`.
- Packaging: remove `LSUIElement` from electron-builder `mac.extendInfo` so the packaged app
  shows a dock icon.

### 4c. Recents (`src/services/stores.js`)
- Add `recentRecaps(limit = 10)` → `recapStore.get('entries').slice(0, limit)`. Export it.

### 4d. Renderer (`src/renderer/main-window.html`, `main-window.js`)
- Reuse `app.css` + `accent-init.js` + component classes.
- Layout (single column, padded):
  - Header: moon + "Nyx" wordmark, state dot + label.
  - Hero card: large status line + subline (camera status), Monitoring segmented control.
  - Actions row: Calibrate, Settings buttons.
  - "Recent nights" card: list of recap entries `"<title>" · <date> <time>`, empty-state
    "No sleep events yet".
- Consumes `onPanelState` (state/camera/monitoring) and `getRecaps()` (list); re-renders on
  each state push; `panelReady()`-style `dashboardReady()` triggers initial push.

### 4e. Preload (`src/renderer/preload.js`)
- Add `getRecaps: () => ipcRenderer.invoke('nyx:get-recaps')` and
  `dashboardReady: () => ipcRenderer.send('nyx:dashboard-ready')`.
- Reuse existing `onPanelState`, `setMonitoringMode`, `openSettings`, `openCalibration`.

## 5. Error handling
- Main window load failure → logged; tray/popover still work.
- `getRecaps` empty → empty-state text.

## 6. Testing
- Pure: `recentRecaps` (limit/slice) — unit test.
- Manual (RUNBOOK): window opens on launch, dock icon present, close→reopens via dock, state
  + recents render, controls work, popover still works.

## 7. Open items for plan
- Exact `main-window.html` markup + `main-window.js` render logic.
- `showMainWindow` create-or-show + close-hides wiring.
