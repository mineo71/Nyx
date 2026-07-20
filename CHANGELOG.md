# Changelog

All notable changes to Nyx are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [0.2.0] — 2026-07-20

### Added
- **In-app update checks** — on launch and every 6h Nyx checks GitHub Releases; a newer
  version surfaces in the tray ("Update to X →") and a notification that downloads the DMG.
  Manual "Check for Updates…" in the tray menu.
- **App icon in "Now watching"** — the playing app's real icon next to the title.
- **Developer tools toggle** — the live detection readout + camera-preview window now hide
  behind a Settings → General toggle (off by default).
- **Camera preview window** — a standalone diagnostic with face-box / eye / iris / head-pose
  overlays, independent of arming.
- **Manual "Start watching"** — arm Nyx without playback.
- **Saved links** — recent nights / last night / now-watching link back to the tab you dozed off to.
- Homebrew cask, README demo GIF + screenshots, and an automated release workflow.

### Changed
- Faster playback detection (2s poll) so it arms promptly once a video is in sight.
- Menu-bar-only mode: closing the window hides the Dock icon; reopen from the tray.
- Camera is only active when armed (brief checks while watching, continuous only when
  confirming a doze) — the green light stays dark otherwise.

## [0.1.0] — 2026-07-20

### Added
- First public release: on-device sleep detection (MediaPipe), the nudge → pause → louder
  nudge → sleep escalation ladder, the nocturnal UI (menu-bar popover + dashboard), first-run
  onboarding, calibration, grouped Settings, and English + Українська.

[0.2.0]: https://github.com/mineo71/Nyx/releases/tag/v0.2.0
[0.1.0]: https://github.com/mineo71/Nyx/releases/tag/v0.1.0
