# Nyx Manual Test Runbook

Automated unit tests cover the pure logic (`npm test` → 43 tests). This runbook is the
manual acceptance test for everything that needs real hardware, macOS permissions, and a
human — the webcam, media detection, media-key press, and system sleep.

## Prerequisites
```bash
cd /Users/oleh/Documents/Work/Self_Employed/Nyx
npm install
npm run build:mediakey     # builds src/resources/mediakey (git-ignored)
npm test                   # sanity: all unit tests green
```
Assets already in the repo: `src/resources/trayTemplate.png` (+ `@2x`), `src/resources/chime.wav`.

> **First run needs internet once.** The MediaPipe face model (`face_landmarker.task`,
> ~3–4 MB) is fetched from Google's CDN the first time the detector starts, then cached.
> Inference itself is always local. For a strictly-offline build, vendor the `.task` file
> into `src/resources/` and point `modelAssetPath` in `src/renderer/detector.js` at it.

## 1. First launch & permissions
1. `npm start`.
2. Grant **Camera** when macOS prompts (the hidden detector window calls `getUserMedia`).
3. Grant **Accessibility**: System Settings → Privacy & Security → Accessibility → enable
   Electron/Nyx. Needed for the media-key Play/Pause press.
4. Grant **Automation** on the first AppleScript title read (per app: browser, QuickTime…).
5. Confirm the crescent-moon icon appears in the menu bar; menu shows `Nyx — IDLE`.
6. Open the detector devtools console once to confirm no `[nyx] detector error:` line and
   that `nyx:detector-ready` fired (MediaPipe loaded). If you see an error, it's almost
   always the one-time model fetch (needs internet) or camera permission.

## 2. Calibration
1. Menu → **Calibrate…**.
2. Eyes **open**, click Capture ~10×. Then eyes **closed**, click Capture ~10×.
3. The main-process console logs `new eyeCloseThreshold: <value>` — a number between your
   open-eye and closed-eye blink averages. Close the window.

## 3. Arming (auto-arm on media)
1. Play a video (browser tab, QuickTime, IINA, or VLC). Within ~5s the menu shows
   `Nyx — WATCHING`.
2. `pgrep caffeinate` shows a process (Nyx is holding off the OS's own idle sleep).
3. Stop the video → menu returns to `Nyx — IDLE`; the `caffeinate` process is gone.

> If it never reaches WATCHING, your player may not raise a `PreventUserIdleDisplaySleep`
> assertion, or isn't in `MEDIA_HINTS`. Check `pmset -g assertions` while playing and add
> your app's name to `MEDIA_HINTS` in `src/services/media-watcher.js`.

## 4. Detection + escalation (shorten timings first!)
Waiting the real 90s + ladder each attempt is painful. Temporarily shrink them: quit Nyx,
then edit the persisted settings OR the `DEFAULTS` in `src/core/config.js` — e.g.
`tAsleepMs: 6000` and ladder `waitMs` of `4000`. Restart. **Restore afterward.**

1. Play a video, close your eyes and hold still (no mouse/keyboard).
2. After `tAsleepMs`, the dim **"Still watching?"** overlay appears (step 1 nudge) with a
   soft chime.
3. Keep eyes closed / don't move → playback pauses (media key), a louder nudge plays, then
   the Mac sleeps (or display-off / pause-only, per `finalAction`).
4. Repeat, but **move the mouse or open your eyes** mid-ladder → the overlay disappears, no
   sleep, menu returns to `WATCHING`.

## 5. Recap
After a pause fires, wake the Mac and open the menu → it shows
`Last night: paused "<title>" at <time>`.

## 6. Restore real timings when done.

---

## Known v1 limitations
- Media control is a global media key, so it pauses whatever is playing but can't read the
  exact episode via that path — titles come from best-effort AppleScript reads.

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
- `npm run dist` → `dist/Nyx-0.1.0-arm64.dmg` (arch-suffixed on Apple Silicon) + a `.zip`.
  Mount the dmg, drag Nyx to Applications.
- First launch: right-click Nyx.app → Open (unsigned; Gatekeeper prompt once).
- Confirm inside the packaged app: tray + popover work, calibration camera works, a video
  arms it, and the media-key pause + sleep still fire (grant Accessibility to Nyx.app, not
  to the terminal). Detection runs fully offline (model vendored under resources).

## Detection v2

- Camera now samples ~every 4s while WATCHING (was 60s), ~1.5s when checking.
- Robust closed/open: blinks and single noisy frames no longer flip the state; sustained
  closure does; opening your eyes for a few seconds cancels. Verify: blink normally while
  watching → stays WATCHING; hold eyes shut → goes DROWSY then escalates.
- Head-nod: let your head drop while closing your eyes → should reach the nudge faster than
  eyes-closed-upright. If it never helps, the pitch sign may be inverted — check the log's
  `pitch` values (below) and flip the `headDownDeg` sign in `src/core/config.js`.
- Logging (default ON): a numbers-only JSONL grows at
  `~/Library/Application Support/Nyx/detection-log.jsonl` (Settings → Reveal log). Confirm it
  contains lines like `{"t":...,"l":..,"r":..,"avg":..,"pitch":..,"closedFrac":..,"cls":"..","state":".."}`
  and NO images. Toggle it off in Settings → the file stops growing.
- Tuning: after a night, inspect the log — if it false-alarms, raise `enterFrac` or `tAsleep`;
  if it misses, lower them. Threshold comes from calibration.
