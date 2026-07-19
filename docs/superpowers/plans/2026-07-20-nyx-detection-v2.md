# Nyx Detection v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Nyx's single-frame eye-threshold with a robust, windowed drowsiness detector (hysteresis + PERCLOS + head-nod), denser sampling, and numbers-only detection logging for later tuning.

**Architecture:** A pure `DrowsinessDetector` sits between the camera frames and the (unchanged) state machine: `main.js` computes head pitch from the MediaPipe transform matrix, feeds `{left,right,pitch}` into the detector, and passes the detector's debounced `open/closed/unknown` to `machine.frame(...)`. All decision logic is pure and unit-tested with synthetic sample streams; the state machine's sustained-closure→escalate logic remains the final gate.

**Tech Stack:** Electron, vanilla Node CommonJS, Vitest, MediaPipe FaceLandmarker (transform matrices).

---

## Design constants (used across tasks — keep consistent)

- Drowsiness params: `windowMs: 12000`, `enterFrac: 0.6`, `exitFrac: 0.4`, `headDownDeg: -12`.
- Cadence: `intervals.baselineMs: 4000`, `intervals.confirmMs: 1500`.
- `logDetection: true` (default).
- Log path: `<app userData>/detection-log.jsonl`, cap `5 * 1024 * 1024` bytes.
- Detector sample shape from renderer: `{ left, right, matrix }` (`matrix` = 16-float array or `null`).
- Detector input shape (main → DrowsinessDetector): `{ left, right, pitch }` or `null`.
- `pitchFromMatrix` convention: column-major 4×4, `pitch_deg = atan2(m[6], m[10]) * 180/π`.

## File Structure

```
src/core/head-pose.js               NEW  pure pitchFromMatrix
src/core/drowsiness-detector.js     NEW  pure DrowsinessDetector
src/core/settings-schema.js         MOD  add logDetection
src/core/config.js                  MOD  cadence + drowsiness params + logDetection
src/services/detection-log.js       NEW  numbers-only JSONL append + truncateTail
src/renderer/detector.js            MOD  emit face transform matrix
src/renderer/preload.js             MOD  add revealLog
src/renderer/settings.html/.js      MOD  logDetection toggle + Reveal log button
src/main/main.js                    MOD  wire detector + pitch + logging + reveal-log
tests/core/head-pose.test.js        NEW
tests/core/drowsiness-detector.test.js  NEW
tests/core/settings-schema.test.js  MOD  logDetection
tests/services/detection-log.test.js    NEW  truncateTail
```

---

## Phase A — Pure core (TDD)

### Task 1: Head-pose pitch extraction

**Files:** Create `src/core/head-pose.js`, Test `tests/core/head-pose.test.js`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { pitchFromMatrix } from '../../src/core/head-pose.js';

// Build a column-major 4x4 rotation-about-X matrix for angle deg.
function rotX(deg) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  // rows: [1,0,0,0],[0,c,-s,0],[0,s,c,0],[0,0,0,1] -> column-major
  return [
    1, 0, 0, 0,      // col 0 (rows 0..3)
    0, c, s, 0,      // col 1
    0, -s, c, 0,     // col 2
    0, 0, 0, 1,      // col 3
  ];
}

describe('pitchFromMatrix', () => {
  it('returns 0 for identity', () => {
    expect(pitchFromMatrix(rotX(0))).toBeCloseTo(0, 4);
  });
  it('extracts a positive X rotation', () => {
    expect(pitchFromMatrix(rotX(20))).toBeCloseTo(20, 3);
  });
  it('extracts a negative X rotation', () => {
    expect(pitchFromMatrix(rotX(-15))).toBeCloseTo(-15, 3);
  });
  it('returns null for missing or wrong-length input', () => {
    expect(pitchFromMatrix(null)).toBe(null);
    expect(pitchFromMatrix([1, 2, 3])).toBe(null);
    expect(pitchFromMatrix('nope')).toBe(null);
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/core/head-pose.test.js`

- [ ] **Step 3: Implement `src/core/head-pose.js`**

```js
// Pitch (rotation about X) in degrees from a MediaPipe facial transformation matrix.
// Matrix is a column-major 4x4 flat array: element(row, col) = matrix[col*4 + row].
function pitchFromMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 16) return null;
  // For Rx(θ): element(2,1)=sinθ -> m[1*4+2]=m[6]; element(2,2)=cosθ -> m[2*4+2]=m[10].
  const sin = matrix[6];
  const cos = matrix[10];
  return Math.atan2(sin, cos) * (180 / Math.PI);
}

module.exports = { pitchFromMatrix };
```

- [ ] **Step 4: Run, verify PASS (4 tests)** then full suite `npx vitest run`.

- [ ] **Step 5: Commit**

```bash
git add src/core/head-pose.js tests/core/head-pose.test.js
git commit -m "feat(core): head pitch from face transform matrix"
```

---

### Task 2: DrowsinessDetector

**Files:** Create `src/core/drowsiness-detector.js`, Test `tests/core/drowsiness-detector.test.js`.

Pure, stateful. Time is injected via `nowMs` to `update`. `getThreshold()` returns the live
eye-close threshold.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { DrowsinessDetector } from '../../src/core/drowsiness-detector.js';

const PARAMS = { windowMs: 12000, enterFrac: 0.6, exitFrac: 0.4, headDownDeg: -12 };
function make() {
  return new DrowsinessDetector({ getThreshold: () => 0.5, params: PARAMS });
}
const OPEN = { left: 0.1, right: 0.1 };
const CLOSED = { left: 0.9, right: 0.9 };
const CLOSED_DOWN = { left: 0.9, right: 0.9, pitch: -20 };

describe('DrowsinessDetector', () => {
  it('starts open and returns unknown with no face samples', () => {
    const d = make();
    d.update(null, 0);
    expect(d.classify()).toBe('unknown');
  });

  it('does not flip to closed on an isolated blink', () => {
    const d = make();
    d.update(OPEN, 0); d.update(CLOSED, 4000); d.update(OPEN, 8000);
    expect(d.classify()).toBe('open'); // closedFrac 1/3 < enterFrac
  });

  it('flips to closed on sustained closure', () => {
    const d = make();
    d.update(CLOSED, 0); d.update(CLOSED, 4000); d.update(CLOSED, 8000);
    expect(d.classify()).toBe('closed'); // closedFrac 1.0 >= enterFrac
  });

  it('does not reset on a single stray open during closure', () => {
    const d = make();
    d.update(CLOSED, 0); d.update(CLOSED, 4000); d.update(CLOSED, 8000);
    expect(d.classify()).toBe('closed');
    d.update(OPEN, 10000); // window closed,closed,open -> frac 2/3 >= exitFrac
    expect(d.classify()).toBe('closed');
  });

  it('wakes to open on sustained open', () => {
    const d = make();
    d.update(CLOSED, 0); d.update(CLOSED, 2000); d.update(CLOSED, 4000);
    expect(d.classify()).toBe('closed');
    d.update(OPEN, 6000); d.update(OPEN, 8000); d.update(OPEN, 10000);
    expect(d.classify()).toBe('open'); // closedFrac 0 < exitFrac
  });

  it('preserves state and returns unknown when the window has no known samples', () => {
    const d = make();
    d.update(CLOSED, 0); d.update(CLOSED, 4000); d.update(CLOSED, 8000);
    expect(d.classify()).toBe('closed');
    d.update(null, 20000); // old closed entries drop out (>windowMs); only unknown remains
    expect(d.classify()).toBe('unknown');
  });

  it('head-nod fast path forces closed even when eye majority says open', () => {
    const d = make();
    d.update(OPEN, 0); d.update(OPEN, 1000); d.update(OPEN, 2000);
    d.update(CLOSED_DOWN, 3000); d.update(CLOSED_DOWN, 4000);
    // known: 3 open + 2 closed -> frac 2/5 = 0.4 < enterFrac 0.6, but last 2 are closed+headDown
    expect(d.classify()).toBe('closed');
  });

  it('drops entries older than the time window', () => {
    const d = make();
    d.update(CLOSED, 0);
    d.update(OPEN, 20000); // 20s later, the closed entry is outside windowMs
    expect(d.classify()).toBe('open');
  });

  it('reset clears state', () => {
    const d = make();
    d.update(CLOSED, 0); d.update(CLOSED, 4000); d.update(CLOSED, 8000);
    expect(d.classify()).toBe('closed');
    d.reset();
    expect(d.classify()).toBe('unknown');
  });

  it('exposes perclos and metrics', () => {
    const d = make();
    d.update(OPEN, 0); d.update(CLOSED, 4000);
    expect(d.perclos()).toBeCloseTo(0.5, 5);
    const m = d.metrics();
    expect(m.closedFrac).toBeCloseTo(0.5, 5);
    expect(m.known).toBe(2);
    expect(m.avg).toBeCloseTo(0.9, 5); // last sample
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/core/drowsiness-detector.test.js`

- [ ] **Step 3: Implement `src/core/drowsiness-detector.js`**

```js
// Windowed, hysteretic awake/asleep classifier. Pure and stateful; time is injected via
// the nowMs argument to update(). Consumes {left,right,pitch} samples (or null) and emits a
// debounced 'open' | 'closed' | 'unknown' that the state machine consumes unchanged.
class DrowsinessDetector {
  constructor({ getThreshold, params }) {
    this.getThreshold = getThreshold;
    this.p = params; // { windowMs, enterFrac, exitFrac, headDownDeg }
    this._entries = [];      // { t, known, closed, headDown }
    this._state = 'open';
    this._lastAvg = null;
    this._lastPitch = null;
  }

  update(sample, nowMs) {
    if (!sample || typeof sample.left !== 'number' || typeof sample.right !== 'number') {
      this._entries.push({ t: nowMs, known: false, closed: false, headDown: false });
      this._lastAvg = null;
      this._lastPitch = null;
    } else {
      const avg = (sample.left + sample.right) / 2;
      const closed = avg >= this.getThreshold();
      const headDown = typeof sample.pitch === 'number' && sample.pitch <= this.p.headDownDeg;
      this._entries.push({ t: nowMs, known: true, closed, headDown });
      this._lastAvg = avg;
      this._lastPitch = typeof sample.pitch === 'number' ? sample.pitch : null;
    }
    const cutoff = nowMs - this.p.windowMs;
    this._entries = this._entries.filter((e) => e.t >= cutoff);
  }

  classify() {
    const known = this._entries.filter((e) => e.known);
    if (known.length === 0) return 'unknown';

    const last2 = known.slice(-2);
    if (last2.length === 2 && last2.every((e) => e.closed && e.headDown)) {
      this._state = 'closed';
      return 'closed';
    }

    const closedFrac = known.filter((e) => e.closed).length / known.length;
    if (this._state === 'closed') {
      if (closedFrac < this.p.exitFrac) this._state = 'open';
    } else if (closedFrac >= this.p.enterFrac) {
      this._state = 'closed';
    }
    return this._state;
  }

  perclos() {
    const known = this._entries.filter((e) => e.known);
    if (known.length === 0) return 0;
    return known.filter((e) => e.closed).length / known.length;
  }

  metrics() {
    return {
      avg: this._lastAvg,
      pitch: this._lastPitch,
      closedFrac: this.perclos(),
      known: this._entries.filter((e) => e.known).length,
    };
  }

  reset() {
    this._entries = [];
    this._state = 'open';
    this._lastAvg = null;
    this._lastPitch = null;
  }
}

module.exports = { DrowsinessDetector };
```

- [ ] **Step 4: Run, verify PASS (10 tests)** then full suite.

- [ ] **Step 5: Commit**

```bash
git add src/core/drowsiness-detector.js tests/core/drowsiness-detector.test.js
git commit -m "feat(core): windowed drowsiness detector with hysteresis and head-nod"
```

---

### Task 3: Add `logDetection` to the settings schema

**Files:** Modify `src/core/settings-schema.js`, `tests/core/settings-schema.test.js`.

- [ ] **Step 1: Update the test** — in `tests/core/settings-schema.test.js`:

Change the `'passes through valid values unchanged'` test's `v` object to include `logDetection`:

```js
    const v = { tAsleepSec: 90, nudgeWaitSec: 30, pauseWaitSec: 45, finalAction: 'sleep',
      nightHoursEnabled: true, nightHoursStart: 21, nightHoursEnd: 7, openAtLogin: false,
      logDetection: true };
```

Add a new test inside the `describe('clampSettingsView', ...)` block:

```js
  it('defaults logDetection to true and coerces it to boolean', () => {
    expect(clampSettingsView({}).logDetection).toBe(true);
    expect(clampSettingsView({ logDetection: 0 }).logDetection).toBe(false);
    expect(clampSettingsView({ logDetection: 1 }).logDetection).toBe(true);
  });
```

- [ ] **Step 2: Run, verify the `passes through` test now FAILS** (returned object lacks `logDetection`) — `npx vitest run tests/core/settings-schema.test.js`

- [ ] **Step 3: Update `src/core/settings-schema.js`**

Add `logDetection: true` to `DEFAULT_VIEW` (after `openAtLogin`):

```js
  openAtLogin: false,
  logDetection: true,
```

Add to the object returned by `clampSettingsView` (after the `openAtLogin` line):

```js
    openAtLogin: Boolean(v.openAtLogin),
    logDetection: Boolean(v.logDetection),
```

- [ ] **Step 4: Run, verify PASS** then full suite.

- [ ] **Step 5: Commit**

```bash
git add src/core/settings-schema.js tests/core/settings-schema.test.js
git commit -m "feat(core): logDetection setting"
```

---

## Phase B — Config + logging service

### Task 4: Config cadence + drowsiness params + logDetection

**Files:** Modify `src/core/config.js`.

- [ ] **Step 1: Update `DEFAULTS` in `src/core/config.js`**

Change the `intervals` line:

```js
  intervals: { baselineMs: 4000, confirmMs: 1500 },
```

Add these two keys to `DEFAULTS` (place after `eyeCloseThreshold`):

```js
  drowsiness: { windowMs: 12000, enterFrac: 0.6, exitFrac: 0.4, headDownDeg: -12 },
  logDetection: true,
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `npx vitest run tests/core/config.test.js`
Expected: PASS. (The config test only asserts `tAsleepMs`, `intervals.baselineMs/confirmMs`, `finalAction`, `ladder`, `nightHours.enabled`. The `baselineMs`/`confirmMs` assertions will now FAIL because they expect 60000/2000.)

- [ ] **Step 3: Update the config test's interval expectations**

In `tests/core/config.test.js`, change:

```js
    expect(DEFAULTS.intervals.baselineMs).toBe(4000);
    expect(DEFAULTS.intervals.confirmMs).toBe(1500);
```

- [ ] **Step 4: Run, verify PASS** then full suite.

- [ ] **Step 5: Commit**

```bash
git add src/core/config.js tests/core/config.test.js
git commit -m "feat(core): denser cadence + drowsiness params + logDetection default"
```

---

### Task 5: Detection log service

**Files:** Create `src/services/detection-log.js`, Test `tests/services/detection-log.test.js`.

The pure `truncateTail` helper is unit-tested; the file I/O wrapper is thin (manual/runbook).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { truncateTail } from '../../src/services/detection-log.js';

describe('truncateTail', () => {
  it('returns text unchanged when under the byte cap', () => {
    const t = 'a\nb\nc\n';
    expect(truncateTail(t, 1000)).toBe(t);
  });

  it('trims to a tail starting after a newline when over the cap', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line${i}`).join('\n') + '\n';
    const out = truncateTail(lines, 200);
    expect(Buffer.byteLength(out)).toBeLessThan(Buffer.byteLength(lines));
    expect(out.startsWith('line')).toBe(true); // begins at a clean line boundary
    expect(lines.endsWith(out)).toBe(true);    // it's a suffix of the original
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/services/detection-log.test.js`

- [ ] **Step 3: Implement `src/services/detection-log.js`**

```js
const fs = require('node:fs');

// Pure: if text exceeds maxBytes, return the second half starting at the next line boundary.
function truncateTail(text, maxBytes) {
  if (Buffer.byteLength(text) <= maxBytes) return text;
  const half = text.slice(Math.floor(text.length / 2));
  const nl = half.indexOf('\n');
  return nl >= 0 ? half.slice(nl + 1) : half;
}

// Numbers-only append-only JSONL log, size-capped. All writes are best-effort.
class DetectionLog {
  constructor({ filePath, maxBytes = 5 * 1024 * 1024 }) {
    this.filePath = filePath;
    this.maxBytes = maxBytes;
  }

  append(record) {
    try {
      let size = 0;
      try { size = fs.statSync(this.filePath).size; } catch { size = 0; }
      if (size > this.maxBytes) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        fs.writeFileSync(this.filePath, truncateTail(data, this.maxBytes));
      }
      fs.appendFileSync(this.filePath, JSON.stringify(record) + '\n');
    } catch (e) {
      console.error('[nyx] detection-log write failed:', e.message);
    }
  }
}

module.exports = { DetectionLog, truncateTail };
```

- [ ] **Step 4: Run, verify PASS (2 tests)** then full suite.

- [ ] **Step 5: Commit**

```bash
git add src/services/detection-log.js tests/services/detection-log.test.js
git commit -m "feat(services): numbers-only detection log with size cap"
```

---

## Phase C — Renderer

### Task 6: Emit the face transform matrix from the detector

**Files:** Modify `src/renderer/detector.js`.

- [ ] **Step 1: Enable transform matrices in `createFromOptions`**

In `src/renderer/detector.js`, add `outputFacialTransformationMatrixes: true` to the options object passed to `FaceLandmarker.createFromOptions` (alongside `outputFaceBlendshapes: true`):

```js
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: 'IMAGE',
      numFaces: 1,
```

- [ ] **Step 2: Include the matrix in the returned sample**

In `captureSample()`, after computing `left` and `right` and before returning, read the matrix and include it. Replace the final `return { left, right };` with:

```js
  const mtx = result.facialTransformationMatrixes && result.facialTransformationMatrixes[0];
  const matrix = mtx && mtx.data ? Array.from(mtx.data) : null;
  return { left, right, matrix };
```

(Everything else in `captureSample` — the no-face `return null` and the `left/right == null` guard — stays; those paths still return `null`, which is correct.)

- [ ] **Step 3: `node --check src/renderer/detector.js`** — must pass.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/detector.js
git commit -m "feat(renderer): emit face transform matrix for head pitch"
```

---

## Phase D — Wiring

### Task 7: Settings toggle + Reveal log

**Files:** Modify `src/renderer/preload.js`, `src/renderer/settings.html`, `src/renderer/settings.js`.

- [ ] **Step 1: Add `revealLog` to `src/renderer/preload.js`**

Inside the `nyx` object (e.g. after `setSetting`), add:

```js
  revealLog: () => ipcRenderer.send('nyx:reveal-log'),
```

- [ ] **Step 2: Add the toggle + button to `src/renderer/settings.html`**

Replace the `General` section with:

```html
    <section>
      <h3>General</h3>
      <div class="field"><label><input id="openAtLogin" type="checkbox" /> Launch at login</label><span></span></div>
      <div class="field"><label><input id="logDetection" type="checkbox" /> Log detection data (numbers only)</label><button id="revealLog">Reveal log</button></div>
    </section>
```

- [ ] **Step 3: Wire them in `src/renderer/settings.js`**

Change the `BOOL_KEYS` line to include `logDetection`:

```js
const BOOL_KEYS = ['nightHoursEnabled', 'openAtLogin', 'logDetection'];
```

Add a reveal-log listener at the end of `init()` (after the `recalibrate` listener):

```js
  document.getElementById('revealLog').addEventListener('click', () => window.nyx.revealLog());
```

- [ ] **Step 4: `node --check src/renderer/preload.js src/renderer/settings.js`** — must pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/preload.js src/renderer/settings.html src/renderer/settings.js
git commit -m "feat(renderer): logDetection toggle and reveal-log button"
```

---

### Task 8: Wire the detector, pitch, and logging into `main.js`

**Files:** Modify `src/main/main.js`.

- [ ] **Step 1: Update imports**

Change the electron require and add new imports. Replace:

```js
const { app, ipcMain, powerMonitor, session } = require('electron');
```
with:
```js
const { app, ipcMain, powerMonitor, session, shell } = require('electron');
const path = require('node:path');
```

Replace:
```js
const { classifyEyes, computeThreshold } = require('../core/detector-logic.js');
```
with:
```js
const { computeThreshold } = require('../core/detector-logic.js');
const { DrowsinessDetector } = require('../core/drowsiness-detector.js');
const { pitchFromMatrix } = require('../core/head-pose.js');
const { DetectionLog } = require('../services/detection-log.js');
```

- [ ] **Step 2: Declare the new module-scope variables**

Change:
```js
let machine, engine, tray, popover, panelWin, detectorWin, scheduler, mediaWatcher, idleMonitor, tickTimer;
```
to:
```js
let machine, engine, tray, popover, panelWin, detectorWin, scheduler, mediaWatcher, idleMonitor, tickTimer;
let drowsiness, detectionLog;
```

- [ ] **Step 3: Reset the detector on arm**

Change:
```js
function startArmed() { osActions.startCaffeinate(); scheduler.start(); pushPanelState(); tray.refresh(); }
```
to:
```js
function startArmed() { if (drowsiness) drowsiness.reset(); osActions.startCaffeinate(); scheduler.start(); pushPanelState(); tray.refresh(); }
```

- [ ] **Step 4: Add `logDetection` to the settings view round-trip**

In `readSettingsView()`, add to the object passed to `clampAndDecorate`:
```js
    openAtLogin: app.getLoginItemSettings().openAtLogin,
    logDetection: settings.get('logDetection', DEFAULTS.logDetection),
```

In `applySettingsView()`, add after the `app.setLoginItemSettings(...)` line:
```js
  settings.set('logDetection', v.logDetection);
```

- [ ] **Step 5: Instantiate the detector and log inside `app.whenReady()`**

Immediately after `detectorWin = createDetectorWindow();` add:
```js
  drowsiness = new DrowsinessDetector({
    getThreshold: currentThreshold,
    params: settings.get('drowsiness', DEFAULTS.drowsiness),
  });
  detectionLog = new DetectionLog({ filePath: path.join(app.getPath('userData'), 'detection-log.jsonl') });
```

- [ ] **Step 6: Route frames through the detector + log**

Replace the frame handler:
```js
  ipcMain.on('nyx:frame', (_e, sample) => {
    machine.frame(classifyEyes(sample, currentThreshold()));
    if (calibrationOpen) forwardCalibrationScore(sample);
  });
```
with:
```js
  ipcMain.on('nyx:frame', (_e, sample) => {
    const now = Date.now();
    const pitch = sample && sample.matrix ? pitchFromMatrix(sample.matrix) : null;
    const input = sample ? { left: sample.left, right: sample.right, pitch } : null;
    drowsiness.update(input, now);
    const cls = drowsiness.classify();
    machine.frame(cls);
    if (settings.get('logDetection', DEFAULTS.logDetection) && machine.state !== 'IDLE') {
      const m = drowsiness.metrics();
      detectionLog.append({ t: now, l: sample ? sample.left : null, r: sample ? sample.right : null,
        avg: m.avg, pitch: m.pitch, closedFrac: m.closedFrac, cls, state: machine.state });
    }
    if (calibrationOpen) forwardCalibrationScore(sample);
  });
```

- [ ] **Step 7: Add the reveal-log IPC handler**

After the `ipcMain.on('nyx:quit', ...)` line, add:
```js
  ipcMain.on('nyx:reveal-log', () => shell.showItemInFolder(detectionLog.filePath));
```

- [ ] **Step 8: Verify**

Run `node --check src/main/main.js` — must pass.
Run `npx vitest run` — all green (no unit test imports main.js; total unchanged from the new-file tasks).

- [ ] **Step 9: Commit**

```bash
git add src/main/main.js
git commit -m "feat(main): route frames through drowsiness detector, pitch, and logging"
```

---

## Phase E — Docs + review

### Task 9: RUNBOOK + final review

**Files:** Modify `docs/RUNBOOK.md`.

- [ ] **Step 1: Append a "Detection v2" section to `docs/RUNBOOK.md`**

```markdown
## Detection v2

- Camera now samples ~every 4s while WATCHING (was 60s), ~1.5s when checking.
- Robust closed/open: blinks and single noisy frames no longer flip the state; sustained
  closure does; opening your eyes for a few seconds cancels. Verify: blink normally while
  watching → stays WATCHING; hold eyes shut → goes DROWSY then escalates.
- Head-nod: let your head drop while closing your eyes → should reach the nudge faster than
  eyes-closed-upright. If it never helps, the pitch sign may be inverted — check the log's
  `pitch` values (see below) and flip `headDownDeg` sign in `src/core/config.js`.
- Logging (default ON): a numbers-only JSONL grows at
  `~/Library/Application Support/Nyx/detection-log.jsonl` (Settings → Reveal log). Confirm it
  contains lines like `{"t":...,"l":..,"r":..,"avg":..,"pitch":..,"closedFrac":..,"cls":"..","state":".."}`
  and NO images. Toggle it off in Settings → the file stops growing.
- Tuning: after a night, inspect the log — if it false-alarms, raise `enterFrac` or `tAsleep`;
  if it misses, lower them. Threshold comes from calibration.
```

- [ ] **Step 2: Commit**

```bash
git add docs/RUNBOOK.md
git commit -m "docs: detection v2 runbook + tuning notes"
```

- [ ] **Step 3: Final review (controller dispatches a reviewer)**

Dispatch a reviewer over `main..HEAD` for: the frame→detector→machine data flow, sample-shape
consistency (`{left,right,matrix}` renderer → `{left,right,pitch}` detector), `logDetection`
gating (only while armed + enabled), detector `reset()` on arm, settings round-trip including
`logDetection`, and that `classifyEyes` is no longer referenced anywhere in main.js. Fix any
Critical/Important findings before finishing.

---

## Self-Review Notes (author verification)

- **Spec coverage:** windowed hysteresis + PERCLOS → Task 2; head-nod + pitch → Tasks 1,2,6,8;
  cadence → Task 4; numbers-only logging default-ON + cap → Tasks 4,5,8; Settings toggle +
  reveal → Tasks 3,7,8; state machine unchanged (only its input source changes) → Task 8;
  error handling (null/partial → unknown, missing matrix → pitch null, log failure caught) →
  Tasks 2,5,8.
- **Type/shape consistency:** renderer emits `{left,right,matrix}` (Task 6); main converts to
  `{left,right,pitch}` via `pitchFromMatrix` (Task 8) and feeds `DrowsinessDetector.update`
  (Task 2). `metrics()` fields `{avg,pitch,closedFrac,known}` match the log record built in
  Task 8. `params` shape `{windowMs,enterFrac,exitFrac,headDownDeg}` identical in config
  (Task 4), detector (Task 2), and tests. `DEFAULTS.drowsiness`/`logDetection` (Task 4) match
  reads in Task 8. `pitchFromMatrix` convention (`m[6]`,`m[10]`) matches the test's `rotX`
  builder (Task 1).
- **Removed reference:** `classifyEyes` import dropped in Task 8 Step 1; it is no longer called
  (the detector does its own `avg >= threshold`). `computeThreshold` is still imported/used by
  calibration.
- **Test-fallout handled:** Task 3 updates the settings-schema `passes through` test; Task 4
  updates the config interval assertions. capture-scheduler tests hardcode their own intervals,
  so the config change does not affect them.
- **Deferred:** owner-only/multi-person and model training remain out of scope (future specs).
```
