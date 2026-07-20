const { EventEmitter } = require('node:events');
const { run } = require('./run-cmd.js');
const { titleForApp } = require('./applescript.js');

// Assertion types that mean "something is actively keeping the display awake" (i.e. playing).
const WAKE_ASSERTIONS = /(PreventUserIdleDisplaySleep|NoDisplaySleepAssertion)/;
// System daemons that hold sleep assertions but are NOT media.
const SYSTEM_OWNERS = ['powerd', 'coreaudiod', 'caffeinate', 'windowserver', 'loginwindow', 'controlcenter', 'sharingd', 'nyx', 'electron'];

async function readAssertions() {
  try {
    const { stdout } = await run('pmset', ['-g', 'assertions']);
    return stdout;
  } catch {
    return '';
  }
}

// Returns the owning app of a display-wake assertion (media playing), or null.
function playingApp(assertionsText) {
  for (const line of assertionsText.split('\n')) {
    if (!WAKE_ASSERTIONS.test(line)) continue;
    const m = line.match(/pid\s+\d+\(([^)]+)\)/);
    if (!m) continue;
    const owner = m[1].trim();
    if (SYSTEM_OWNERS.includes(owner.toLowerCase())) continue;
    return owner;
  }
  return null;
}

class MediaWatcher extends EventEmitter {
  constructor({ pollMs = 5000 } = {}) {
    super();
    this.pollMs = pollMs;
    this._timer = null;
    this._playing = false;
    this._title = null;
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this._poll(), this.pollMs);
    this._poll();
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  get currentTitle() { return this._title; }

  async _poll() {
    const app = playingApp(await readAssertions());
    const nowPlaying = !!app;
    if (nowPlaying && !this._playing) {
      this._playing = true;
      this._title = await titleForApp(app);
      this.emit('media-playing', { app, title: this._title });
    } else if (nowPlaying) {
      this._title = await titleForApp(app); // keep title fresh for recap
    } else if (!nowPlaying && this._playing) {
      this._playing = false;
      this.emit('media-stopped', { title: this._title });
    }
  }
}

module.exports = { MediaWatcher, playingApp };
