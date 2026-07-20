// Pure helpers for the update notifier: version comparison + GitHub release parsing.

function parseVersion(v) {
  return String(v || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
}

// True if `latest` is a strictly higher version than `current` (semver-ish, numeric).
function isNewer(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

// Reduce a GitHub "latest release" payload to what the notifier needs.
function pickRelease(json) {
  if (!json || !json.tag_name) return null;
  const version = String(json.tag_name).replace(/^v/i, '');
  const dmg = (json.assets || []).find((a) => a && /\.dmg$/i.test(a.name || ''));
  return { version, url: json.html_url || null, dmgUrl: dmg ? dmg.browser_download_url : null };
}

module.exports = { parseVersion, isNewer, pickRelease };
