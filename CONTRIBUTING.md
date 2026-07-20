# Contributing to Nyx

Thanks for your interest! Nyx is a small, private, on-device macOS app — contributions that
keep it that way (offline, no telemetry, no images stored) are very welcome.

## Getting started

```bash
git clone https://github.com/mineo71/Nyx.git
cd Nyx
npm install
npm start          # builds CSS, then launches the app
```

**Requirements:** macOS (Apple Silicon), Node 20+.

## Tests

```bash
npm test           # Vitest — the pure detection/logic modules, no hardware needed
```

The detection core (`src/core/`) is intentionally pure and unit-tested. Please add or update
tests when you change that logic — `main` must stay green. Hardware/permission behaviour
(webcam, media-key, sleep) is covered by the manual pass in [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

## Architecture

- `src/core/` — pure logic: state machine, drowsiness detector, escalation engine, config,
  settings schema, i18n, accent, head-pose. **Tested.**
- `src/services/` — thin macOS adapters (`pmset`, `caffeinate`, AppleScript, media watcher).
- `src/main/` — Electron main process: windows, tray, capture scheduler, IPC.
- `src/renderer/` — the UI (vanilla HTML/JS + a Tailwind component layer) and the MediaPipe
  detector / camera-preview windows.

## Pull requests

- Keep changes focused; describe the *why*.
- Run `npm test` and check the app still launches (`npm start`).
- Match the surrounding style. No new runtime dependencies without a good reason.
- Localize any new user-facing strings in **both** `en` and `uk` (`src/renderer/i18n/strings.js`)
  — a test enforces key parity.

## Reporting bugs

Open an [issue](https://github.com/mineo71/Nyx/issues) with your macOS version, what you were
watching, and what happened. Never include webcam images — Nyx doesn't produce any, and we
don't want any.
