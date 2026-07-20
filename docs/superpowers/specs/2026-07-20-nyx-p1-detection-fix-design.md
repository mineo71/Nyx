# Nyx P1 — Media Detection Fix + Calibration Polish

**Date:** 2026-07-20
**Status:** Approved (proceed without further gates, per user)
**Depends on:** shipped Nyx on `main`.

## 1. Purpose

Nyx never armed when the user played video. Root cause diagnosed live: browsers raise a
`NoDisplaySleepAssertion` (named "Video Wake Lock") for `<video>` playback, but the media
watcher only matched `PreventUserIdleDisplaySleep`/`PreventUserIdleSystemSleep` and required a
narrow app-name whitelist. Fix detection, and polish calibration (cap captures, add sounds).

## 2. Goals

- Detect playback reliably across browsers (Arc/Chrome/Safari) and players (QuickTime/IINA/VLC).
- Cap calibration to N captures per phase; add capture + completion sounds.
- No regressions; existing tests stay green.

## 3. Non-Goals

- No full-window app (P2), i18n (P3), landing/README (P4), or custom ML model (P5).
- No audio-based detection helper (assertion fix suffices for v1).

## 4. Diagnosis (evidence)

`pmset -g assertions` while a video was loaded in Arc showed:
`pid 1800(Arc): NoDisplaySleepAssertion named: "Video Wake Lock"` — an assertion TYPE the
watcher did not match. System daemons (`powerd`, `coreaudiod`, `caffeinate`) also raise
`PreventUserIdleSystemSleep`, so a naive broadening would false-positive; hence a denylist.

## 5. Design

### 5a. Media detection (`src/services/media-watcher.js`)
Replace `playingApp(text)`:
- Scan lines matching `pid \d+\(<owner>\): ... <AssertionType> named: "..."`.
- Treat as media when `AssertionType` is `PreventUserIdleDisplaySleep` OR
  `NoDisplaySleepAssertion`, AND `<owner>` is not in a system denylist
  (`powerd`, `coreaudiod`, `caffeinate`, `WindowServer`, `loginwindow`, `controlcenter`,
  `sharingd`, `nyx`, `electron`). Case-insensitive.
- Return the owner app name (first match) or `null`. Remove the `MEDIA_HINTS` whitelist.
- `MediaWatcher` class and events unchanged; `titleForApp(owner)` still resolves titles
  (owner strings contain arc/chrome/safari/quicktime/iina/vlc).

### 5b. Calibration (`src/renderer/calibration.html`, `calibration.js`)
- Cap: once a phase reaches `NEEDED` (10), ignore further Capture clicks for that phase;
  when both phases are done, disable the Capture button and show "Complete ✓".
- Sounds: play a short **tick** on each accepted capture; play **chime** on completion.
  Add `src/resources/tick.wav` (generated); reuse `src/resources/chime.wav`.

## 6. Error handling
- `pmset` read failure → `''` → no media (existing behavior).
- Missing sound assets → `.play()` catch swallows (existing pattern).

## 7. Testing
- `playingApp` (pure) TDD: real assertion samples — Arc `NoDisplaySleepAssertion "Video Wake
  Lock"` → `Arc`; `powerd`/`coreaudiod`/`caffeinate` lines → `null`; QuickTime
  `PreventUserIdleDisplaySleep` → `QuickTime Player`; empty → `null`.
- Calibration → manual (RUNBOOK).
