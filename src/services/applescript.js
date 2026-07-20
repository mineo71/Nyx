const { run } = require('./run-cmd.js');

async function osa(script) {
  try {
    const { stdout } = await run('osascript', ['-e', script]);
    const out = stdout.trim();
    return out.length ? out : null;
  } catch {
    return null;
  }
}

// Front browser tab title (tries Arc, Chrome, Safari in order).
async function browserTitle() {
  return (
    (await osa('tell application "Arc" to return title of active tab of front window')) ||
    (await osa('tell application "Google Chrome" to return title of active tab of front window')) ||
    (await osa('tell application "Safari" to return name of front document'))
  );
}

async function quickTimeTitle() {
  return osa('tell application "QuickTime Player" to return name of document 1');
}

async function iinaOrVlcTitle() {
  return (
    (await osa('tell application "IINA" to return name of front window')) ||
    (await osa('tell application "VLC" to return name of current item'))
  );
}

// Given the frontmost/playing app name, pick the best title reader.
async function titleForApp(appName) {
  const name = (appName || '').toLowerCase();
  if (name.includes('quicktime')) return quickTimeTitle();
  if (name.includes('iina') || name.includes('vlc')) return iinaOrVlcTitle();
  if (name.includes('arc') || name.includes('chrome') || name.includes('safari')) return browserTitle();
  return null;
}

// Whitelisted Chromium-family apps → their exact AppleScript application name.
// (Whitelist, not interpolation, so a process name can't inject into the script.)
const CHROMIUM_APPS = [
  ['arc', 'Arc'], ['google chrome', 'Google Chrome'], ['chromium', 'Chromium'],
  ['brave', 'Brave Browser'], ['microsoft edge', 'Microsoft Edge'], ['edge', 'Microsoft Edge'],
  ['vivaldi', 'Vivaldi'], ['opera', 'Opera'],
];

// Active-tab URL for a browser (null for native players / unknown apps).
async function urlForApp(appName) {
  const name = (appName || '').toLowerCase();
  if (name.includes('safari')) return osa('tell application "Safari" to return URL of front document');
  for (const [key, appExact] of CHROMIUM_APPS) {
    if (name.includes(key)) return osa(`tell application "${appExact}" to return URL of active tab of front window`);
  }
  return null;
}

module.exports = { osa, browserTitle, quickTimeTitle, iinaOrVlcTitle, titleForApp, urlForApp };
