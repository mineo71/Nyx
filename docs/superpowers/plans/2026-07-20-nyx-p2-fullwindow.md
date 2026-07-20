# Nyx P2 — Full-Size Dashboard Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Add a main dashboard window + dock icon (keep the menu-bar popover). Additive, no behavior change.

**Architecture:** New `main-window` renderer (reuses app.css/components), a `createMainWindow`/`showMainWindow` in windows.js (close hides), `recentRecaps` in stores, and main.js wiring (dock visible, broadcast state to the window, serve recaps). Reuses the existing panel-state contract.

**Tech Stack:** Electron, Tailwind (built), vanilla JS, Vitest.

---

## Task 1: Stores + windows + preload

**Files:** Modify `src/services/stores.js`, `src/main/windows.js`, `src/renderer/preload.js`.

- [ ] **Step 1: `src/services/stores.js`** — add `recentRecaps` and export it.

Add before `module.exports`:
```js
function recentRecaps(limit = 10) {
  return recapStore.get('entries').slice(0, limit);
}
```
Change the exports line to:
```js
module.exports = { settings, addRecap, lastRecap, recentRecaps };
```

- [ ] **Step 2: `src/main/windows.js`** — add the main window. Insert before `module.exports`:
```js
let mainWin = null;
function showMainWindow() {
  if (mainWin && !mainWin.isDestroyed()) { mainWin.show(); mainWin.focus(); return mainWin; }
  mainWin = new BrowserWindow({
    width: 760, height: 560, minWidth: 620, minHeight: 460,
    transparent: true, vibrancy: 'under-window', visualEffectState: 'active',
    backgroundColor: '#00000000', titleBarStyle: 'hiddenInset', title: 'Nyx',
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  mainWin.loadFile(path.join(__dirname, '..', 'renderer', 'main-window.html'), { query: { accent: accentHex } });
  mainWin.on('close', (e) => { if (!appQuitting) { e.preventDefault(); mainWin.hide(); } });
  return mainWin;
}
function getMainWindow() { return (mainWin && !mainWin.isDestroyed()) ? mainWin : null; }
```
Add a quit flag near the top (after `let accentHex`):
```js
let appQuitting = false;
function markQuitting() { appQuitting = true; }
```
Update `module.exports` to add `showMainWindow, getMainWindow, markQuitting`.

- [ ] **Step 3: `src/renderer/preload.js`** — add to the `nyx` object:
```js
  getRecaps: () => ipcRenderer.invoke('nyx:get-recaps'),
  dashboardReady: () => ipcRenderer.send('nyx:dashboard-ready'),
```

- [ ] **Step 4:** `node --check src/main/windows.js src/renderer/preload.js`; `npx vitest run` (green).

- [ ] **Step 5: Commit**
```bash
git add src/services/stores.js src/main/windows.js src/renderer/preload.js
git commit -m "feat(main): main window scaffold + recents API + preload channels"
```

---

## Task 2: Dashboard renderer

**Files:** Create `src/renderer/main-window.html`, `src/renderer/main-window.js`.

- [ ] **Step 1: `src/renderer/main-window.html`**
```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="./styles/app.css" />
    <script src="./accent-init.js"></script>
  </head>
  <body class="min-h-screen p-8 flex flex-col gap-6">
    <div class="nyx-row">
      <div class="flex items-center gap-2 text-lg font-semibold"><span class="nyx-icon icon-moon" style="color:var(--accent)"></span> Nyx</div>
      <div class="flex items-center gap-2 text-sm nyx-muted"><span id="dot" class="nyx-dot"></span><span id="stateLabel">Idle</span></div>
    </div>

    <div class="nyx-card flex flex-col gap-4">
      <div>
        <h1 id="statusLine" class="text-[28px] font-medium">Idle</h1>
        <p id="statusSub" class="text-sm mt-1 nyx-muted">Waiting for something to play</p>
      </div>
      <div class="nyx-row">
        <span class="text-[13px] nyx-muted">Monitoring</span>
        <div class="nyx-seg" id="mode" data-value="auto">
          <button data-value="auto">Auto</button><button data-value="off">Off</button><button data-value="snooze">Snooze</button>
        </div>
      </div>
      <div class="flex gap-2">
        <button id="calibrate" class="nyx-btn"><span class="nyx-icon icon-calibrate"></span>Calibrate</button>
        <button id="settings" class="nyx-btn"><span class="nyx-icon icon-settings"></span>Settings</button>
      </div>
    </div>

    <div class="nyx-card flex flex-col gap-2">
      <div class="text-[12px] uppercase tracking-wide nyx-muted">Recent nights</div>
      <ul id="recaps" class="flex flex-col gap-2 text-sm"></ul>
    </div>

    <script src="./main-window.js"></script>
  </body>
</html>
```

- [ ] **Step 2: `src/renderer/main-window.js`**
```js
const dot = document.getElementById('dot');
const stateLabel = document.getElementById('stateLabel');
const statusLine = document.getElementById('statusLine');
const statusSub = document.getElementById('statusSub');
const modeSeg = document.getElementById('mode');
const recapsEl = document.getElementById('recaps');

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

function renderState(s) {
  const c = STATE_COPY[s.state] || STATE_COPY.IDLE;
  dot.style.background = c.dot;
  stateLabel.textContent = c.label;
  statusLine.textContent = c.line;
  statusSub.textContent = s.cameraOk === false ? 'Camera unavailable — auto-sleep off' : c.sub;
  statusSub.style.color = s.cameraOk === false ? '#E0A45C' : 'rgba(242,243,245,0.55)';
  if (s.monitoringMode) segSet(modeSeg, s.monitoringMode);
}

async function renderRecaps() {
  const list = await window.nyx.getRecaps();
  recapsEl.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'nyx-muted';
    li.textContent = 'No sleep events yet';
    recapsEl.appendChild(li);
    return;
  }
  for (const r of list) {
    const li = document.createElement('li');
    li.className = 'nyx-row';
    const when = new Date(r.timestamp);
    li.innerHTML = `<span>"${r.title}"</span><span class="nyx-muted">${when.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>`;
    recapsEl.appendChild(li);
  }
}

modeSeg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
  segSet(modeSeg, b.dataset.value);
  window.nyx.setMonitoringMode(b.dataset.value);
}));
document.getElementById('calibrate').addEventListener('click', () => window.nyx.openCalibration());
document.getElementById('settings').addEventListener('click', () => window.nyx.openSettings());

window.nyx.onPanelState((_e, s) => { renderState(s); renderRecaps(); });
segSet(modeSeg, 'auto');
renderRecaps();
window.nyx.dashboardReady();
```

- [ ] **Step 3:** `npm run build:css && node --check src/renderer/main-window.js`.

- [ ] **Step 4: Commit**
```bash
git add src/renderer/main-window.html src/renderer/main-window.js
git commit -m "feat(renderer): dashboard window UI"
```

---

## Task 3: Wire main process + dock

**Files:** Modify `src/main/main.js`, `package.json`.

- [ ] **Step 1:** Imports — add `recentRecaps` to the stores import; add `showMainWindow`, `markQuitting` to the windows import.
Change:
```js
const { settings, addRecap, lastRecap } = require('../services/stores.js');
```
to:
```js
const { settings, addRecap, lastRecap, recentRecaps } = require('../services/stores.js');
```
Add `showMainWindow, markQuitting` to the existing `require('./windows.js')` destructure.

- [ ] **Step 2:** Show the dock. Replace:
```js
if (app.dock) app.dock.hide();
```
with:
```js
if (app.dock) app.dock.show();
```

- [ ] **Step 3:** Broadcast state to the main window too. Replace the `pushPanelState` function with:
```js
function pushPanelState() {
  const state = { state: machine ? machine.state : 'IDLE', recap: lastRecap(), cameraOk, monitoringMode };
  for (const w of [panelWin, getMainWindowRef()]) {
    if (w && !w.isDestroyed()) w.webContents.send('nyx:panel-state', state);
  }
}
```
Add `getMainWindow` to the windows import (alias it locally as `getMainWindowRef`), i.e. include `getMainWindow: getMainWindowRef` in the destructure OR import `getMainWindow` and use it directly — use directly:
```js
  for (const w of [panelWin, getMainWindow()]) {
```
and add `getMainWindow` to the windows import destructure. (Pick this simpler form; ignore the alias note.)

- [ ] **Step 4:** Create + show the main window on launch. Inside `app.whenReady().then(() => {`, after `panelWin = createPanelWindow();` add:
```js
  showMainWindow();
```

- [ ] **Step 5:** Handle activate + recaps + dashboard-ready. Add these near the other `ipcMain` handlers inside whenReady:
```js
  ipcMain.handle('nyx:get-recaps', () => recentRecaps(10));
  ipcMain.on('nyx:dashboard-ready', () => pushPanelState());
```
And after the `whenReady().then(...)` block (top level, with the other `app.on(...)`), add:
```js
app.on('activate', () => showMainWindow());
app.on('before-quit', () => markQuitting());
```
(Keep the existing `app.on('window-all-closed', ...)`.)

- [ ] **Step 6:** Ensure quit still works — the panel Quit calls `app.quit()`; `before-quit` sets the quit flag so the main window's close handler stops hiding and lets the app exit. Verify `onQuit`/`nyx:quit` path calls `app.quit()` (unchanged).

- [ ] **Step 7:** `package.json` — remove `LSUIElement` so the packaged app shows a dock icon. In the `build.mac.extendInfo` object, delete the `"LSUIElement": true` entry (leave `extendInfo` as `{}` if now empty, or remove the empty `extendInfo` key).

- [ ] **Step 8:** `node --check src/main/main.js`; validate JSON `node -e "require('./package.json')"`; `npx vitest run` (green).

- [ ] **Step 9: Commit**
```bash
git add src/main/main.js package.json
git commit -m "feat(main): dashboard window lifecycle + dock icon"
```

---

## Task 4: Runbook + review

- [ ] **Step 1:** Append to `docs/RUNBOOK.md`:
```markdown
## P2 full-size app

- `npm start` opens a **main dashboard window** (dock icon present) + the menu-bar popover.
- Dashboard shows live state, Monitoring control, Calibrate/Settings, and a Recent-nights list.
- Closing the window keeps Nyx running in the menu bar; click the dock icon to reopen.
- Quit from the popover ⏻ fully exits.
```

- [ ] **Step 2: Commit** the runbook.

- [ ] **Step 3:** Dispatch a reviewer over `main..HEAD`: main-window IPC parity (onPanelState/getRecaps/dashboardReady/setMonitoringMode), pushPanelState broadcasts to both windows without crashing on destroyed/absent, close-hides + before-quit lets quit through (no zombie), dock shows, `recentRecaps` correct, no regressions (72 tests green). Fix Critical/Important.

## Self-Review Notes
- IPC: main-window reuses `onPanelState` + `setMonitoringMode`/`openSettings`/`openCalibration`; new `getRecaps`/`dashboard-ready` added to preload (Task 1) and handled in main (Task 3).
- Lifecycle: close→hide (keeps app alive) but `before-quit`→`markQuitting` lets a real quit destroy it; `activate`/dock reopens.
- State broadcast guards destroyed/null windows. Dock visible in dev (`app.dock.show`) and packaged (LSUIElement removed).
