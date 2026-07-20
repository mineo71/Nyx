# Nyx Native UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. For the renderer surfaces, apply the superpowers:frontend-design skill for visual polish (spacing, hierarchy, motion) on top of the scaffolding below.

**Goal:** Make Nyx look like a real macOS app — window vibrancy (frosted glass), Tailwind (compiled offline), Lucide icons, native controls (toggle switches, segmented control, steppers), system accent, dark always — with zero behavior changes.

**Architecture:** Presentation-only. `windows.js` gains `vibrancy`/transparent windows + an accent query param; `main.js` reads the system accent; renderer HTML/JS is rebuilt on a Tailwind component layer (`app.css`) with bundled Lucide SVGs. One pure helper (`accent.js`) is TDD-tested; the rest is visual/manual. Existing 68 unit tests must stay green.

**Tech Stack:** Electron `vibrancy`, Tailwind CSS v3 (local CLI build), `lucide-static`, vanilla HTML/JS, Vitest.

---

## Locked decisions (keep consistent across tasks)
- Tailwind **v3** (`tailwindcss@^3.4`), classic config + `@tailwind` directives, built via `npx tailwindcss` CLI. Output `src/renderer/styles/app.css` is **git-ignored** and built in `prestart`/`predist`.
- Lucide SVGs are **committed** under `src/renderer/icons/` (copied once by a script). Glyphs: `moon`, `sliders-horizontal`, `scan-face`, `power`, `camera`.
- Accent passed to each window as a 6-hex query param `?accent=RRGGBB` (no `#`); `accent-init.js` sets `--accent: #RRGGBB`. Default `7C8CF8`.
- All windows transparent; `body` transparent; content on translucent surfaces. `tokens.css` is deleted.
- Element IDs preserved so existing JS keeps working; `<select>`s become segmented controls (JS updated in the same task).

## File Structure
```
package.json                       MOD  tailwind/lucide devDeps + build:css / copy-icons / prestart / predist
tailwind.config.js                 NEW  content globs + theme
src/renderer/styles/tailwind.css   NEW  @tailwind + @layer base/components (native controls)
src/renderer/styles/app.css        GEN  compiled (git-ignored)
src/renderer/styles/tokens.css     DEL
src/renderer/icons/*.svg           NEW  committed Lucide glyphs
src/renderer/accent-init.js        NEW  reads ?accent -> --accent
src/core/accent.js                 NEW  pure normalizeAccent
src/main/windows.js                MOD  vibrancy + transparent + setAccent + accent query
src/main/main.js                   MOD  read system accent -> setAccent
src/renderer/panel.html/.js        MOD  redesign + segmented Monitoring
src/renderer/settings.html/.js     MOD  redesign + switches/steppers/segmented finalAction
src/renderer/nudge.html            MOD  frosted overlay restyle (nudge.js unchanged)
src/renderer/calibration.html/.js  MOD  redesign
scripts/copy-icons.js              NEW  copy lucide SVGs -> src/renderer/icons
scripts/make-icon.js               MOD  build icon.icns from logo.png if present
docs/RUNBOOK.md                    MOD  redesign verify steps
scripts/make-icon.js               (see Task 9)
```

---

## Task 1: Accent normalization (TDD)

**Files:** Create `src/core/accent.js`, Test `tests/core/accent.test.js`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { normalizeAccent } from '../../src/core/accent.js';

describe('normalizeAccent', () => {
  it('strips the alpha from an 8-digit macOS accent hex', () => {
    expect(normalizeAccent('7C8CF8FF')).toBe('7C8CF8');
  });
  it('accepts a 6-digit hex with or without leading #', () => {
    expect(normalizeAccent('#A1B2C3')).toBe('A1B2C3');
    expect(normalizeAccent('a1b2c3')).toBe('A1B2C3');
  });
  it('defaults on empty / null / garbage', () => {
    expect(normalizeAccent('')).toBe('7C8CF8');
    expect(normalizeAccent(null)).toBe('7C8CF8');
    expect(normalizeAccent('zzz')).toBe('7C8CF8');
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/core/accent.test.js`

- [ ] **Step 3: Implement `src/core/accent.js`**

```js
const DEFAULT_ACCENT = '7C8CF8';

// Normalize a system accent color to a 6-hex string (no '#', uppercase).
// macOS getAccentColor() returns 'RRGGBBAA'; also tolerates '#RRGGBB' / 'RRGGBB'.
function normalizeAccent(raw) {
  if (typeof raw !== 'string') return DEFAULT_ACCENT;
  const hex = raw.replace(/^#/, '').trim().toUpperCase();
  if (/^[0-9A-F]{6}/.test(hex)) return hex.slice(0, 6);
  return DEFAULT_ACCENT;
}

module.exports = { normalizeAccent, DEFAULT_ACCENT };
```

- [ ] **Step 4: Run, verify PASS (3 tests)** then full suite `npx vitest run`.

- [ ] **Step 5: Commit**

```bash
git add src/core/accent.js tests/core/accent.test.js
git commit -m "feat(core): system accent normalization"
```

---

## Task 2: Tailwind + Lucide toolchain

**Files:** Modify `package.json`; Create `tailwind.config.js`, `src/renderer/styles/tailwind.css`, `scripts/copy-icons.js`; update `.gitignore`.

- [ ] **Step 1: Install dev deps**

Run: `npm install --save-dev tailwindcss@^3.4 lucide-static@^0.400.0`
Expected: both in devDependencies, exit 0.

- [ ] **Step 2: Create `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,js}'],
  theme: {
    extend: {
      fontFamily: { sans: ['-apple-system', 'SF Pro Text', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Create `src/renderer/styles/tailwind.css`** (base + native-control component layer)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root { --accent: #7C8CF8; }
  html, body {
    margin: 0; background: transparent; color: #F2F3F5;
    font-family: -apple-system, "SF Pro Text", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased; user-select: none; cursor: default;
  }
  h1, h2, h3, p { margin: 0; }
}

@layer components {
  .nyx-card { @apply rounded-xl p-3; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); }
  .nyx-row { @apply flex items-center justify-between; }
  .nyx-muted { color: rgba(242,243,245,0.55); }

  .nyx-btn { @apply rounded-lg px-3 py-2 text-[13px] flex items-center justify-center gap-2 transition-colors;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); color: #F2F3F5; }
  .nyx-btn:hover { background: rgba(255,255,255,0.12); }
  .nyx-btn-primary { background: var(--accent); color: #0B0E14; border-color: transparent; }
  .nyx-btn-primary:hover { filter: brightness(1.08); }

  .nyx-switch { position: relative; width: 38px; height: 22px; display: inline-block; flex: none; }
  .nyx-switch input { position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
  .nyx-switch .track { position: absolute; inset: 0; border-radius: 999px; background: rgba(255,255,255,0.15); transition: background .15s ease; pointer-events: none; }
  .nyx-switch .track::after { content: ""; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 999px; background: #fff; transition: transform .15s ease; box-shadow: 0 1px 2px rgba(0,0,0,.4); }
  .nyx-switch input:checked + .track { background: var(--accent); }
  .nyx-switch input:checked + .track::after { transform: translateX(16px); }

  .nyx-seg { display: inline-flex; gap: 2px; padding: 2px; border-radius: 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); }
  .nyx-seg button { border: 0; background: transparent; color: #F2F3F5; font-size: 12px; padding: 4px 10px; border-radius: 6px; cursor: pointer; }
  .nyx-seg button.active { background: rgba(255,255,255,0.14); box-shadow: 0 1px 2px rgba(0,0,0,.3); }

  .nyx-stepper { display: inline-flex; align-items: center; gap: 4px; }
  .nyx-stepper input { width: 52px; text-align: center; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); border-radius: 6px; padding: 3px 6px; color: #F2F3F5; font-size: 13px; }
  .nyx-stepper button { width: 22px; height: 22px; border-radius: 6px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.10); color: #F2F3F5; cursor: pointer; line-height: 1; }
  .nyx-stepper button:hover { background: rgba(255,255,255,0.14); }

  .nyx-icon { display: inline-block; width: 16px; height: 16px; background: currentColor;
    -webkit-mask-repeat: no-repeat; -webkit-mask-position: center; -webkit-mask-size: contain; }
  .icon-moon { -webkit-mask-image: url('../icons/moon.svg'); }
  .icon-settings { -webkit-mask-image: url('../icons/sliders-horizontal.svg'); }
  .icon-calibrate { -webkit-mask-image: url('../icons/scan-face.svg'); }
  .icon-power { -webkit-mask-image: url('../icons/power.svg'); }
  .icon-camera { -webkit-mask-image: url('../icons/camera.svg'); }

  .nyx-dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; }
}
```

- [ ] **Step 4: Create `scripts/copy-icons.js`**

```js
// Copies the Lucide SVGs we use into src/renderer/icons/ (committed, offline).
const fs = require('fs');
const path = require('path');

const NAMES = ['moon', 'sliders-horizontal', 'scan-face', 'power', 'camera'];
const src = path.join(__dirname, '..', 'node_modules', 'lucide-static', 'icons');
const dest = path.join(__dirname, '..', 'src', 'renderer', 'icons');
fs.mkdirSync(dest, { recursive: true });
for (const n of NAMES) {
  fs.copyFileSync(path.join(src, `${n}.svg`), path.join(dest, `${n}.svg`));
}
console.log('copied', NAMES.length, 'icons ->', dest);
```

- [ ] **Step 5: Add scripts to `package.json`** (keep existing; add these to `scripts`)

```json
    "build:css": "tailwindcss -i src/renderer/styles/tailwind.css -o src/renderer/styles/app.css --minify",
    "copy-icons": "node scripts/copy-icons.js",
    "prestart": "npm run build:css"
```

Update the existing `predist` value to also build CSS (it currently builds mediakey/icon/model):

```json
    "predist": "npm run build:css && npm run build:mediakey && node scripts/make-icon.js && node scripts/fetch-model.js",
```

- [ ] **Step 6: Copy icons + build once**

Run: `npm run copy-icons && npm run build:css`
Expected: `copied 5 icons`, and `src/renderer/styles/app.css` created (non-empty). Confirm `ls -la src/renderer/icons/*.svg src/renderer/styles/app.css`.

- [ ] **Step 7: Git-ignore the compiled CSS**

Append to `.gitignore`:
```
src/renderer/styles/app.css
```

- [ ] **Step 8: Commit** (icons committed, app.css ignored)

```bash
git add package.json package-lock.json tailwind.config.js src/renderer/styles/tailwind.css scripts/copy-icons.js src/renderer/icons .gitignore
git commit -m "build: tailwind toolchain + bundled lucide icons"
```

---

## Task 3: Accent init script + delete tokens.css

**Files:** Create `src/renderer/accent-init.js`; Delete `src/renderer/styles/tokens.css`.

- [ ] **Step 1: Create `src/renderer/accent-init.js`**

```js
// Sets --accent from the ?accent=RRGGBB query param the main process passes per window.
(function () {
  const a = new URLSearchParams(location.search).get('accent') || '7C8CF8';
  document.documentElement.style.setProperty('--accent', '#' + a);
})();
```

- [ ] **Step 2: Delete the old theme file**

Run: `git rm src/renderer/styles/tokens.css`
(The redesigned HTML in later tasks links `app.css`, not `tokens.css`.)

- [ ] **Step 3: `node --check src/renderer/accent-init.js`** — must pass.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/accent-init.js
git commit -m "feat(renderer): accent-init; remove old tokens.css"
```

---

## Task 4: Vibrancy windows + accent plumbing

**Files:** Modify `src/main/windows.js`.

- [ ] **Step 1: Add accent state + setter at the top of `src/main/windows.js`** (after the `PRELOAD` const)

```js
let accentHex = '7C8CF8';
function setAccent(hex) { if (hex) accentHex = hex; }
```

- [ ] **Step 2: Make the detector window untouched, but give the visible windows vibrancy + the accent query.** Replace `createPanelWindow`:

```js
function createPanelWindow() {
  const win = new BrowserWindow({
    width: 300, height: 380,
    show: false, frame: false, resizable: false, movable: false,
    transparent: true, vibrancy: 'popover', visualEffectState: 'active', roundedCorners: true,
    backgroundColor: '#00000000', alwaysOnTop: true, skipTaskbar: true, fullscreenable: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'panel.html'), { query: { accent: accentHex } });
  return win;
}
```

Replace `showSettings`:

```js
function showSettings() {
  if (settingsWin) { settingsWin.focus(); return settingsWin; }
  settingsWin = new BrowserWindow({
    width: 460, height: 600, resizable: false, title: 'Nyx Settings',
    transparent: true, vibrancy: 'under-window', visualEffectState: 'active',
    backgroundColor: '#00000000', titleBarStyle: 'hiddenInset',
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  settingsWin.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'), { query: { accent: accentHex } });
  settingsWin.on('closed', () => { settingsWin = null; });
  return settingsWin;
}
```

Replace `showCalibration` (add vibrancy + accent query; keep size/behavior):

```js
function showCalibration() {
  if (calibrationWin) { calibrationWin.focus(); return calibrationWin; }
  calibrationWin = new BrowserWindow({
    width: 480, height: 560, resizable: false, title: 'Calibrate Nyx',
    transparent: true, vibrancy: 'under-window', visualEffectState: 'active',
    backgroundColor: '#00000000', titleBarStyle: 'hiddenInset',
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  calibrationWin.loadFile(path.join(__dirname, '..', 'renderer', 'calibration.html'), { query: { accent: accentHex } });
  calibrationWin.on('closed', () => { calibrationWin = null; });
  return calibrationWin;
}
```

Leave `showNudge`/`hideNudge`/`createDetectorWindow` as-is (nudge is a transparent overlay already; it keeps CSS blur).

- [ ] **Step 3: Export `setAccent`.** Update the `module.exports` line to include it:

```js
module.exports = { createDetectorWindow, showNudge, hideNudge, showCalibration, createPanelWindow, showSettings, setAccent };
```

- [ ] **Step 4: `node --check src/main/windows.js`** — must pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/windows.js
git commit -m "feat(main): vibrancy windows + accent query plumbing"
```

---

## Task 5: Read the system accent in main

**Files:** Modify `src/main/main.js`.

- [ ] **Step 1: Add imports.** Change the electron require to include `systemPreferences`:

Replace:
```js
const { app, ipcMain, powerMonitor, session, shell } = require('electron');
```
with:
```js
const { app, ipcMain, powerMonitor, session, shell, systemPreferences } = require('electron');
```

Add after the other core requires (near `const { pitchFromMatrix } = ...`):
```js
const { normalizeAccent } = require('../core/accent.js');
```

Add `setAccent` to the windows import — change:
```js
const { createDetectorWindow, showNudge, hideNudge, showCalibration, createPanelWindow, showSettings } = require('./windows.js');
```
to:
```js
const { createDetectorWindow, showNudge, hideNudge, showCalibration, createPanelWindow, showSettings, setAccent } = require('./windows.js');
```

- [ ] **Step 2: Set the accent before creating windows.** Inside `app.whenReady().then(() => {`, as the FIRST statements (before `detectorWin = createDetectorWindow();`):

```js
  try {
    const raw = systemPreferences.getAccentColor ? systemPreferences.getAccentColor() : '';
    setAccent(normalizeAccent(raw));
  } catch { /* keep default accent */ }
```

- [ ] **Step 3: Verify**

Run `node --check src/main/main.js` — must pass.
Run `npx vitest run` — all green (unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/main/main.js
git commit -m "feat(main): apply system accent color to windows"
```

---

## Task 6: Redesign the popover panel

**Files:** Modify `src/renderer/panel.html`, `src/renderer/panel.js`.
Apply the frontend-design skill for final spacing/polish; the scaffolding below is the baseline.

- [ ] **Step 1: Replace `src/renderer/panel.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="./styles/app.css" />
    <script src="./accent-init.js"></script>
  </head>
  <body class="w-[300px] h-[380px] p-4 flex flex-col gap-4">
    <div class="nyx-row">
      <div class="flex items-center gap-2 font-semibold"><span class="nyx-icon icon-moon" style="color:var(--accent)"></span> Nyx</div>
      <div class="flex items-center gap-2 text-xs nyx-muted"><span id="dot" class="nyx-dot"></span><span id="stateLabel">Idle</span></div>
    </div>

    <div>
      <h2 id="statusLine" class="text-[20px] font-medium">Idle</h2>
      <p id="statusSub" class="text-xs mt-1 nyx-muted">Waiting for something to play</p>
    </div>

    <div class="nyx-card">
      <div class="text-[11px] uppercase tracking-wide nyx-muted">Last night</div>
      <div id="recapTitle" class="text-sm mt-1">No sleep events yet</div>
      <div id="recapTime" class="text-xs nyx-muted"></div>
    </div>

    <div class="nyx-row">
      <span class="text-[13px] nyx-muted">Monitoring</span>
      <div class="nyx-seg" id="mode" data-value="auto">
        <button data-value="auto">Auto</button>
        <button data-value="off">Off</button>
        <button data-value="snooze">Snooze</button>
      </div>
    </div>

    <div class="mt-auto flex gap-2">
      <button id="settings" class="nyx-btn flex-1"><span class="nyx-icon icon-settings"></span>Settings</button>
      <button id="calibrate" class="nyx-btn flex-1"><span class="nyx-icon icon-calibrate"></span>Calibrate</button>
      <button id="quit" class="nyx-btn w-10" title="Quit Nyx"><span class="nyx-icon icon-power"></span></button>
    </div>

    <script src="./panel.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Replace `src/renderer/panel.js`** (segmented Monitoring instead of `<select>`)

```js
const dot = document.getElementById('dot');
const stateLabel = document.getElementById('stateLabel');
const statusLine = document.getElementById('statusLine');
const statusSub = document.getElementById('statusSub');
const recapTitle = document.getElementById('recapTitle');
const recapTime = document.getElementById('recapTime');
const modeSeg = document.getElementById('mode');

const STATE_COPY = {
  IDLE:       { label: 'Idle',      line: 'Idle',              sub: 'Waiting for something to play', dot: 'rgba(242,243,245,0.35)' },
  WATCHING:   { label: 'Watching',  line: 'Watching over you', sub: 'Armed by playback',             dot: 'var(--accent)' },
  DROWSY:     { label: 'Watching',  line: 'Checking on you…',  sub: 'Your eyes look closed',         dot: 'var(--accent)' },
  ESCALATING: { label: 'Nudging',   line: 'Still watching?',   sub: 'Nudging you awake',             dot: '#E0A45C' },
};

function segSet(el, value) {
  el.dataset.value = value;
  el.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.value === value));
}

function render(s) {
  const c = STATE_COPY[s.state] || STATE_COPY.IDLE;
  dot.style.background = c.dot;
  stateLabel.textContent = c.label;
  statusLine.textContent = c.line;
  statusSub.textContent = s.cameraOk === false ? 'Camera unavailable — auto-sleep off' : c.sub;
  statusSub.style.color = s.cameraOk === false ? '#E0A45C' : 'rgba(242,243,245,0.55)';
  if (s.recap) {
    recapTitle.textContent = `Paused "${s.recap.title}"`;
    recapTime.textContent = `at ${new Date(s.recap.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  } else {
    recapTitle.textContent = 'No sleep events yet';
    recapTime.textContent = '';
  }
  if (s.monitoringMode) segSet(modeSeg, s.monitoringMode);
}

modeSeg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
  segSet(modeSeg, b.dataset.value);
  window.nyx.setMonitoringMode(b.dataset.value);
}));

window.nyx.onPanelState((_e, s) => render(s));
document.getElementById('calibrate').addEventListener('click', () => window.nyx.openCalibration());
document.getElementById('settings').addEventListener('click', () => window.nyx.openSettings());
document.getElementById('quit').addEventListener('click', () => window.nyx.quit());

segSet(modeSeg, 'auto');
window.nyx.panelReady();
```

- [ ] **Step 3: Rebuild CSS + syntax check**

Run: `npm run build:css && node --check src/renderer/panel.js`
Expected: both succeed (Tailwind picks up the new classes used in panel.html).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/panel.html src/renderer/panel.js
git commit -m "feat(renderer): redesign popover panel (vibrancy + native controls)"
```

---

## Task 7: Redesign the Settings window

**Files:** Modify `src/renderer/settings.html`, `src/renderer/settings.js`.

- [ ] **Step 1: Replace `src/renderer/settings.html`** (cards, switches, steppers, segmented final action)

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="./styles/app.css" />
    <script src="./accent-init.js"></script>
  </head>
  <body class="w-[460px] p-6 flex flex-col gap-5">
    <section class="flex flex-col gap-3">
      <h3 class="text-[12px] uppercase tracking-wide nyx-muted">Detection</h3>
      <div class="nyx-card flex flex-col gap-3">
        <div class="nyx-row"><label class="text-[13px]">Fall-asleep delay</label>
          <div class="nyx-stepper" data-target="tAsleepSec" data-min="5" data-max="3600">
            <button data-step="-5">−</button><input id="tAsleepSec" type="number" min="5" max="3600" /><button data-step="5">+</button><span class="nyx-muted text-xs ml-1">s</span>
          </div>
        </div>
        <div class="nyx-row"><label class="text-[13px]">Eye-closed threshold</label>
          <div class="flex items-center gap-2"><span id="threshold" class="nyx-muted text-[13px]">—</span><button id="recalibrate" class="nyx-btn">Recalibrate</button></div>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h3 class="text-[12px] uppercase tracking-wide nyx-muted">Escalation</h3>
      <div class="nyx-card flex flex-col gap-3">
        <div class="nyx-row"><label class="text-[13px]">Nudge wait</label>
          <div class="nyx-stepper" data-target="nudgeWaitSec" data-min="5" data-max="600">
            <button data-step="-5">−</button><input id="nudgeWaitSec" type="number" min="5" max="600" /><button data-step="5">+</button><span class="nyx-muted text-xs ml-1">s</span>
          </div>
        </div>
        <div class="nyx-row"><label class="text-[13px]">Pause wait</label>
          <div class="nyx-stepper" data-target="pauseWaitSec" data-min="5" data-max="600">
            <button data-step="-5">−</button><input id="pauseWaitSec" type="number" min="5" max="600" /><button data-step="5">+</button><span class="nyx-muted text-xs ml-1">s</span>
          </div>
        </div>
        <div class="nyx-row"><label class="text-[13px]">Final action</label>
          <div class="nyx-seg" id="finalAction" data-value="sleep">
            <button data-value="sleep">Sleep</button><button data-value="displayOff">Display</button><button data-value="pauseOnly">Pause</button>
          </div>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h3 class="text-[12px] uppercase tracking-wide nyx-muted">Night hours</h3>
      <div class="nyx-card flex flex-col gap-3">
        <div class="nyx-row">
          <label class="text-[13px]">Only monitor at night</label>
          <label class="nyx-switch"><input id="nightHoursEnabled" type="checkbox" /><span class="track"></span></label>
        </div>
        <div class="nyx-row"><span class="nyx-muted text-[13px]">Window</span>
          <div class="flex items-center gap-2 nyx-muted text-xs">
            from <div class="nyx-stepper" data-target="nightHoursStart" data-min="0" data-max="23"><button data-step="-1">−</button><input id="nightHoursStart" type="number" min="0" max="23" /><button data-step="1">+</button></div>
            to <div class="nyx-stepper" data-target="nightHoursEnd" data-min="0" data-max="23"><button data-step="-1">−</button><input id="nightHoursEnd" type="number" min="0" max="23" /><button data-step="1">+</button></div>
          </div>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h3 class="text-[12px] uppercase tracking-wide nyx-muted">General</h3>
      <div class="nyx-card flex flex-col gap-3">
        <div class="nyx-row"><label class="text-[13px]">Launch at login</label>
          <label class="nyx-switch"><input id="openAtLogin" type="checkbox" /><span class="track"></span></label>
        </div>
        <div class="nyx-row"><label class="text-[13px]">Log detection data <span class="nyx-muted">(numbers only)</span></label>
          <div class="flex items-center gap-2">
            <button id="revealLog" class="nyx-btn">Reveal log</button>
            <label class="nyx-switch"><input id="logDetection" type="checkbox" /><span class="track"></span></label>
          </div>
        </div>
      </div>
    </section>

    <script src="./settings.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Replace `src/renderer/settings.js`** (steppers dispatch change; segmented finalAction; switches unchanged)

```js
const NUM_KEYS = ['tAsleepSec', 'nudgeWaitSec', 'pauseWaitSec', 'nightHoursStart', 'nightHoursEnd'];
const BOOL_KEYS = ['nightHoursEnabled', 'openAtLogin', 'logDetection'];
const finalActionSeg = document.getElementById('finalAction');

function segSet(el, value) {
  el.dataset.value = value;
  el.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.value === value));
}

function fill(view) {
  NUM_KEYS.forEach((k) => { document.getElementById(k).value = view[k]; });
  BOOL_KEYS.forEach((k) => { document.getElementById(k).checked = view[k]; });
  segSet(finalActionSeg, view.finalAction);
  document.getElementById('threshold').textContent = (view.eyeCloseThreshold ?? 0).toFixed(2);
}

async function save(key, value) {
  const stored = await window.nyx.setSetting(key, value);
  fill(stored);
}

function wireSteppers() {
  document.querySelectorAll('.nyx-stepper').forEach((stepper) => {
    const input = stepper.querySelector('input');
    const min = Number(stepper.dataset.min);
    const max = Number(stepper.dataset.max);
    stepper.querySelectorAll('button[data-step]').forEach((btn) => btn.addEventListener('click', () => {
      const next = Math.max(min, Math.min(max, Number(input.value) + Number(btn.dataset.step)));
      input.value = next;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }));
  });
}

async function init() {
  fill(await window.nyx.getSettings());
  NUM_KEYS.forEach((k) => document.getElementById(k).addEventListener('change', (e) => save(k, Number(e.target.value))));
  BOOL_KEYS.forEach((k) => document.getElementById(k).addEventListener('change', (e) => save(k, e.target.checked)));
  finalActionSeg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => save('finalAction', b.dataset.value)));
  wireSteppers();
  document.getElementById('recalibrate').addEventListener('click', () => window.nyx.openCalibration());
  document.getElementById('revealLog').addEventListener('click', () => window.nyx.revealLog());
}

init();
```

- [ ] **Step 3: Rebuild CSS + syntax check**

Run: `npm run build:css && node --check src/renderer/settings.js`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/settings.html src/renderer/settings.js
git commit -m "feat(renderer): redesign settings (switches, steppers, segmented)"
```

---

## Task 8: Restyle nudge + calibration

**Files:** Modify `src/renderer/nudge.html`, `src/renderer/calibration.html`. (`nudge.js` and `calibration.js` are unchanged — keep their element IDs.)

- [ ] **Step 1: Replace `src/renderer/nudge.html`** (frosted overlay on app.css; keeps `#chime`, `.ring`, `.prog`)

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="./styles/app.css" />
    <script src="./accent-init.js"></script>
    <style>
      html, body { height: 100%; background: transparent; overflow: hidden; }
      .backdrop { position: fixed; inset: 0; background: rgba(7,9,14,0.5); backdrop-filter: blur(24px) saturate(160%); display: flex; align-items: center; justify-content: center; }
      .wrap { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 28px; }
      .moon { width: 72px; height: 72px; color: var(--accent); animation: breathe 4s ease-in-out infinite; }
      @keyframes breathe { 0%,100% { opacity: .55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
      h1 { font-size: 44px; font-weight: 300; }
      p { font-size: 18px; color: rgba(242,243,245,0.6); }
      .ring { transform: rotate(-90deg); }
      .ring circle { fill: none; stroke-width: 4; }
      .ring .track { stroke: rgba(255,255,255,0.12); }
      .ring .prog { stroke: var(--accent); stroke-linecap: round; transition: stroke-dashoffset 1s linear; }
    </style>
  </head>
  <body>
    <div class="backdrop">
      <div class="wrap">
        <span class="nyx-icon icon-moon moon"></span>
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

> Note: `.moon` overrides `.nyx-icon`'s 16px size to 72px; the mask still renders the crescent, tinted via `color: var(--accent)`.

- [ ] **Step 2: Replace `src/renderer/calibration.html`** (framed preview + accent dots; keeps `#preview`, `#instruction`, `#score`, `#dots`, `#capture`, `#status`)

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="./styles/app.css" />
    <script src="./accent-init.js"></script>
    <style>
      video { width: 260px; height: 195px; border-radius: 12px; background: #000; border: 1px solid rgba(255,255,255,0.12); transform: scaleX(-1); object-fit: cover; }
      #dots .d { width: 8px; height: 8px; border-radius: 999px; background: rgba(255,255,255,0.18); }
      #dots .d.on { background: var(--accent); }
    </style>
  </head>
  <body class="w-[480px] p-6 flex flex-col items-center gap-4">
    <h2 class="text-[20px] font-medium self-start">Calibrate Nyx</h2>
    <video id="preview" autoplay playsinline muted></video>
    <p id="instruction" class="text-center text-[15px]">Step 1 — look at the camera with your eyes <b>open</b>, then click Capture ~10 times.</p>
    <div class="text-[13px] nyx-muted">Blink score: <span id="score">—</span></div>
    <div class="flex gap-1" id="dots"></div>
    <button id="capture" class="nyx-btn nyx-btn-primary px-6">Capture</button>
    <div id="status" class="nyx-muted text-[13px]"></div>
    <script src="./calibration.js"></script>
  </body>
</html>
```

- [ ] **Step 3: Rebuild CSS**

Run: `npm run build:css`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/nudge.html src/renderer/calibration.html
git commit -m "feat(renderer): restyle nudge and calibration surfaces"
```

---

## Task 9: Logo → app icon support

**Files:** Modify `scripts/make-icon.js`.

Make the icon builder prefer a user-supplied `src/resources/logo.png` (from the AI prompt),
falling back to the generated crescent.

- [ ] **Step 1: Update `scripts/make-icon.js`** — at the very top of the file, before the existing crescent-generation logic, add a logo-based path that short-circuits when a logo exists:

```js
const fsChk = require('fs');
const pathChk = require('path');
const { execFileSync: execChk } = require('child_process');
const logoPath = pathChk.join(__dirname, '..', 'src', 'resources', 'logo.png');
const resDir = pathChk.join(__dirname, '..', 'src', 'resources');
if (fsChk.existsSync(logoPath)) {
  const set = pathChk.join(resDir, 'icon.iconset');
  fsChk.mkdirSync(set, { recursive: true });
  const specs = [[16,'16x16'],[32,'16x16@2x'],[32,'32x32'],[64,'32x32@2x'],[128,'128x128'],[256,'128x128@2x'],[256,'256x256'],[512,'256x256@2x'],[512,'512x512'],[1024,'512x512@2x']];
  for (const [sz, name] of specs) {
    execChk('sips', ['-z', String(sz), String(sz), logoPath, '--out', pathChk.join(set, `icon_${name}.png`)], { stdio: 'ignore' });
  }
  execChk('iconutil', ['-c', 'icns', '-o', pathChk.join(resDir, 'icon.icns'), set]);
  fsChk.rmSync(set, { recursive: true, force: true });
  console.log('wrote src/resources/icon.icns from logo.png');
  process.exit(0);
}
// ---- else: existing generated-crescent logic runs below ----
```

- [ ] **Step 2: Verify the fallback still works** (no logo present yet)

Run: `node scripts/make-icon.js`
Expected: prints `wrote src/resources/icon.icns` (the generated crescent path — since `logo.png` doesn't exist), exit 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/make-icon.js
git commit -m "feat(assets): build app icon from logo.png when provided"
```

> When the user drops `src/resources/logo.png`, re-run `node scripts/make-icon.js` (or `npm run dist`) to bake it into the `.icns`.

---

## Task 10: RUNBOOK + full verification + final review

**Files:** Modify `docs/RUNBOOK.md`.

- [ ] **Step 1: Append a "Native redesign" section to `docs/RUNBOOK.md`**

```markdown
## Native UI redesign

- `npm start` (runs `prestart` → `build:css` first). If styles look unstyled, CSS didn't
  build — run `npm run build:css`.
- Windows should be **frosted/translucent** (vibrancy), not flat dark. The popover has rounded
  corners and blurs what's behind it.
- Panel: Monitoring is a **segmented control** (Auto · Off · Snooze); icon buttons for
  Settings/Calibrate/Quit tint on hover.
- Settings: **toggle switches** (launch-at-login, logging, night hours) and **± steppers**
  for delays; Final action is a **segmented control**. Every change still persists (reopen to
  confirm).
- Colors follow your **macOS accent** (System Settings → Appearance → Accent). Change it,
  relaunch Nyx, confirm the accent updates.
- Icons are Lucide (bundled, offline).
- Logo: generate a 1024² PNG (see spec prompt), save as `src/resources/logo.png`, run
  `node scripts/make-icon.js`, then `npm run dist` to bake it into the app icon.
```

- [ ] **Step 2: Full build + smoke check** (no runtime GUI here — confirm it assembles)

Run: `npm run build:css && npx vitest run`
Expected: `app.css` builds; 68 + 3 (accent) = 71 tests pass.

- [ ] **Step 3: Commit**

```bash
git add docs/RUNBOOK.md
git commit -m "docs: native redesign runbook"
```

- [ ] **Step 4: Final review (controller dispatches a reviewer)**

Dispatch a reviewer over `main..HEAD` for: element-ID/behavior parity (every ID the JS reads
still exists; monitoring + finalAction segmented wiring matches; steppers dispatch change;
switches map to BOOL_KEYS), IPC untouched, accent plumbing (main → windows query → accent-init
→ `--accent`), vibrancy options valid, `tokens.css` fully removed with no dangling references,
`app.css` git-ignored + built in prestart/predist, icon mask paths resolve
(`../icons/*.svg` from `styles/app.css`). Fix any Critical/Important before finishing.

---

## Self-Review Notes (author verification)

- **Spec coverage:** vibrancy shell → Task 4; Tailwind offline build → Task 2; Lucide bundled
  → Task 2; dark theme/tokens → Task 2 (`tailwind.css`); accent → Tasks 1,3,4,5; native
  controls (switch/segmented/stepper) → Tasks 2,6,7; redesigned surfaces → Tasks 6,7,8; logo
  → Task 9; remove tokens.css → Task 3; testing/regression → Tasks 1,10.
- **Behavior parity:** all IDs read by JS are preserved. `<select id="mode">`→segmented (panel.js
  updated Task 6); `<select id="finalAction">`→segmented (settings.js updated Task 7);
  checkboxes kept as `<input type=checkbox id=...>` (BOOL_KEYS unchanged) but visually switches;
  steppers wrap the same number `<input id=...>` and dispatch `change` so NUM_KEYS listeners fire.
- **Consistency:** accent is a 6-hex string end-to-end (`normalizeAccent`→`setAccent`→`?accent=`
  →`accent-init` prepends `#`). `setAccent` exported (Task 4) and imported (Task 5). Icon mask
  URLs `../icons/<name>.svg` resolve relative to `src/renderer/styles/app.css`; the 5 names match
  `copy-icons.js` (Task 2). Segmented `data-value`s match the stored enum values
  (`auto/off/snooze`, `sleep/displayOff/pauseOnly`).
- **Build hygiene:** `app.css` git-ignored (Task 2) + built in `prestart`/`predist`; icons
  committed. `predist` updated to also build CSS.
- **No logic change:** core/services/state-machine/detector untouched → existing tests remain
  the regression guard; only `accent.js` adds tests.
```
