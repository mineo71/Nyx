# Nyx P1 — Detection Fix + Calibration Polish Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Fix media detection (browsers use `NoDisplaySleepAssertion`) and polish calibration (cap captures + sounds).

**Architecture:** Rewrite the pure `playingApp` parser (assertion-type broadening + system denylist), TDD. Calibration renderer gets a capture cap + tick/chime sounds. No other changes.

**Tech Stack:** Node CommonJS, Vitest, Electron renderer.

---

## Task 1: Fix media detection (TDD)

**Files:** Modify `src/services/media-watcher.js`, `tests/services/media-watcher.test.js`.

- [ ] **Step 1: Replace the test file `tests/services/media-watcher.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { playingApp } from '../../src/services/media-watcher.js';

describe('playingApp', () => {
  it('detects a browser video wake lock (NoDisplaySleepAssertion)', () => {
    const text = 'pid 1800(Arc): [0x0002006500058ec3] 00:02:06 NoDisplaySleepAssertion named: "Video Wake Lock"';
    expect(playingApp(text)).toBe('Arc');
  });

  it('detects a player holding PreventUserIdleDisplaySleep', () => {
    const text = 'pid 700(QuickTime Player): [0x0] 00:01:00 PreventUserIdleDisplaySleep named: "playing"';
    expect(playingApp(text)).toBe('QuickTime Player');
  });

  it('ignores system daemons that hold sleep assertions', () => {
    const text = [
      'pid 107(powerd): [0x] 09:59:31 PreventUserIdleSystemSleep named: "Powerd"',
      'pid 178(coreaudiod): [0x] 00:02:06 PreventUserIdleSystemSleep named: "output.context.preventuseridlesleep"',
      'pid 44336(caffeinate): [0x] 00:01:36 PreventUserIdleSystemSleep named: "caffeinate command-line tool"',
    ].join('\n');
    expect(playingApp(text)).toBe(null);
  });

  it('returns null when nothing is asserting display wake', () => {
    expect(playingApp('   PreventUserIdleDisplaySleep    1')).toBe(null);
    expect(playingApp('')).toBe(null);
  });

  it('picks the first non-system media owner', () => {
    const text = [
      'pid 107(powerd): [0x] PreventUserIdleSystemSleep named: "Powerd"',
      'pid 1800(Google Chrome): [0x] NoDisplaySleepAssertion named: "Video Wake Lock"',
    ].join('\n');
    expect(playingApp(text)).toBe('Google Chrome');
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/services/media-watcher.test.js`
(The old whitelist logic will fail the new NoDisplaySleepAssertion + denylist cases.)

- [ ] **Step 3: Replace `playingApp` and drop `MEDIA_HINTS` in `src/services/media-watcher.js`**

Replace the `MEDIA_HINTS` const and the whole `playingApp` function with:

```js
// Assertion types that mean "something is actively keeping the display awake" (i.e. playing).
const WAKE_ASSERTIONS = /(PreventUserIdleDisplaySleep|NoDisplaySleepAssertion)/;
// System daemons that hold sleep assertions but are NOT media.
const SYSTEM_OWNERS = ['powerd', 'coreaudiod', 'caffeinate', 'windowserver', 'loginwindow', 'controlcenter', 'sharingd', 'nyx', 'electron'];

// Returns the owning app of a display-wake assertion (media playing), or null.
function playingApp(assertionsText) {
  for (const line of assertionsText.split('\n')) {
    if (!WAKE_ASSERTIONS.test(line)) continue;
    const m = line.match(/pid\s+\d+\(([^)]+)\)/);
    if (!m) continue;
    const owner = m[1].trim();
    if (SYSTEM_OWNERS.includes(owner.toLowerCase())) continue;
    return owner;
  }
  return null;
}
```

(The `MediaWatcher` class, `readAssertions`, events, and `titleForApp` usage are unchanged.)

- [ ] **Step 4: Run, verify PASS (5 tests)** then full suite `npx vitest run` (all green).

- [ ] **Step 5: Commit**

```bash
git add src/services/media-watcher.js tests/services/media-watcher.test.js
git commit -m "fix(services): detect browser NoDisplaySleepAssertion; denylist system daemons"
```

---

## Task 2: Calibration cap + sounds

**Files:** Create `src/resources/tick.wav` (generated); Modify `src/renderer/calibration.js`.

- [ ] **Step 1: Generate a short tick sound**

Run this exact command (writes a ~40ms soft click WAV):

```bash
node -e '
const fs=require("fs");const rate=44100,dur=0.04,n=Math.floor(rate*dur);const d=Buffer.alloc(n*2);
for(let i=0;i<n;i++){const t=i/rate;const env=Math.exp(-60*t);const s=Math.sin(2*Math.PI*1200*t)*env*0.25;d.writeInt16LE(Math.max(-1,Math.min(1,s))*32767|0,i*2);}
const u32=v=>{const b=Buffer.alloc(4);b.writeUInt32LE(v);return b;};const u16=v=>{const b=Buffer.alloc(2);b.writeUInt16LE(v);return b;};
const fmt=Buffer.concat([u16(1),u16(1),u32(rate),u32(rate*2),u16(2),u16(16)]);
const out=Buffer.concat([Buffer.from("RIFF"),u32(36+d.length),Buffer.from("WAVE"),Buffer.from("fmt "),u32(16),fmt,Buffer.from("data"),u32(d.length),d]);
fs.writeFileSync("src/resources/tick.wav",out);console.log("wrote tick.wav",out.length);'
```
Expected: `wrote tick.wav ...`; `ls -la src/resources/tick.wav` exists.

- [ ] **Step 2: Replace `src/renderer/calibration.js`**

```js
const instruction = document.getElementById('instruction');
const status = document.getElementById('status');
const scoreEl = document.getElementById('score');
const dotsEl = document.getElementById('dots');
const preview = document.getElementById('preview');
const captureBtn = document.getElementById('capture');
let phase = 'open';
let count = 0;
let done = false;
const NEEDED = 10;

const tick = new Audio('../resources/tick.wav');
const chime = new Audio('../resources/chime.wav');
function play(a) { try { a.currentTime = 0; a.play().catch(() => {}); } catch { /* ignore */ } }

function renderDots() {
  dotsEl.innerHTML = '';
  for (let i = 0; i < NEEDED; i++) {
    const d = document.createElement('div');
    d.className = 'd' + (i < count ? ' on' : '');
    dotsEl.appendChild(d);
  }
}
renderDots();

navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  .then((stream) => { preview.srcObject = stream; })
  .catch(() => { status.textContent = 'Camera preview unavailable'; });

window.nyx.onCalibrateScore((_e, sample) => {
  scoreEl.textContent = sample ? ((sample.left + sample.right) / 2).toFixed(2) : 'no face';
});

captureBtn.addEventListener('click', () => {
  if (done || count >= NEEDED) return;      // cap: ignore extra clicks
  window.nyx.requestCalibrationSample(phase);
  count += 1;
  play(tick);
  renderDots();
  status.textContent = `${phase}: ${count}/${NEEDED} captured`;
  if (count >= NEEDED) {
    if (phase === 'open') {
      phase = 'closed'; count = 0; renderDots();
      instruction.innerHTML = 'Step 2 — <b>close your eyes</b> and click Capture ~10 times.';
      status.textContent = '';
    } else {
      done = true;
      captureBtn.disabled = true;
      captureBtn.textContent = 'Complete ✓';
      instruction.textContent = 'Calibration complete. You can close this window.';
      play(chime);
    }
  }
});
```

- [ ] **Step 3: Syntax check** — `node --check src/renderer/calibration.js` (passes).

- [ ] **Step 4: Commit**

```bash
git add src/resources/tick.wav src/renderer/calibration.js
git commit -m "feat(renderer): cap calibration captures + capture/completion sounds"
```

---

## Task 3: Verify + review

- [ ] **Step 1:** `npx vitest run` — all green (72 tests: 71 + no net change; media-watcher test count shifts).
- [ ] **Step 2:** Dispatch a reviewer over `main..HEAD`: confirm `playingApp` matches the real pmset format + denylist is correct, `MediaWatcher`/`titleForApp` still consistent, calibration cap prevents over-capture and sounds are best-effort, no dangling `MEDIA_HINTS` references. Fix Critical/Important.
- [ ] **Step 3:** Update `docs/RUNBOOK.md`: note detection now works for browser video (NoDisplaySleepAssertion) and calibration caps at 10/phase with sounds.

## Self-Review Notes
- Bug root cause (NoDisplaySleepAssertion) directly addressed in Task 1 with real-format tests.
- `titleForApp(owner)` unaffected — owner names still contain the app keywords it matches.
- Calibration cap + sounds are renderer-only; `disabled` guard + `done` flag prevent extra captures; `.play().catch` keeps sounds best-effort.
