const DEFAULT_ACCENT = '7C8CF8';

// Normalize a system accent color to a 6-hex string (no '#', uppercase).
// macOS getAccentColor() returns 'RRGGBBAA'; also tolerates '#RRGGBB' / 'RRGGBB'.
function normalizeAccent(raw) {
  if (typeof raw !== 'string') return DEFAULT_ACCENT;
  const hex = raw.replace(/^#/, '').trim().toUpperCase();
  if (/^[0-9A-F]{6}/.test(hex)) return hex.slice(0, 6);
  return DEFAULT_ACCENT;
}

module.exports = { normalizeAccent, DEFAULT_ACCENT };
