# Nyx UI & Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For the renderer/UI tasks, apply the superpowers:frontend-design skill's principles for visual polish.

**Goal:** Turn Nyx v1 into a polished, minimalistic, deploy-ready macOS menu-bar app: a click-to-open popover panel, a Settings window, restyled nudge/calibration surfaces, a dark "night" design system, and an unsigned `.app`/`.dmg` built by electron-builder.

**Architecture:** Additive on v1. Two new pure modules (`settings-schema`, popover position math) are TDD-tested. Renderer gets a shared `tokens.css` and new `panel`/`settings` pages plus restyles. `main.js` is rewritten to drive a popover instead of a context menu, push state to the panel over IPC, serve/persist settings, and honor a manual monitoring override. Packaging uses electron-builder with `asar: false` so `__dirname`-relative resource paths (media-key binary, MediaPipe wasm) resolve identically in dev and in the bundle.

**Tech Stack:** Electron, vanilla HTML/CSS/JS (no framework/bundler), Vitest, electron-builder, `iconutil`/`sips` for the `.icns`.

---

## Design Decisions Locked In

- **`asar: false`** in electron-builder → packaged paths == dev paths. No `resources-path.js` needed (supersedes that spec open-item).
- **Settings view is flat.** The Settings UI works with a flat view object; `main.js` translates it to/from the nested `electron-store` shape. `settings-schema.clampSettingsView` is the pure, tested validator.
- **Monitoring override** (`auto`/`off`/`snooze`) lives in `main.js` memory and gates the arm path; it lazily reverts to `auto` when its window passes.
- **Engine rebuild on settings change:** `engine` is a module-scope `let`; reassigning it is picked up by the machine's callbacks (which close over the variable), so ladder/finalAction edits take effect without restart.

## File Structure

```
src/core/settings-schema.js        NEW  pure clamp/validate for the flat settings view
src/main/popover.js                NEW  computePanelPosition (pure) + Popover controller
src/main/windows.js                MOD  add createPanelWindow, createSettingsWindow
src/main/tray.js                   MOD  click toggles popover; no context menu
src/main/main.js                   MOD  full rewrite: popover, panel IPC, settings IPC, monitoring gate, login item
src/renderer/preload.js            MOD  extend `nyx` API (panel + settings channels)
src/renderer/styles/tokens.css     NEW  design tokens + base styles
src/renderer/panel.html/.js        NEW  popover UI
src/renderer/settings.html/.js     NEW  settings UI
src/renderer/nudge.html/.js        MOD  restyle + countdown ring
src/renderer/calibration.html/.js  MOD  restyle + live preview + blink readout
src/renderer/detector.js           MOD  point modelAssetPath at vendored local model
scripts/fetch-model.js             NEW  download MediaPipe model into src/resources/mediapipe/
src/resources/icon.icns            NEW  app icon (generated)
package.json                       MOD  electron-builder config + scripts + devDep
tests/core/settings-schema.test.js NEW
tests/main/popover.test.js         NEW
docs/RUNBOOK.md                    MOD  UI + packaging steps
```

---

## Phase A — Pure foundations (TDD)

### Task 1: Settings schema (clamp/validate)

**Files:** Create `src/core/settings-schema.js`, Test `tests/core/settings-schema.test.js`.

The Settings UI edits a flat "view". This module clamps/validates it. Pure, no imports.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { clampSettingsView, FINAL_ACTIONS, DEFAULT_VIEW } from '../../src/core/settings-schema.js';

describe('clampSettingsView', () => {
  it('passes through valid values unchanged', () => {
    const v = { tAsleepSec: 90, nudgeWaitSec: 30, pauseWaitSec: 45, finalAction: 'sleep',
      nightHoursEnabled: true, nightHoursStart: 21, nightHoursEnd: 7, openAtLogin: false };
    expect(clampSettingsView(v)).toEqual(v);
  });

  it('clamps numbers into range and rounds', () => {
    const v = clampSettingsView({ tAsleepSec: 2, nudgeWaitSec: 9999, pauseWaitSec: 3.7 });
    expect(v.tAsleepSec).toBe(5);      // min 5
    expect(v.nudgeWaitSec).toBe(600);  // max 600
    expect(v.pauseWaitSec).toBe(5);    // rounded 3.7 -> 4 -> clamped to min 5
  });

  it('falls back to sleep for an unknown finalAction', () => {
    expect(clampSettingsView({ finalAction: 'explode' }).finalAction).toBe('sleep');
    expect(FINAL_ACTIONS).toContain('displayOff');
  });

  it('clamps night hours to 0..23 and coerces booleans', () => {
    const v = clampSettingsView({ nightHoursStart: 30, nightHoursEnd: -3, nightHoursEnabled: 1, openAtLogin: 0 });
    expect(v.nightHoursStart).toBe(23);
    expect(v.nightHoursEnd).toBe(0);
    expect(v.nightHoursEnabled).toBe(true);
    expect(v.openAtLogin).toBe(false);
  });

  it('fills missing keys from DEFAULT_VIEW', () => {
    const v = clampSettingsView({});
    expect(v).toEqual(DEFAULT_VIEW);
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/core/settings-schema.test.js`

- [ ] **Step 3: Implement `src/core/settings-schema.js`**

```js
const FINAL_ACTIONS = ['sleep', 'displayOff', 'pauseOnly'];

const DEFAULT_VIEW = {
  tAsleepSec: 90,
  nudgeWaitSec: 30,
  pauseWaitSec: 45,
  finalAction: 'sleep',
  nightHoursEnabled: false,
  nightHoursStart: 21,
  nightHoursEnd: 7,
  openAtLogin: false,
};

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clampSettingsView(view = {}) {
  const v = { ...DEFAULT_VIEW, ...view };
  return {
    tAsleepSec: clampInt(v.tAsleepSec, 5, 3600, DEFAULT_VIEW.tAsleepSec),
    nudgeWaitSec: clampInt(v.nudgeWaitSec, 5, 600, DEFAULT_VIEW.nudgeWaitSec),
    pauseWaitSec: clampInt(v.pauseWaitSec, 5, 600, DEFAULT_VIEW.pauseWaitSec),
    finalAction: FINAL_ACTIONS.includes(v.finalAction) ? v.finalAction : 'sleep',
    nightHoursEnabled: Boolean(v.nightHoursEnabled),
    nightHoursStart: clampInt(v.nightHoursStart, 0, 23, DEFAULT_VIEW.nightHoursStart),
    nightHoursEnd: clampInt(v.nightHoursEnd, 0, 23, DEFAULT_VIEW.nightHoursEnd),
    openAtLogin: Boolean(v.openAtLogin),
  };
}

module.exports = { clampSettingsView, FINAL_ACTIONS, DEFAULT_VIEW };
```

- [ ] **Step 4: Run, verify PASS (5 tests)** then full suite `npx vitest run`.

- [ ] **Step 5: Commit**

```bash
git add src/core/settings-schema.js tests/core/settings-schema.test.js
git commit -m "feat(core): settings view clamp/validate schema"
```

---

### Task 2: Popover position math

**Files:** Create `src/main/popover.js` (position fn now; controller added in Task 10), Test `tests/main/popover.test.js`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { computePanelPosition } from '../../src/main/popover.js';

const WORK = { x: 0, y: 0, width: 1440, height: 900 };
const PANEL = { width: 300, height: 360 };

describe('computePanelPosition', () => {
  it('centers the panel under a mid-screen tray icon, below the menu bar', () => {
    const tray = { x: 700, y: 0, width: 24, height: 24 };
    const { x, y } = computePanelPosition(tray, PANEL, WORK);
    expect(x).toBe(Math.round(700 + 12 - 150)); // 562
    expect(y).toBe(24 + 6);                      // below icon + gap
  });

  it('clamps a right-edge tray icon so the panel stays on screen', () => {
    const tray = { x: 1420, y: 0, width: 24, height: 24 };
    const { x } = computePanelPosition(tray, PANEL, WORK);
    expect(x).toBe(WORK.width - PANEL.width - 8); // 1132, right margin 8
  });

  it('never positions left of the work-area margin', () => {
    const tray = { x: 0, y: 0, width: 24, height: 24 };
    const { x } = computePanelPosition(tray, PANEL, WORK);
    expect(x).toBe(8);
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/main/popover.test.js`

- [ ] **Step 3: Implement `src/main/popover.js`** (position fn only for now)

```js
const MARGIN = 8;
const GAP = 6;

// Pure: where to place the popover so it sits under the tray icon and stays on screen.
function computePanelPosition(trayBounds, panelSize, workArea) {
  const centered = Math.round(trayBounds.x + trayBounds.width / 2 - panelSize.width / 2);
  const minX = workArea.x + MARGIN;
  const maxX = workArea.x + workArea.width - panelSize.width - MARGIN;
  const x = Math.max(minX, Math.min(centered, maxX));
  const y = trayBounds.y + trayBounds.height + GAP;
  return { x, y };
}

module.exports = { computePanelPosition, MARGIN, GAP };
```

- [ ] **Step 4: Run, verify PASS (3 tests)** then full suite.

- [ ] **Step 5: Commit**

```bash
git add src/main/popover.js tests/main/popover.test.js
git commit -m "feat(main): popover position math"
```

---

## Phase B — Design system + renderer surfaces

### Task 3: Design tokens

**Files:** Create `src/renderer/styles/tokens.css`.

- [ ] **Step 1: Create `src/renderer/styles/tokens.css`**

```css
:root {
  --bg: #0B0E14;
  --surface: #141824;
  --surface-2: #1B2030;
  --border: #232838;
  --text: #E6E8EC;
  --muted: #868DA0;
  --accent: #7C8CF8;
  --accent-dim: #4A5490;
  --success: #5FB98B;
  --warn: #E0A45C;
  --dot-idle: #4A5060;
  --dot-watch: #7C8CF8;
  --dot-escalate: #E0A45C;

  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 24px; --sp-6: 32px;
  --radius: 12px; --radius-sm: 8px;
  --font: -apple-system, "SF Pro Text", system-ui, sans-serif;
  --shadow: 0 8px 30px rgba(0,0,0,0.45);
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  font-family: var(--font);
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  user-select: none;
  cursor: default;
}

h1, h2, h3, p { margin: 0; }

.muted { color: var(--muted); }

button {
  font-family: var(--font);
  color: var(--text);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--sp-2) var(--sp-3);
  font-size: 13px;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}
button:hover { background: #232A3D; }
button.primary { background: var(--accent-dim); border-color: var(--accent); }
button.primary:hover { background: var(--accent); color: #0B0E14; }

input[type="number"], select {
  font-family: var(--font);
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--sp-1) var(--sp-2);
  font-size: 13px;
  width: 64px;
}
select { width: auto; }

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp-3);
}

.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/styles/tokens.css
git commit -m "feat(renderer): dark night design tokens"
```

---

### Task 4: Popover panel UI

**Files:** Create `src/renderer/panel.html`, `src/renderer/panel.js`.

Uses `window.nyx` panel API (added in Task 8): `onPanelState(cb)`, `panelReady()`,
`setMonitoringMode(mode)`, `openSettings()`, `openCalibration()`, `quit()`.

- [ ] **Step 1: Create `src/renderer/panel.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="./styles/tokens.css" />
    <style>
      body { width: 300px; height: 360px; padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-4); }
      .top { display: flex; align-items: center; justify-content: space-between; }
      .brand { display: flex; align-items: center; gap: var(--sp-2); font-weight: 600; }
      .state { display: flex; align-items: center; gap: var(--sp-2); font-size: 12px; color: var(--muted); }
      .status h2 { font-size: 20px; font-weight: 500; }
      .status p { font-size: 12px; margin-top: var(--sp-1); }
      .recap .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
      .recap .title { font-size: 14px; margin-top: var(--sp-1); }
      .recap .time { font-size: 12px; color: var(--muted); }
      .row { display: flex; align-items: center; justify-content: space-between; }
      .actions { margin-top: auto; display: flex; gap: var(--sp-2); }
      .actions button { flex: 1; }
      .icon-btn { flex: 0 0 auto; width: 40px; }
    </style>
  </head>
  <body>
    <div class="top">
      <div class="brand">🌙 Nyx</div>
      <div class="state"><span id="dot" class="dot"></span><span id="stateLabel">Idle</span></div>
    </div>

    <div class="status">
      <h2 id="statusLine">Idle</h2>
      <p id="statusSub" class="muted">Waiting for something to play</p>
    </div>

    <div class="recap card">
      <div class="label">Last night</div>
      <div id="recapTitle" class="title">No sleep events yet</div>
      <div id="recapTime" class="time"></div>
    </div>

    <div class="row">
      <span class="muted" style="font-size:13px">Monitoring</span>
      <select id="mode">
        <option value="auto">Auto</option>
        <option value="off">Off tonight</option>
        <option value="snooze">Snooze 1h</option>
      </select>
    </div>

    <div class="actions">
      <button id="calibrate">Calibrate</button>
      <button id="settings">Settings</button>
      <button id="quit" class="icon-btn" title="Quit Nyx">⏻</button>
    </div>

    <script src="./panel.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/renderer/panel.js`**

```js
const dot = document.getElementById('dot');
const stateLabel = document.getElementById('stateLabel');
const statusLine = document.getElementById('statusLine');
const statusSub = document.getElementById('statusSub');
const recapTitle = document.getElementById('recapTitle');
const recapTime = document.getElementById('recapTime');
const modeSelect = document.getElementById('mode');

const STATE_COPY = {
  IDLE:       { label: 'Idle',      line: 'Idle',                sub: 'Waiting for something to play', dot: 'var(--dot-idle)' },
  WATCHING:   { label: 'Watching',  line: 'Watching over you',   sub: 'Armed by playback',             dot: 'var(--dot-watch)' },
  DROWSY:     { label: 'Watching',  line: 'Checking on you…',    sub: 'Your eyes look closed',         dot: 'var(--dot-watch)' },
  ESCALATING: { label: 'Nudging',   line: 'Still watching?',     sub: 'Nudging you awake',             dot: 'var(--dot-escalate)' },
};

function render(s) {
  const c = STATE_COPY[s.state] || STATE_COPY.IDLE;
  dot.style.background = c.dot;
  stateLabel.textContent = c.label;
  statusLine.textContent = c.line;
  statusSub.textContent = s.cameraOk === false ? 'Camera unavailable — auto-sleep off' : c.sub;
  statusSub.style.color = s.cameraOk === false ? 'var(--warn)' : 'var(--muted)';
  if (s.recap) {
    recapTitle.textContent = `Paused "${s.recap.title}"`;
    recapTime.textContent = `at ${new Date(s.recap.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  } else {
    recapTitle.textContent = 'No sleep events yet';
    recapTime.textContent = '';
  }
  if (s.monitoringMode) modeSelect.value = s.monitoringMode;
}

window.nyx.onPanelState((_e, s) => render(s));
modeSelect.addEventListener('change', () => window.nyx.setMonitoringMode(modeSelect.value));
document.getElementById('calibrate').addEventListener('click', () => window.nyx.openCalibration());
document.getElementById('settings').addEventListener('click', () => window.nyx.openSettings());
document.getElementById('quit').addEventListener('click', () => window.nyx.quit());

window.nyx.panelReady();
```

- [ ] **Step 3: `node --check src/renderer/panel.js`** — must pass.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/panel.html src/renderer/panel.js
git commit -m "feat(renderer): popover panel UI"
```

---

### Task 5: Settings window UI

**Files:** Create `src/renderer/settings.html`, `src/renderer/settings.js`.

Uses `window.nyx` settings API (Task 8): `getSettings()` → flat view (Promise),
`setSetting(key, value)` → clamped stored view (Promise), `openCalibration()`.

- [ ] **Step 1: Create `src/renderer/settings.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="./styles/tokens.css" />
    <style>
      body { width: 460px; padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-5); }
      section { display: flex; flex-direction: column; gap: var(--sp-3); }
      h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
      .field { display: flex; align-items: center; justify-content: space-between; }
      .field label { font-size: 13px; }
      .inline { display: flex; align-items: center; gap: var(--sp-2); }
    </style>
  </head>
  <body>
    <section>
      <h3>Detection</h3>
      <div class="field"><label>Fall-asleep delay</label><div class="inline"><input id="tAsleepSec" type="number" min="5" max="3600" /><span class="muted">s</span></div></div>
      <div class="field"><label>Eye-closed threshold</label><div class="inline"><span id="threshold" class="muted">—</span><button id="recalibrate">Recalibrate</button></div></div>
    </section>
    <section>
      <h3>Escalation ladder</h3>
      <div class="field"><label>Nudge wait</label><div class="inline"><input id="nudgeWaitSec" type="number" min="5" max="600" /><span class="muted">s</span></div></div>
      <div class="field"><label>Pause wait</label><div class="inline"><input id="pauseWaitSec" type="number" min="5" max="600" /><span class="muted">s</span></div></div>
      <div class="field"><label>Final action</label>
        <select id="finalAction">
          <option value="sleep">Sleep Mac</option>
          <option value="displayOff">Display off</option>
          <option value="pauseOnly">Pause only</option>
        </select>
      </div>
    </section>
    <section>
      <h3>Night hours</h3>
      <div class="field"><label><input id="nightHoursEnabled" type="checkbox" /> Only monitor at night</label>
        <div class="inline"><span class="muted">from</span><input id="nightHoursStart" type="number" min="0" max="23" /><span class="muted">to</span><input id="nightHoursEnd" type="number" min="0" max="23" /></div>
      </div>
    </section>
    <section>
      <h3>General</h3>
      <div class="field"><label><input id="openAtLogin" type="checkbox" /> Launch at login</label><span></span></div>
    </section>
    <script src="./settings.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/renderer/settings.js`**

```js
const NUM_KEYS = ['tAsleepSec', 'nudgeWaitSec', 'pauseWaitSec', 'nightHoursStart', 'nightHoursEnd'];
const BOOL_KEYS = ['nightHoursEnabled', 'openAtLogin'];
const SELECT_KEYS = ['finalAction'];

function fill(view) {
  NUM_KEYS.forEach((k) => { document.getElementById(k).value = view[k]; });
  BOOL_KEYS.forEach((k) => { document.getElementById(k).checked = view[k]; });
  SELECT_KEYS.forEach((k) => { document.getElementById(k).value = view[k]; });
  document.getElementById('threshold').textContent = (view.eyeCloseThreshold ?? 0).toFixed(2);
}

async function save(key, value) {
  const stored = await window.nyx.setSetting(key, value);
  fill(stored); // reflect the clamped value the store accepted
}

async function init() {
  fill(await window.nyx.getSettings());
  NUM_KEYS.forEach((k) => document.getElementById(k).addEventListener('change', (e) => save(k, Number(e.target.value))));
  BOOL_KEYS.forEach((k) => document.getElementById(k).addEventListener('change', (e) => save(k, e.target.checked)));
  SELECT_KEYS.forEach((k) => document.getElementById(k).addEventListener('change', (e) => save(k, e.target.value)));
  document.getElementById('recalibrate').addEventListener('click', () => window.nyx.openCalibration());
}

init();
```

> Note: the view returned by `getSettings`/`setSetting` includes a read-only
> `eyeCloseThreshold` (main adds it to the view; it is not editable, only displayed).

- [ ] **Step 3: `node --check src/renderer/settings.js`** — must pass.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/settings.html src/renderer/settings.js
git commit -m "feat(renderer): settings window UI"
```

---

### Task 6: Restyle the nudge overlay

**Files:** Modify `src/renderer/nudge.html`, `src/renderer/nudge.js`.

Add a blurred dim backdrop, a breathing crescent, and a countdown ring. Main sends
`nyx:nudge` `{ level, waitMs }` (Task 12 adds `waitMs` = time until the next ladder step;
`0`/absent means no ring).

- [ ] **Step 1: Replace `src/renderer/nudge.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="./styles/tokens.css" />
    <style>
      html, body { height: 100%; background: transparent; overflow: hidden; }
      .backdrop {
        position: fixed; inset: 0;
        background: rgba(7, 9, 14, 0.55);
        backdrop-filter: blur(18px);
        display: flex; align-items: center; justify-content: center;
      }
      .wrap { text-align: center; display: flex; flex-direction: column; align-items: center; gap: var(--sp-5); }
      .moon { font-size: 64px; animation: breathe 4s ease-in-out infinite; }
      @keyframes breathe { 0%,100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
      h1 { font-size: 44px; font-weight: 300; }
      p { font-size: 18px; color: var(--muted); }
      .ring { transform: rotate(-90deg); }
      .ring circle { fill: none; stroke-width: 4; }
      .ring .track { stroke: var(--border); }
      .ring .prog { stroke: var(--accent); stroke-linecap: round; transition: stroke-dashoffset 1s linear; }
    </style>
  </head>
  <body>
    <div class="backdrop">
      <div class="wrap">
        <div class="moon">🌙</div>
        <h1>Still watching?</h1>
        <p>Move, or open your eyes — Nyx thinks you dozed off.</p>
        <svg class="ring" width="72" height="72" viewBox="0 0 72 72" style="display:none">
          <circle class="track" cx="36" cy="36" r="32"></circle>
          <circle class="prog" cx="36" cy="36" r="32"></circle>
        </svg>
      </div>
    </div>
    <audio id="chime" src="../resources/chime.wav"></audio>
    <script src="./nudge.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Replace `src/renderer/nudge.js`**

```js
const CIRC = 2 * Math.PI * 32; // circumference for r=32
const ring = document.querySelector('.ring');
const prog = document.querySelector('.ring .prog');
prog.style.strokeDasharray = String(CIRC);

function startRing(waitMs) {
  if (!waitMs) { ring.style.display = 'none'; return; }
  ring.style.display = 'block';
  prog.style.transition = 'none';
  prog.style.strokeDashoffset = '0';
  // force reflow so the reset takes effect before animating
  void prog.getBoundingClientRect();
  prog.style.transition = `stroke-dashoffset ${waitMs}ms linear`;
  prog.style.strokeDashoffset = String(CIRC);
}

window.nyx.onNudge((_e, { level, waitMs }) => {
  const chime = document.getElementById('chime');
  if (chime) { chime.volume = level === 'loud' ? 1.0 : 0.3; chime.currentTime = 0; chime.play().catch(() => {}); }
  startRing(waitMs);
});
```

- [ ] **Step 3: `node --check src/renderer/nudge.js`** — must pass.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/nudge.html src/renderer/nudge.js
git commit -m "feat(renderer): restyle nudge overlay with countdown ring"
```

---

### Task 7: Restyle calibration + live preview

**Files:** Modify `src/renderer/calibration.html`, `src/renderer/calibration.js`.

Adds a small live camera preview and a live blink-score readout. The preview uses a
SEPARATE `getUserMedia` in the calibration window (independent of the hidden detector) so
the user sees themselves; captured calibration SAMPLES still come from the detector via the
existing IPC. Main also forwards live blink scores to the calibration window as
`nyx:calibrate-score` (Task 12 sends it on each detector frame while calibration is open).

- [ ] **Step 1: Replace `src/renderer/calibration.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="./styles/tokens.css" />
    <style>
      body { width: 480px; padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-4); align-items: center; }
      h2 { font-size: 20px; font-weight: 500; align-self: flex-start; }
      video { width: 240px; height: 180px; border-radius: var(--radius); background: #000; border: 1px solid var(--border); transform: scaleX(-1); object-fit: cover; }
      #instruction { text-align: center; font-size: 15px; }
      .readout { font-size: 13px; color: var(--muted); }
      .dots { display: flex; gap: var(--sp-1); }
      .dots .d { width: 8px; height: 8px; border-radius: 50%; background: var(--border); }
      .dots .d.on { background: var(--accent); }
      #status { color: var(--muted); font-size: 13px; }
    </style>
  </head>
  <body>
    <h2>Calibrate Nyx</h2>
    <video id="preview" autoplay playsinline muted></video>
    <p id="instruction">Step 1 — look at the camera with your eyes <b>open</b>, then click Capture ~10 times.</p>
    <div class="readout">Blink score: <span id="score">—</span></div>
    <div class="dots" id="dots"></div>
    <button id="capture" class="primary">Capture</button>
    <div id="status"></div>
    <script src="./calibration.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Replace `src/renderer/calibration.js`**

```js
const instruction = document.getElementById('instruction');
const status = document.getElementById('status');
const scoreEl = document.getElementById('score');
const dotsEl = document.getElementById('dots');
const preview = document.getElementById('preview');
let phase = 'open';
let count = 0;
const NEEDED = 10;

function renderDots() {
  dotsEl.innerHTML = '';
  for (let i = 0; i < NEEDED; i++) {
    const d = document.createElement('div');
    d.className = 'd' + (i < count ? ' on' : '');
    dotsEl.appendChild(d);
  }
}
renderDots();

// Local preview only (calibration samples come from the detector via IPC).
navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  .then((stream) => { preview.srcObject = stream; })
  .catch(() => { status.textContent = 'Camera preview unavailable'; });

window.nyx.onCalibrateScore((_e, sample) => {
  scoreEl.textContent = sample ? ((sample.left + sample.right) / 2).toFixed(2) : 'no face';
});

document.getElementById('capture').addEventListener('click', () => {
  window.nyx.requestCalibrationSample(phase);
  count += 1;
  renderDots();
  status.textContent = `${phase}: ${count}/${NEEDED} captured`;
  if (count >= NEEDED) {
    if (phase === 'open') {
      phase = 'closed'; count = 0; renderDots();
      instruction.innerHTML = 'Step 2 — <b>close your eyes</b> and click Capture ~10 times.';
      status.textContent = '';
    } else {
      instruction.textContent = 'Calibration complete. You can close this window.';
    }
  }
});
```

- [ ] **Step 3: `node --check src/renderer/calibration.js`** — must pass.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/calibration.html src/renderer/calibration.js
git commit -m "feat(renderer): restyle calibration with live preview and blink readout"
```

---

## Phase C — Main-process wiring

### Task 8: Extend the preload API

**Files:** Modify `src/renderer/preload.js`.

- [ ] **Step 1: Replace `src/renderer/preload.js` with**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nyx', {
  // Detector window
  onCaptureRequest: (cb) => ipcRenderer.on('nyx:capture', cb),
  sendFrame: (sample) => ipcRenderer.send('nyx:frame', sample),
  sendDetectorReady: () => ipcRenderer.send('nyx:detector-ready'),
  sendDetectorError: (msg) => ipcRenderer.send('nyx:detector-error', msg),
  onCalibrateCapture: (cb) => ipcRenderer.on('nyx:calibrate-capture', cb),
  sendCalibrationResult: (phase, sample) => ipcRenderer.send('nyx:calibrate-result', { phase, sample }),
  // Calibration window
  requestCalibrationSample: (phase) => ipcRenderer.send('nyx:calibrate-request', { phase }),
  onCalibrateScore: (cb) => ipcRenderer.on('nyx:calibrate-score', cb),
  // Nudge window
  onNudge: (cb) => ipcRenderer.on('nyx:nudge', cb),
  // Panel (popover)
  onPanelState: (cb) => ipcRenderer.on('nyx:panel-state', cb),
  panelReady: () => ipcRenderer.send('nyx:panel-ready'),
  setMonitoringMode: (mode) => ipcRenderer.send('nyx:set-monitoring', mode),
  openSettings: () => ipcRenderer.send('nyx:open-settings'),
  openCalibration: () => ipcRenderer.send('nyx:open-calibration'),
  quit: () => ipcRenderer.send('nyx:quit'),
  // Settings window
  getSettings: () => ipcRenderer.invoke('nyx:get-settings'),
  setSetting: (key, value) => ipcRenderer.invoke('nyx:set-setting', { key, value }),
});
```

- [ ] **Step 2: `node --check src/renderer/preload.js`** — must pass.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/preload.js
git commit -m "feat(renderer): extend preload API for panel and settings"
```

---

### Task 9: Panel + Settings windows

**Files:** Modify `src/main/windows.js`.

Add `createPanelWindow()` (frameless popover, hidden until toggled) and
`createSettingsWindow()`. Keep existing exports.

- [ ] **Step 1: Add to `src/main/windows.js`** (insert before the final `module.exports`)

```js
function createPanelWindow() {
  const win = new BrowserWindow({
    width: 300, height: 360,
    show: false, frame: false, resizable: false, movable: false,
    transparent: false, alwaysOnTop: true, skipTaskbar: true, fullscreenable: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'panel.html'));
  return win;
}

let settingsWin = null;
function showSettings() {
  if (settingsWin) { settingsWin.focus(); return settingsWin; }
  settingsWin = new BrowserWindow({
    width: 460, height: 560, resizable: false, title: 'Nyx Settings',
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  settingsWin.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
  return settingsWin;
}
```

- [ ] **Step 2: Update the `module.exports` line in `src/main/windows.js` to**

```js
module.exports = { createDetectorWindow, showNudge, hideNudge, showCalibration, createPanelWindow, showSettings };
```

- [ ] **Step 3: `node --check src/main/windows.js`** — must pass.

- [ ] **Step 4: Commit**

```bash
git add src/main/windows.js
git commit -m "feat(main): panel and settings windows"
```

---

### Task 10: Popover controller

**Files:** Modify `src/main/popover.js` (append the controller; keep `computePanelPosition`).

- [ ] **Step 1: Append to `src/main/popover.js`** (before `module.exports`)

```js
const { screen } = require('electron');

// Owns the popover window's show/hide/toggle and hide-on-blur behavior.
class Popover {
  constructor({ window, tray }) {
    this.window = window;
    this.tray = tray;
    this.window.on('blur', () => this.hide());
  }

  toggle() {
    if (this.window.isVisible()) this.hide();
    else this.show();
  }

  show() {
    const trayBounds = this.tray.getBounds();
    const [w, h] = this.window.getSize();
    const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
    const { x, y } = computePanelPosition(trayBounds, { width: w, height: h }, display.workArea);
    this.window.setPosition(x, y, false);
    this.window.show();
    this.window.focus();
  }

  hide() {
    if (this.window.isVisible()) this.window.hide();
  }
}
```

- [ ] **Step 2: Update the `module.exports` in `src/main/popover.js` to**

```js
module.exports = { computePanelPosition, Popover, MARGIN, GAP };
```

- [ ] **Step 3: Run full suite** `npx vitest run` (Task 2's tests still pass; `require('electron')` is only reached at runtime, not during the pure position test which imports the same file — confirm the position tests still pass; if importing the file now fails under vitest because of the top-level `require('electron')`, move that `require` to the top of the file — Electron resolves as a stub in vitest's node env only if installed; if it throws, wrap: `let screen; try { ({ screen } = require('electron')); } catch {}`).

> If `npx vitest run tests/main/popover.test.js` fails to import due to `require('electron')`, apply the try/catch wrapper shown above and re-run. The pure function must remain testable.

- [ ] **Step 4: Commit**

```bash
git add src/main/popover.js
git commit -m "feat(main): popover controller"
```

---

### Task 11: Tray → popover toggle

**Files:** Modify `src/main/tray.js`.

Replace the context menu with a click handler that toggles the popover. `refresh()` now
only updates the tooltip (panel state is pushed separately from `main.js`).

- [ ] **Step 1: Replace `src/main/tray.js` with**

```js
const { Tray, nativeImage } = require('electron');
const path = require('node:path');

function iconFor() {
  const img = nativeImage.createFromPath(path.join(__dirname, '..', 'resources', 'trayTemplate.png'));
  img.setTemplateImage(true);
  return img;
}

class NyxTray {
  constructor({ onToggle, getState }) {
    this.tray = new Tray(iconFor());
    this.getState = getState;
    this.tray.on('click', () => onToggle());
    this.tray.on('right-click', () => onToggle());
    this.refresh();
  }

  refresh() {
    this.tray.setToolTip(`Nyx — ${this.getState()}`);
  }
}

module.exports = { NyxTray };
```

- [ ] **Step 2: `node --check src/main/tray.js`** — must pass.

- [ ] **Step 3: Commit**

```bash
git add src/main/tray.js
git commit -m "feat(main): tray click toggles popover"
```

---

### Task 12: Rewire `main.js`

**Files:** Replace `src/main/main.js`.

Wires the popover, panel state push, settings IPC (get/set through the schema + view
translation), monitoring override in the arm path, login item, live blink-score forwarding
to calibration, `waitMs` on nudges, and machine/engine config refresh on settings change.

- [ ] **Step 1: Replace `src/main/main.js` with**

```js
const { app, ipcMain, powerMonitor, session } = require('electron');

const { DEFAULTS } = require('../core/config.js');
const { SleepStateMachine } = require('../core/state-machine.js');
const { EscalationEngine } = require('../core/escalation-engine.js');
const { classifyEyes, computeThreshold } = require('../core/detector-logic.js');
const { clampSettingsView } = require('../core/settings-schema.js');

const osActions = require('../services/os-actions.js');
const { MediaWatcher } = require('../services/media-watcher.js');
const { IdleMonitor } = require('../services/idle-monitor.js');
const { settings, addRecap, lastRecap } = require('../services/stores.js');

const { createDetectorWindow, showNudge, hideNudge, showCalibration, createPanelWindow, showSettings } = require('./windows.js');
const { CaptureScheduler } = require('./capture-scheduler.js');
const { NyxTray } = require('./tray.js');
const { Popover } = require('./popover.js');

app.setName('Nyx');
if (app.dock) app.dock.hide();

let machine, engine, tray, popover, panelWin, detectorWin, scheduler, mediaWatcher, idleMonitor, tickTimer;
let cameraOk = true;
let calibrationOpen = false;
const calibrationSamples = { open: [], closed: [] };
const CALIBRATION_MIN = 10;

// Monitoring override (memory-only; lazily reverts to 'auto').
let monitoringMode = 'auto';
let monitoringUntil = 0;

function currentThreshold() {
  return settings.get('eyeCloseThreshold', DEFAULTS.eyeCloseThreshold);
}

function nextHour(hour) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function setMonitoringMode(mode) {
  monitoringMode = mode;
  if (mode === 'off') monitoringUntil = nextHour(5);      // until ~5am
  else if (mode === 'snooze') monitoringUntil = Date.now() + 60 * 60 * 1000;
  else monitoringUntil = 0;
  pushPanelState();
}

function monitoringAllowed() {
  if (monitoringMode !== 'auto' && Date.now() >= monitoringUntil) {
    monitoringMode = 'auto'; monitoringUntil = 0;
  }
  return monitoringMode === 'auto';
}

// ---- settings view <-> store translation ----
function readSettingsView() {
  const ladder = settings.get('ladder', DEFAULTS.ladder);
  const nh = settings.get('nightHours', DEFAULTS.nightHours);
  return clampAndDecorate({
    tAsleepSec: Math.round(settings.get('tAsleepMs', DEFAULTS.tAsleepMs) / 1000),
    nudgeWaitSec: Math.round((ladder[0]?.waitMs ?? 30000) / 1000),
    pauseWaitSec: Math.round((ladder[1]?.waitMs ?? 45000) / 1000),
    finalAction: settings.get('finalAction', DEFAULTS.finalAction),
    nightHoursEnabled: nh.enabled,
    nightHoursStart: nh.start,
    nightHoursEnd: nh.end,
    openAtLogin: app.getLoginItemSettings().openAtLogin,
  });
}

function clampAndDecorate(view) {
  const clamped = clampSettingsView(view);
  clamped.eyeCloseThreshold = currentThreshold(); // read-only display value
  return clamped;
}

function applySettingsView(view) {
  const v = clampSettingsView(view);
  settings.set('tAsleepMs', v.tAsleepSec * 1000);
  settings.set('finalAction', v.finalAction);
  settings.set('nightHours', { enabled: v.nightHoursEnabled, start: v.nightHoursStart, end: v.nightHoursEnd });
  const ladder = JSON.parse(JSON.stringify(DEFAULTS.ladder));
  ladder[0].waitMs = v.nudgeWaitSec * 1000; // nudge
  ladder[1].waitMs = v.pauseWaitSec * 1000; // pause + nudge
  ladder[2].waitMs = v.nudgeWaitSec * 1000; // second nudge
  settings.set('ladder', ladder);
  app.setLoginItemSettings({ openAtLogin: v.openAtLogin });
  refreshRuntimeConfig();
}

// Push new settings into the live machine + rebuild the engine.
function refreshRuntimeConfig() {
  if (machine) {
    machine.config.tAsleepMs = settings.get('tAsleepMs', DEFAULTS.tAsleepMs);
    machine.config.nightHours = settings.get('nightHours', DEFAULTS.nightHours);
  }
  engine = buildEngine();
}

function buildEngine() {
  const ladder = settings.get('ladder', DEFAULTS.ladder);
  const actions = {
    nudge: (level) => {
      // waitMs for the ring = the wait of the CURRENT ladder step; approximate with
      // the max nudge/pause wait so the ring is meaningful. Use the first ladder wait.
      showNudge(level, ladder[0]?.waitMs ?? 30000);
    },
    pause: () => {
      osActions.pressMediaPlayPause();
      addRecap({ title: mediaWatcher.currentTitle, app: null, timestamp: Date.now() });
      pushPanelState();
    },
    sleep: () => { hideNudge(); osActions.sleepNow(); },
    displayOff: () => { hideNudge(); osActions.displayOff(); },
  };
  return new EscalationEngine({
    ladder,
    finalAction: settings.get('finalAction', DEFAULTS.finalAction),
    actions,
    onComplete: () => { machine.slept(); pushPanelState(); },
  });
}

function startArmed() { osActions.startCaffeinate(); scheduler.start(); pushPanelState(); tray.refresh(); }
function stopArmed() { osActions.stopCaffeinate(); scheduler.stop(); hideNudge(); pushPanelState(); tray.refresh(); }

function pushPanelState() {
  if (!panelWin || panelWin.isDestroyed()) return;
  panelWin.webContents.send('nyx:panel-state', {
    state: machine ? machine.state : 'IDLE',
    recap: lastRecap(),
    cameraOk,
    monitoringMode,
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media'));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');

  detectorWin = createDetectorWindow();
  panelWin = createPanelWindow();

  machine = new SleepStateMachine({
    config: {
      tAsleepMs: settings.get('tAsleepMs', DEFAULTS.tAsleepMs),
      nightHours: settings.get('nightHours', DEFAULTS.nightHours),
    },
    clock: { now: () => Date.now() },
    nowHour: () => new Date().getHours(),
    on: {
      arm: () => startArmed(),
      disarm: () => { stopArmed(); engine.cancel(); },
      escalate: () => engine.start(),
      deescalate: () => { engine.cancel(); hideNudge(); pushPanelState(); },
    },
  });

  engine = buildEngine();

  tray = new NyxTray({ getState: () => machine.state, onToggle: () => popover.toggle() });
  popover = new Popover({ window: panelWin, tray: tray.tray });

  scheduler = new CaptureScheduler({
    detectorWebContents: detectorWin.webContents,
    getState: () => machine.state,
    intervals: settings.get('intervals', DEFAULTS.intervals),
  });

  mediaWatcher = new MediaWatcher({ pollMs: 5000 });
  mediaWatcher.on('media-playing', () => { if (monitoringAllowed()) machine.mediaPlaying(); });
  mediaWatcher.on('media-stopped', () => machine.mediaStopped());
  mediaWatcher.start();

  idleMonitor = new IdleMonitor({ powerMonitor });
  idleMonitor.on('input', () => machine.input());
  idleMonitor.start();

  tickTimer = setInterval(() => machine.tick(), 1000);

  ipcMain.on('nyx:frame', (_e, sample) => {
    machine.frame(classifyEyes(sample, currentThreshold()));
    if (calibrationOpen) forwardCalibrationScore(sample);
  });
  ipcMain.on('nyx:detector-ready', () => { cameraOk = true; pushPanelState(); });
  ipcMain.on('nyx:detector-error', (_e, msg) => {
    console.error('[nyx] detector error:', msg);
    cameraOk = false; pushPanelState();
  });

  // Calibration
  ipcMain.on('nyx:calibrate-request', (_e, { phase }) => detectorWin.webContents.send('nyx:calibrate-capture', { phase }));
  ipcMain.on('nyx:calibrate-result', (_e, { phase, sample }) => {
    if (!sample || !calibrationSamples[phase]) return;
    calibrationSamples[phase].push(sample);
    if (calibrationSamples.open.length >= CALIBRATION_MIN && calibrationSamples.closed.length >= CALIBRATION_MIN) {
      settings.set('eyeCloseThreshold', computeThreshold(calibrationSamples.open, calibrationSamples.closed));
    }
  });

  // Panel
  ipcMain.on('nyx:panel-ready', () => pushPanelState());
  ipcMain.on('nyx:set-monitoring', (_e, mode) => setMonitoringMode(mode));
  ipcMain.on('nyx:open-settings', () => showSettings());
  ipcMain.on('nyx:open-calibration', () => openCalibration());
  ipcMain.on('nyx:quit', () => { stopArmed(); app.quit(); });

  // Settings
  ipcMain.handle('nyx:get-settings', () => readSettingsView());
  ipcMain.handle('nyx:set-setting', (_e, { key, value }) => {
    const view = readSettingsView();
    view[key] = value;
    applySettingsView(view);
    return readSettingsView();
  });
});

let calibrationScoreTarget = null;
function openCalibration() {
  calibrationSamples.open = []; calibrationSamples.closed = [];
  const win = showCalibration();
  calibrationOpen = true;
  calibrationScoreTarget = win.webContents;
  win.on('closed', () => { calibrationOpen = false; calibrationScoreTarget = null; });
}
function forwardCalibrationScore(sample) {
  if (calibrationScoreTarget && !calibrationScoreTarget.isDestroyed()) {
    calibrationScoreTarget.send('nyx:calibrate-score', sample);
  }
}

app.on('window-all-closed', (e) => e.preventDefault());
```

- [ ] **Step 2: Update `showNudge` to accept `waitMs`** — modify `src/main/windows.js`:

Change the `showNudge(level)` signature and both sends to include `waitMs`:

```js
function showNudge(level, waitMs) {
  if (nudgeWin) { nudgeWin.webContents.send('nyx:nudge', { level, waitMs }); return nudgeWin; }
  const { width, height } = screen.getPrimaryDisplay().bounds;
  nudgeWin = new BrowserWindow({
    width, height, x: 0, y: 0,
    frame: false, transparent: true, alwaysOnTop: true, focusable: false,
    skipTaskbar: true, hasShadow: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  nudgeWin.setIgnoreMouseEvents(true);
  nudgeWin.loadFile(path.join(__dirname, '..', 'renderer', 'nudge.html'));
  nudgeWin.webContents.once('did-finish-load', () => nudgeWin.webContents.send('nyx:nudge', { level, waitMs }));
  nudgeWin.on('closed', () => { nudgeWin = null; });
  return nudgeWin;
}
```

- [ ] **Step 3: `node --check src/main/main.js` and `node --check src/main/windows.js`** — both pass.

- [ ] **Step 4: Run full unit suite** `npx vitest run` — all green (unchanged core/pure tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/main.js src/main/windows.js
git commit -m "feat(main): popover wiring, settings IPC, monitoring override, login item"
```

---

## Phase D — Packaging

### Task 13: App icon (.icns)

**Files:** Create `scripts/make-icon.js`, generate `src/resources/icon.icns`.

Reuse the crescent generator to render PNGs at icon sizes, then `iconutil` into `.icns`.

- [ ] **Step 1: Create `scripts/make-icon.js`**

```js
// Renders crescent PNGs into a .iconset and calls iconutil to build src/resources/icon.icns.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function crc32(buf){let c=~0;for(let i=0;i<buf.length;i++){c^=buf[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return ~c>>>0;}
function chunk(type,data){const t=Buffer.from(type,'ascii');const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
function makePNG(size){
  const cx=size/2,cy=size/2,r=size*0.40,ox=cx+size*0.20,oy=cy-size*0.12,orr=r*0.95;
  const raw=Buffer.alloc(size*(size*4+1));let p=0;
  for(let y=0;y<size;y++){raw[p++]=0;for(let x=0;x<size;x++){
    const inMain=(x-cx)**2+(y-cy)**2<=r*r,inSub=(x-ox)**2+(y-oy)**2<=orr*orr,on=inMain&&!inSub;
    // moonlit indigo crescent on deep-navy rounded bg
    const bg=(x-cx)**2+(y-cy)**2<=(size*0.48)**2;
    if(on){raw[p++]=124;raw[p++]=140;raw[p++]=248;raw[p++]=255;}
    else if(bg){raw[p++]=11;raw[p++]=14;raw[p++]=20;raw[p++]=255;}
    else{raw[p++]=0;raw[p++]=0;raw[p++]=0;raw[p++]=0;}
  }}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}

const res=path.join(__dirname,'..','src','resources');
const set=path.join(res,'icon.iconset');
fs.mkdirSync(set,{recursive:true});
const specs=[[16,'16x16'],[32,'16x16@2x'],[32,'32x32'],[64,'32x32@2x'],[128,'128x128'],[256,'128x128@2x'],[256,'256x256'],[512,'256x256@2x'],[512,'512x512'],[1024,'512x512@2x']];
for(const [sz,name] of specs) fs.writeFileSync(path.join(set,`icon_${name}.png`),makePNG(sz));
execFileSync('iconutil',['-c','icns','-o',path.join(res,'icon.icns'),set]);
fs.rmSync(set,{recursive:true,force:true});
console.log('wrote src/resources/icon.icns');
```

- [ ] **Step 2: Run it** — `node scripts/make-icon.js`
Expected: `wrote src/resources/icon.icns`, and `src/resources/icon.icns` exists (`ls -la src/resources/icon.icns`).

- [ ] **Step 3: Commit**

```bash
git add scripts/make-icon.js src/resources/icon.icns
git commit -m "feat(assets): app icon (.icns) generator"
```

---

### Task 14: Vendor the MediaPipe model (offline)

**Files:** Create `scripts/fetch-model.js`, modify `src/renderer/detector.js`.

Download `face_landmarker.task` into `src/resources/mediapipe/` and point the detector at
it so the packaged app works offline. The wasm already resolves from `node_modules`
(bundled, `asar: false`).

- [ ] **Step 1: Create `scripts/fetch-model.js`**

```js
const fs = require('fs');
const path = require('path');
const https = require('https');

const URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const outDir = path.join(__dirname, '..', 'src', 'resources', 'mediapipe');
const out = path.join(outDir, 'face_landmarker.task');
fs.mkdirSync(outDir, { recursive: true });

function download(url, dest, redirects = 0) {
  https.get(url, (res) => {
    if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
      res.resume(); return download(res.headers.location, dest, redirects + 1);
    }
    if (res.statusCode !== 200) { console.error('HTTP', res.statusCode); process.exit(1); }
    const file = fs.createWriteStream(dest);
    res.pipe(file);
    file.on('finish', () => file.close(() => console.log('wrote', dest, fs.statSync(dest).size, 'bytes')));
  }).on('error', (e) => { console.error(e.message); process.exit(1); });
}
download(URL, out);
```

- [ ] **Step 2: Run it** — `node scripts/fetch-model.js`
Expected: `wrote .../src/resources/mediapipe/face_landmarker.task <N> bytes` (N ≈ 3–4 MB).

- [ ] **Step 3: Point the detector at the local model** — in `src/renderer/detector.js`, change the `modelAssetPath` value from the Google CDN URL to the vendored file, resolved relative to the detector document:

```js
      baseOptions: {
        modelAssetPath: new URL('../resources/mediapipe/face_landmarker.task', import.meta.url).href,
      },
```

- [ ] **Step 4: `node --check src/renderer/detector.js`** — must pass.

- [ ] **Step 5: Git-ignore the large model, commit the script + detector change**

Add `src/resources/mediapipe/face_landmarker.task` to `.gitignore` (large binary, regenerated by the script). Then:

```bash
git add .gitignore scripts/fetch-model.js src/renderer/detector.js
git commit -m "feat: vendor mediapipe model locally for offline detection"
```

> The model file itself is NOT committed (git-ignored). electron-builder bundles it from
> disk via the `files`/`extraResources` config in Task 15, so it must exist on disk at
> package time — `npm run dist` (Task 15) runs `fetch-model` first.

---

### Task 15: electron-builder packaging

**Files:** Modify `package.json`.

- [ ] **Step 1: Install electron-builder**

Run: `npm install --save-dev electron-builder@^24`
Expected: added to devDependencies, exit 0.

- [ ] **Step 2: Add scripts and build config to `package.json`**

Update the `scripts` block to include (keep existing entries):

```json
    "predist": "npm run build:mediakey && node scripts/make-icon.js && node scripts/fetch-model.js",
    "dist": "electron-builder --mac"
```

Add a top-level `build` block:

```json
  "build": {
    "appId": "com.oleh.nyx",
    "productName": "Nyx",
    "asar": false,
    "directories": { "output": "dist" },
    "files": [
      "src/**/*",
      "!src/**/*.test.js",
      "!docs/**",
      "!tests/**"
    ],
    "extraResources": [
      { "from": "src/resources", "to": "resources" }
    ],
    "mac": {
      "category": "public.app-category.utilities",
      "target": ["dmg", "zip"],
      "icon": "src/resources/icon.icns",
      "identity": null,
      "extendInfo": { "LSUIElement": true }
    }
  }
```

> `asar: false` keeps `__dirname`-relative paths (media-key binary at `src/resources/mediakey`,
> MediaPipe wasm under `node_modules`) working identically in the bundle and in dev. The
> `extraResources` copy is belt-and-suspenders so resources also exist at
> `Contents/Resources/resources`; the code paths continue to use the `src/resources` copy that
> ships via `files`, so no path changes are needed. `identity: null` = unsigned.

- [ ] **Step 3: Build the DMG**

Run: `npm run dist`
Expected: `predist` builds the helper, icon, and model; electron-builder produces
`dist/Nyx-0.1.0.dmg` and a `.zip`. Confirm `ls -la dist/*.dmg`.
> If electron-builder complains about code signing, confirm `mac.identity` is `null`. If it
> tries to notarize, ensure no `afterSign`/notarize config is present (there isn't).

- [ ] **Step 4: Smoke-test the packaged app** (manual)

Open `dist/mac*/Nyx.app` (or mount the dmg). First launch: right-click → Open (Gatekeeper,
unsigned). Confirm the tray icon appears and clicking it opens the popover. Full behavior is
covered by the RUNBOOK (Task 16).

- [ ] **Step 5: Ensure `dist/` is git-ignored, then commit**

`.gitignore` already contains `dist/`. Commit only the manifest:

```bash
git add package.json package-lock.json
git commit -m "build: electron-builder unsigned dmg packaging"
```

---

### Task 16: RUNBOOK update + final review

**Files:** Modify `docs/RUNBOOK.md`.

- [ ] **Step 1: Append a "UI & Packaging" section to `docs/RUNBOOK.md`**

```markdown
## UI & Packaging (v2)

### Popover
- Click the menu-bar crescent → popover opens under the icon; click away → it hides.
- Panel shows live state (Idle/Watching/Nudging), camera status, and last night's recap.
- Monitoring dropdown: Auto / Off tonight (until ~5am) / Snooze 1h — verify each suppresses
  arming when a video plays, and Auto resumes it.

### Settings
- Popover → Settings. Change fall-asleep delay, nudge/pause waits, final action, night
  hours, launch-at-login. Each change persists immediately (reopen Settings to confirm).
- Toggle "Launch at login" → check System Settings → General → Login Items lists Nyx.
- "Recalibrate" opens the calibration wizard.

### Calibration (restyled)
- Shows a live mirror preview + a live blink-score readout that changes as you blink.
- Capture 10 open + 10 closed → console logs the new threshold; Settings shows it.

### Nudge (restyled)
- The overlay dims + blurs, shows a breathing crescent and a countdown ring that drains
  over the current step's wait. Loud step plays the chime louder.

### Packaging
- `npm run dist` → `dist/Nyx-0.1.0.dmg`. Mount it, drag Nyx to Applications.
- First launch: right-click Nyx.app → Open (unsigned; Gatekeeper prompt once).
- Confirm inside the packaged app: tray + popover work, calibration camera works, a video
  arms it, and the media-key pause + sleep still fire (Accessibility permission granted to
  Nyx.app, not to the terminal).
```

- [ ] **Step 2: Commit**

```bash
git add docs/RUNBOOK.md
git commit -m "docs: runbook for UI and packaging"
```

- [ ] **Step 3: Final review (controller dispatches a reviewer)**

After all tasks, dispatch a final integration reviewer over the full `main..HEAD` diff for:
IPC contract consistency across preload/panel/settings/detector/main, the settings
view↔store translation round-trip, monitoring-override correctness, engine-rebuild on
settings change, and that `npm run dist` config is coherent. Fix any Critical/Important
findings before finishing the branch.

---

## Self-Review Notes (author verification)

- **Spec coverage:** popover panel → Tasks 2,4,9,10,11,12; Settings window → Tasks 1,5,9,12;
  restyle nudge → Task 6; restyle calibration + live preview → Task 7; design system → Task 3;
  launch-at-login → Tasks 5,12; packaging unsigned dmg → Task 15; resource-path fix →
  addressed via `asar:false` (Tasks 14,15, documented); monitoring override → Task 12;
  pure tests (position math, settings clamp) → Tasks 1,2.
- **Superseded spec item:** `src/main/resources-path.js` is intentionally dropped — `asar:false`
  makes it unnecessary. Documented in "Design Decisions Locked In" and Task 15.
- **IPC consistency:** every channel added to `preload.js` (Task 8) is produced/consumed in
  `main.js` (Task 12) and the renderer pages (Tasks 4,5,6,7): `nyx:panel-state`,
  `nyx:panel-ready`, `nyx:set-monitoring`, `nyx:open-settings`, `nyx:open-calibration`,
  `nyx:quit`, `nyx:get-settings`, `nyx:set-setting`, `nyx:calibrate-score`, and the extended
  `nyx:nudge` `{level, waitMs}`.
- **Signature consistency:** `showNudge(level, waitMs)` updated in windows.js (Task 12 Step 2)
  and called that way in `buildEngine` (Task 12 Step 1). `NyxTray({ onToggle, getState })`
  matches Task 11 and its construction in Task 12. `Popover({ window, tray })` matches Task 10
  and Task 12. `clampSettingsView` used in Tasks 1 and 12.
- **Known follow-up:** detection-v2 (numbers-only logging, closure-strength, owner-ID) is a
  separate future spec, not in this plan.
```
