# Nyx P4 — Open-Source Package (README + Landing + License)

**Date:** 2026-07-20
**Status:** Approved (proceed without gates, per user). Pure content — authored directly.

## 1. Purpose

Make Nyx presentable as an open-source project: a beautiful README, an MIT license, a
minimalistic landing page (GitHub-Pages-ready), and a scalable logo mark.

## 2. Deliverables
- `docs/assets/nyx-logo.svg` — crescent-moon mark (moonlit indigo), scalable, used by README + landing.
- `README.md` — hero, tagline, what/why, features, how it works, install (dev + dmg), privacy,
  tech stack, roadmap, license. Shields.io badges (license, platform, built-with).
- `LICENSE` — MIT (© 2026 Oleh Rylskyj).
- `landing/index.html` — self-contained dark landing (inline CSS, the SVG, no build/CDN): hero
  + tagline + CTA (GitHub), features grid, "how it works", footer. Servable via GitHub Pages
  (`/landing` or copied to a Pages branch).

## 3. Non-Goals
- No real app screenshots baked in (author adds later); use the logo + text for now, with a
  `docs/assets/` note for screenshots.
- No CI/workflows, no CONTRIBUTING (YAGNI for a personal OSS project).
- No ML (P5).

## 4. Notes
- Landing is a website (online by nature) but kept dependency-free (inline CSS) so it works
  offline and on Pages without a build.
- Copy is honest: emphasizes on-device, offline, private (no images stored).

## 5. Testing
- Docs/content — no unit tests. Verify: README renders (headings/links), landing opens in a
  browser, LICENSE present, SVG displays. `npx vitest run` stays green (unchanged code).
