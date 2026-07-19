# Nyx — Design Spec

**Date:** 2026-07-19
**Status:** Approved (design), pending implementation plan
**Platform:** macOS 26.5.1, single-user personal app (author's Mac only)

## 1. Purpose

Nyx is a personal macOS menu-bar app. The author watches films/series in bed and
falls asleep mid-playback, then wakes not knowing where they stopped and having
"watched" hours while asleep. Nyx watches for the author falling asleep via the
webcam, gently escalates, pauses playback, records where playback stopped, and —
if unresponsive — puts the Mac to sleep. Built for one user, run locally, no cloud.

## 2. Goals

- Detect when the author is asleep while media is playing.
- Stop wasting playback: pause the player once asleep.
- Record "where I fell asleep" (title + timestamp) for a next-morning recap.
- Escalate gently, with multiple chances to signal "I'm awake" before the Mac sleeps.
- Fully local and private. Webcam frames are never stored or transmitted.

## 3. Non-Goals

- No cross-platform support (macOS only).
- No cloud, accounts, sync, or telemetry.
- No custom-trained ML model in v1 (heuristic detection only).
- No exact "resume at this timecode" — recap is title + wall-clock time, not seek position.
- No reading of protected "Now Playing" system data (blocked on macOS 26).

## 4. Key Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Sleep detection | Eye-openness heuristic + personal calibration. No training. |
| Detection engine | MediaPipe FaceLandmarker (blendshapes give eye-blink score directly). |
| Players supported | Browser video (Arc/Chrome/Safari), QuickTime, IINA/VLC, streaming apps. |
| Playback control | Global media Play/Pause key (works everywhere). |
| Title reading | Best-effort, separate from control (AppleScript per app). |
| Webcam images | Analyzed in memory, never saved. Only thresholds persisted. |
| Arming | Auto-arm when media is playing; dormant otherwise. Optional night-hours gate (default: off — arms any time media plays). |
| Escalation final step | Nudge → pause → repeated nudges → `pmset sleepnow`. |
| Wake/response signal | Any keyboard/mouse input OR eyes-open detected. |
| Morning recap | Best-effort title + timestamp, shown in menu bar. |
| Architecture | Electron + JS; shell out to macOS CLI/AppleScript; one tiny Swift media-key helper. |

## 5. Architecture

Menu-bar Electron app, single process tree, all data local. No main window; a hidden
renderer runs the camera + ML. Native OS actions are performed by shelling to built-in
tools (`pmset`, `caffeinate`, `osascript`) plus one small bundled Swift helper binary
for the media-key press (the only action with no built-in CLI).

### Components

1. **Menu-bar controller** — Tray icon reflecting state (idle / armed / watching /
   escalating). Dropdown: current arm state, tonight's recap, quick settings, quit.
2. **Media watcher** — Polls whether audio/video is playing, which app is frontmost/playing,
   and best-effort title (AppleScript per app). Emits `media-playing` / `media-stopped`
   with the current title.
3. **Arm controller** — Top-level state machine. `media-playing` (+ optional night-hours
   gate) arms the camera; `media-stopped` disarms.
4. **Sleep detector** — Hidden renderer: `getUserMedia` + MediaPipe FaceLandmarker.
   Baseline analysis every 60s; on eyes-closed suspicion ramps to ~every 2s to confirm.
   Frames analyzed in memory, never saved. Emits `drowsy` / `asleep` / `awake` / `unknown`.
5. **Calibration** — Short wizard: look at camera eyes-open, then eyes-closed. Stores the
   author's personal eye-closure threshold. Only thresholds persisted, no images.
6. **Escalation engine** — Runs the ladder (Section 7). Injected action layer
   (nudge / pause / sleep) so it is unit-testable.
7. **Wake/response monitor** — `powerMonitor.getSystemIdleTime()` for input, plus the
   detector's eyes-open signal. Cancels/reset the ladder.
8. **Recap log** — On pause, records `{title, app, timestamp}` locally. Menu bar shows
   "last night: paused *X* at 2:14am".
9. **Settings store** — `electron-store`: ladder timings, final action, night hours,
   thresholds, analysis intervals, `T_asleep`.
10. **Media-key helper** — Tiny bundled Swift binary that posts a system Play/Pause HID event.

## 6. State Machine

States: `IDLE → ARMED → WATCHING → DROWSY → ESCALATING → {SLEPT | CANCELLED}`.

```
IDLE
  media-playing (+ night-hours ok) ─────────────► ARMED
ARMED
  camera up, MediaPipe running ─────────────────► WATCHING
  media-stopped ────────────────────────────────► IDLE
WATCHING   (analyze every 60s)
  eyes-closed frame detected ───────────────────► DROWSY
  media-stopped ────────────────────────────────► IDLE
DROWSY     (analyze every ~2s, confirm)
  eyes open again / any input ──────────────────► WATCHING   (reset)
  eyes closed continuously ≥ T_asleep ──────────► ESCALATING
ESCALATING (run ladder)
  any input OR eyes-open at any step ───────────► CANCELLED → WATCHING
  ladder exhausted ─────────────────────────────► SLEPT → IDLE
```

- While ARMED/WATCHING/DROWSY/ESCALATING, `caffeinate` holds off the OS's own idle
  sleep so Nyx — not macOS — controls when the machine sleeps. Released on IDLE/SLEPT.
- App quit resets state to IDLE on next launch; settings and recap persist.

## 7. Escalation Ladder

All timings configurable in settings. Defaults:

| Step | Action | Wait for response |
|---|---|---|
| 1 | Quiet nudge (soft sound + dim overlay "Still watching?") | 30s |
| 2 | Pause playback (media key) + 2nd nudge | 45s |
| 3 | 3rd nudge, louder | 30s |
| 4 | `pmset sleepnow` | — |

- `T_asleep` default: 90s continuous eyes-closed.
- "Response" = keyboard/mouse input OR camera sees eyes open ≥ 2s → cancels ladder,
  returns to WATCHING.
- Final action is configurable: sleep Mac (default) / display-off only / pause-only.

## 8. Error Handling

- **Camera denied/unavailable** → detector disarms, menu-bar warning shown; media watch
  and recap still work, but no auto-sleep. Never silently pretend to watch.
- **No face in frame** (dark room, face in pillow) → classified `unknown`, NOT asleep.
  Prevents sleeping the Mac when the author has left. Optional: after prolonged `unknown`,
  a gentle nudge only.
- **Media-key helper missing/fails** → log, skip the pause step, continue the ladder.
- **AppleScript title read fails** → recap logs app name only or "unknown title";
  never blocks the ladder.
- **macOS permission prompts** (Camera; Accessibility for input monitoring / AppleScript)
  → first-run checklist screen guides granting them.

## 9. Privacy

- Webcam frames are never written to disk.
- No network calls, ever. Fully offline.
- Persisted data only: numeric thresholds, settings, recap text log — under the app's
  local data directory.

## 10. Testing Strategy

- **Sleep detector:** feed recorded sample frames (fixtures) → assert eyes-open/closed
  classification against calibrated threshold.
- **State machine:** unit-test all transitions with a mock clock (fast-forward the
  90s/30s/45s timers — no real waiting).
- **Escalation engine:** mock action layer (nudge/pause/sleep are injected functions) →
  assert correct calls in order and that any-input/eyes-open cancels at each step.
  No real Mac sleep in tests.
- **Media watcher + OS helpers:** thin wrappers around CLI/AppleScript; verified by
  integration/manual check.

## 11. Tech Stack

- Electron (main + hidden renderer), Node 20.
- `@mediapipe/tasks-vision` FaceLandmarker for eye-closure blendshapes.
- `electron-store` for settings/recap persistence.
- macOS built-ins: `pmset sleepnow`, `caffeinate`, `osascript` (AppleScript).
- One bundled Swift helper binary for the global media Play/Pause key.

## 12. Open Items for Implementation Plan

- Exact MediaPipe model asset packaging + hidden-renderer wiring.
- Swift media-key helper: build + code-signing/bundling within the Electron app.
- Per-app AppleScript snippets for title reading (Arc, Chrome, Safari, QuickTime, IINA, VLC).
- First-run permissions checklist UX.
- Settings UI surface.
