<div align="center">

<img src="docs/assets/nyx-logo.svg" width="120" alt="Nyx logo" />

# Nyx

**Fall asleep watching? Nyx catches you.**

A private macOS menu-bar app that notices when you doze off in front of a film,
gently nudges you, pauses playback, remembers where you stopped — and puts your
Mac to sleep if you don't answer.

![platform](https://img.shields.io/badge/platform-macOS-0B0E14?style=flat-square)
![built with](https://img.shields.io/badge/built%20with-Electron%20%2B%20MediaPipe-7C8CF8?style=flat-square)
![license](https://img.shields.io/badge/license-MIT-5FB98B?style=flat-square)
![offline](https://img.shields.io/badge/100%25-offline-5FB98B?style=flat-square)

</div>

---

## Why

You put on a series in bed, drift off, and wake up six episodes deep with no idea where you
stopped. Nyx watches for that moment — eyes closing, head dropping — and steps in: a soft
nudge, then pause, then, if you're truly gone, it sleeps the Mac. In the morning it tells you
exactly where you nodded off.

Everything runs **on your machine**. The camera feed is analyzed in memory and **never saved
or uploaded**.

## Features

- 🌙 **Sleep detection** — on-device eye-closure + drowsiness tracking (MediaPipe FaceLandmarker),
  with a windowed, hysteresis-based decision so blinks don't fool it and a stray frame won't
  reset it. Optional **head-nod** corroboration.
- 🎬 **Knows what's playing** — arms automatically when video plays (browser, QuickTime, IINA,
  VLC) and records the title + time you dozed off for a morning recap.
- 🪜 **Gentle escalation ladder** — quiet nudge → pause playback → louder nudge → sleep the Mac.
  Any movement or open eyes cancels it. Every timing is configurable.
- 🖥️ **Real Mac app** — frosted-glass menu-bar popover **and** a full dashboard window, native
  controls, follows your system accent color.
- 🌍 **English & Українська** — follows your system language, switchable in Settings.
- 🔒 **Private & offline** — no cloud, no accounts, no images stored. Optional numbers-only
  detection log (on by default) to help you tune, stored locally.
- 🎚️ **Calibration** — a quick eyes-open / eyes-closed wizard tunes detection to your face.

## How it works

```
 media plays ──► arm camera ──► MediaPipe eye-blink + head-pose
                                     │
                        windowed drowsiness model (hysteresis + PERCLOS)
                                     │
        eyes closed long enough ──► escalation ladder
             nudge → pause → louder nudge → sleep Mac
                                     │
                 any input / eyes open ──► cancel
```

Detection lives in small, pure, unit-tested modules; the camera + OS glue is thin adapters
around Electron and macOS built-ins (`pmset`, `caffeinate`, AppleScript) plus a tiny Swift
media-key helper.

## Install

**Requirements:** macOS, Node 20+.

```bash
git clone <your-fork-url> nyx
cd nyx
npm install
npm run build:mediakey      # compile the Swift media-key helper
npm start                   # launches the app (builds CSS first)
```

Grant **Camera** and **Accessibility** permissions when prompted (Accessibility is needed to
press the media Play/Pause key).

**Build a distributable app:**

```bash
npm run dist                # -> dist/Nyx-<version>-arm64.dmg  (unsigned)
```

First launch of the unsigned build: right-click `Nyx.app` → **Open**.

## Usage

1. Click the crescent in the menu bar → **Calibrate** (eyes open ×10, eyes closed ×10).
2. Play something. The panel flips to **Watching**.
3. Doze off → Nyx nudges, pauses, and (if configured) sleeps the Mac.
4. Next morning, the panel shows *where* you stopped.

Tune everything in **Settings**: fall-asleep delay, ladder timings, final action
(sleep / display-off / pause-only), night hours, launch-at-login, language.

## Privacy

- Webcam frames are processed in memory and **never written to disk or sent anywhere**.
- The only persisted data: your calibration threshold, settings, a text recap, and (if enabled)
  a **numbers-only** detection log (`~/Library/Application Support/Nyx/detection-log.jsonl`).
- Fully offline. No telemetry.

## Tech

Electron · MediaPipe Tasks Vision · Tailwind CSS · Lucide · Vitest · a little Swift.

## Roadmap

- Owner-only detection when more than one face is in frame.
- A personal, trained detection model once enough local data is collected.
- Better low-light detection (a normal webcam can't see in the dark — needs IR).

## License

[MIT](LICENSE) © 2026 Oleh Rylskyj

<div align="center"><sub>Named for Nyx, the Greek goddess of night. 🌙</sub></div>
