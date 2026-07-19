# Nyx — Detection v2 Design Spec

**Date:** 2026-07-20
**Status:** Approved (design), pending implementation plan
**Depends on:** shipped Nyx v1 (core + services + detector) and v2 UI/deploy, both on `main`.
**Platform:** macOS 26.5.1, single-user personal app.

## 1. Purpose

Make the awake/asleep decision robust. v1 flips WATCHING→DROWSY on a *single* closed frame
and resets on a *single* open frame, sampling only every 60s — jittery, blink-triggered, and
noise-reset. This spec inserts a pure, windowed `DrowsinessDetector` between the camera and
the state machine that debounces closure with hysteresis + PERCLOS and a head-nod
corroborator, and ships numbers-only logging so thresholds can be tuned from real data.

## 2. Goals

- Robust closed/open decision: blinks and single noisy frames don't flip it; sustained
  closure does; waking (sustained open) cancels quickly.
- Head-nod (head-drop) as a soft corroborator that speeds real-sleep detection.
- Numbers-only detection logging (default ON) to enable later tuning/training.
- Keep the existing, well-tested state machine as the final sustained-closure → escalate gate.

## 3. Non-Goals

- No model training in this spec (logging is groundwork only).
- No owner-only / multi-person handling (deferred; still `numFaces: 1`).
- No image/frame storage (logging is numeric only).
- No new escalation behavior; the ladder and state machine transitions are unchanged.

## 4. Key Decisions

| Decision | Choice |
|---|---|
| Where the smarts live | Pure `DrowsinessDetector` between frames and the state machine. |
| Smoothing | Time-based rolling window (~12s) + majority-vote hysteresis (enter ≥0.6, exit <0.4). |
| Drowsiness metric | PERCLOS (closed-fraction over the window), exposed for logging + panel. |
| Head-nod | Soft corroborator: last 2 known samples `closed && headDown` → force `closed`. |
| Head pitch | From MediaPipe facial transformation matrix, via a pure `pitchFromMatrix`. |
| Cadence | WATCHING 60s → ~4s; DROWSY/ESCALATING → ~1.5s. |
| Logging | Numbers-only JSONL under `userData`, size-capped, default ON, Settings toggle. |
| State machine | Unchanged; receives the debounced classification. |

## 5. Architecture

Additive. Data flow becomes:

```
detector renderer (MediaPipe)  ──frame {left,right,matrix}──▶  main.js
  main: pitch = pitchFromMatrix(matrix)
        drowsiness.update({left,right,pitch}, now)
        cls = drowsiness.classify()           // 'open'|'closed'|'unknown'
        machine.frame(cls)                     // existing state machine, unchanged
        if logDetection && armed: detectionLog.append({...drowsiness.metrics(), cls, state})
```

### New files
- `src/core/head-pose.js` — pure `pitchFromMatrix(matrix)` → degrees (or `null`).
- `src/core/drowsiness-detector.js` — pure, stateful `DrowsinessDetector`.
- `src/services/detection-log.js` — append-only numbers-only JSONL, size-capped.

### Changed files
- `src/renderer/detector.js` — enable `outputFacialTransformationMatrixes`; include the
  16-float matrix in the emitted sample (`{left,right,matrix}`), `null` matrix when no face.
- `src/main/main.js` — instantiate `DrowsinessDetector` + `detection-log`; compute pitch;
  route frames through the detector; reset the detector on arm; append logs while armed.
- `src/core/config.js` — cadence defaults + drowsiness/head-nod params + `logDetection`.
- `src/core/settings-schema.js` + Settings UI — `logDetection` toggle.

## 6. DrowsinessDetector (pure, stateful)

Constructed with `{ getThreshold, params }` where `getThreshold()` returns the live
calibrated eye-close threshold and `params` holds the tunables (below). Time is injected via
the `nowMs` argument to `update` (used for window pruning) — no separate clock, matching the
state machine's testing pattern.

### State
A time-ordered window of entries `{ t, closed, headDown, known }`, plus the current smoothed
output (`'open'` initially).

### `update(sample, nowMs)`
- `sample === null` or either eye score not a number → push `{ t: nowMs, known: false }`.
- else: `avg = (left+right)/2`; `closed = avg >= getThreshold()`;
  `headDown = typeof pitch === 'number' && pitch <= params.headDownDeg`;
  push `{ t: nowMs, closed, headDown, known: true }`.
- Drop entries older than `nowMs - params.windowMs`.

### `classify()` → `'open' | 'closed' | 'unknown'`
1. `known = entries with known === true`. If `known.length === 0` → return `'unknown'`
   (do NOT change the smoothed state).
2. **Head-nod fast path:** if the last 2 known entries both have `closed && headDown` →
   set smoothed = `'closed'`, return `'closed'`.
3. `closedFrac = closedCount / known.length` (this is PERCLOS over the window).
4. Hysteresis:
   - if smoothed is `'closed'`: flip to `'open'` when `closedFrac < params.exitFrac`.
   - else: flip to `'closed'` when `closedFrac >= params.enterFrac`.
5. Return the smoothed state.

### `perclos()` → number
`closedCount / knownCount` over the window (0 if no known entries).

### `metrics()` → object for logging
`{ avg, pitch, closedFrac, known }` of the latest sample + current window.

### `reset()`
Clears the window and sets smoothed = `'open'`. Called on each arm so sessions start fresh.

### Default params (in `config.js`)
`windowMs: 12000`, `enterFrac: 0.6`, `exitFrac: 0.4`, `headDownDeg: -12` (pitch threshold;
sign/value calibratable, refined via logs).

### Why this is robust
At ~4s WATCHING cadence the window holds ~3 samples; blinks (sub-second) rarely land on a
sample and never form a majority, so they can't flip to `closed`. A single stray open frame
during real sleep doesn't drop `closedFrac` below `exitFrac`, so it won't reset. Sustained
open (waking) crosses `exitFrac` within a couple samples — comfortably faster than the 30s+
ladder waits. The state machine's `tAsleep` remains the final gate.

## 7. Head Pose (`pitchFromMatrix`)

MediaPipe `FaceLandmarker` with `outputFacialTransformationMatrixes: true` yields a 4×4
column-major transform. `pitchFromMatrix(matrix)`:
- returns `null` if `matrix` is missing or not length 16;
- extracts rotation-about-X (pitch) in degrees from the rotation submatrix.

The renderer forwards the raw matrix; `main.js` computes pitch (keeps the tested helper in
`core`, since the isolated renderer can't `require` CommonJS). Sign convention and
`headDownDeg` are treated as calibratable defaults; because head-nod is only a soft fast
path, a wrong sign disables the fast path but never causes a false sleep.

## 8. Cadence

`config.js` `intervals`: `baselineMs 60000 → 4000`, `confirmMs 2000 → 1500`. The capture
scheduler already maps WATCHING→baseline and DROWSY/ESCALATING→confirm; only the numbers
change. Camera analysis every ~4s is light for a plugged-in bedside Mac.

## 9. Detection Logging

`src/services/detection-log.js`:
- Appends one JSON object per line to `<userData>/detection-log.jsonl`:
  `{ t, l, r, avg, pitch, closedFrac, cls, state }`.
- Size cap (~5 MB): before appending, if the file exceeds the cap, truncate to the most
  recent half (keep tail). Never unbounded.
- Numbers only — no images, no titles, no network.
- Controlled by setting `logDetection` (default `true`); `main.js` appends only while armed
  and when enabled. Write failures are caught and logged, never block detection.
- Settings shows the toggle and a "Reveal in Finder" affordance for the log path.

## 10. Settings / UI

- `settings-schema.js` `DEFAULT_VIEW` gains `logDetection: true`; clamp coerces to boolean.
- `main.js` view↔store: read/write `logDetection` from `settings`.
- Settings window: a "Log detection data (numbers only)" checkbox under **General**, plus a
  "Reveal log" button.
- Panel: unchanged. (DROWSY state copy is now backed by real smoothing.)

## 11. Error Handling

- Null/partial sample → window entry `known:false`; `classify()` returns `unknown` when the
  window has no known entries; `unknown` never advances the machine toward sleep.
- Missing/!=16 matrix → `pitchFromMatrix` returns `null` → `headDown:false` → head-nod off.
- Log write/truncate failure → caught, logged once, detection continues.
- Threshold not yet calibrated → uses the existing default `eyeCloseThreshold`.

## 12. Testing

- **`pitchFromMatrix` (TDD):** construct rotation-about-X matrices for known angles (0°, +20°,
  −20°) → assert degrees; `null`/wrong-length → `null`.
- **`DrowsinessDetector` (TDD, mock clock):**
  - blinks (isolated closed samples among opens) never yield `'closed'`;
  - sustained closure (≥ enterFrac of window) yields `'closed'`;
  - a single stray open during sustained closure does NOT flip to `'open'`;
  - sustained open (< exitFrac) flips back to `'open'`;
  - no-face window → `'unknown'` and smoothed state preserved;
  - head-nod fast path: two consecutive `closed && headDown` → immediate `'closed'`;
  - old entries fall out of the time window.
- **`settings-schema`:** `logDetection` defaulted + coerced to boolean.
- **Detection log:** a focused test for the size-cap/truncate helper if pure; file I/O
  otherwise manual.
- **Integration:** manual (RUNBOOK) — denser cadence, robust closed/open on the live camera,
  head-drop registers, log file grows numbers-only and stays capped, Settings toggle works.

## 13. Open Items for Implementation Plan

- Exact `pitchFromMatrix` rotation extraction for MediaPipe's column-major convention (and a
  runtime note to verify sign via the log).
- Whether to expose PERCLOS in the panel (default: no, keep it in the log only for now).
- Detection-log truncate implementation (rewrite tail vs rotate file).
