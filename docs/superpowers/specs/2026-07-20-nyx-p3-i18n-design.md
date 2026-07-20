# Nyx P3 — Internationalization (English + Ukrainian)

**Date:** 2026-07-20
**Status:** Approved (proceed without gates, per user)
**Depends on:** Nyx on `main` (all surfaces: panel, settings, nudge, calibration, main-window).

## 1. Purpose

Make every user-facing string translatable and ship **English + Ukrainian**, following the
system language by default with a manual override in Settings.

## 2. Goals

- All visible copy across the 5 renderer surfaces localized.
- Locale = `language` setting: `auto` (follow macOS) / `en` / `uk`. Default `auto`.
- Language change applies immediately (reload open windows with the new locale).
- Offline; no framework — small bundled string dicts + a tiny runtime.

## 3. Non-Goals

- Only `en` + `uk` (no other locales).
- No pluralization/number/date-format library (JS `toLocale*` already localizes times/dates).
- No landing/README (P4), no ML (P5).

## 4. Design

### 4a. Strings (`src/renderer/i18n/strings.js`)
A plain browser script exposing `window.NYX_STRINGS = { en: {...}, uk: {...} }` — a flat
key→string map per locale (e.g. `panel.settings`, `state.watching.line`, `settings.detection`,
`nudge.title`, `calib.step1`, …). Both locales share identical keys.

### 4b. Locale resolution (`src/core/i18n.js`, pure, tested)
- `resolveLocale(setting, systemLocale)`: `auto` → `systemLocale` starts with `uk` ? `uk` : `en`;
  else `setting` if in `['en','uk']` else `en`.
- `LOCALES = ['en','uk']`.

### 4c. Runtime (`src/renderer/i18n/i18n.js`)
Loaded (with `strings.js`) before each page script. On load:
- `lang = new URLSearchParams(location.search).get('lang')` (default `en`).
- `dict = NYX_STRINGS[lang] || NYX_STRINGS.en`.
- Exposes `window.t(key)` → `dict[key] ?? key`.
- Auto-applies: for every `[data-i18n]` element, set `textContent = t(key)`; for
  `[data-i18n-html]`, set `innerHTML` (only for our own trusted markup like the calibration
  bold step). Runs on `DOMContentLoaded`.

### 4d. Surfaces
- Add `data-i18n="<key>"` to every static text node in panel/settings/nudge/calibration/
  main-window HTML; load `i18n/strings.js` + `i18n/i18n.js` before the page script.
- Dynamic strings in JS (STATE_COPY lines/subs, status text, "captured", "complete") use
  `window.t(...)`.

### 4e. Setting + plumbing
- `settings-schema`: add `language` to `DEFAULT_VIEW` (`'auto'`) + clamp to `['auto','en','uk']`.
- `main.js`: `lang = resolveLocale(settings.get('language','auto'), app.getLocale())`;
  `setLang(lang)` in windows.js (like `setAccent`); every `loadFile` adds `?lang=` + `?accent=`.
  On `setSetting('language', ...)`, re-resolve and **reload each open window** via `loadFile`
  with the new query so the new locale takes effect immediately.
- Settings UI: a Language segmented control (Auto · EN · UK) bound to `language`.

## 5. Error handling
- Missing key → returns the key itself (visible, debuggable).
- Missing locale → falls back to `en`.

## 6. Testing
- `resolveLocale` (pure) TDD: auto+uk system → uk; auto+en → en; explicit uk/en; garbage → en.
- Optional: assert `en`/`uk` dicts have identical key sets (pure test over `NYX_STRINGS`).
- Manual: switch language in Settings → all surfaces update; system-uk launch → Ukrainian.

## 7. Open items for plan
- Full key list + en/uk translations.
- Per-window reload-on-language-change wiring.
- Which elements get `data-i18n` vs `data-i18n-html`.
