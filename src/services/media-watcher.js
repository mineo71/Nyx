const { EventEmitter } = require('node:events');
const { run } = require('./run-cmd.js');
const { titleForApp } = require('./applescript.js');

// Apps we treat as media. Their assertion presence => something is playing.
const MEDIA_HINTS = ['arc', 'chrome', 'safari', 'quicktime', 'iina', 'vlc', 'tv', 'music', 'netflix'];

async function readAssertions() {
  try {
    const { stdout } = await run('pmset', ['-g', 'assertions']);
    return stdout;
  } catch {
    return '';
  }
}

// Returns the media app name currently asserting display-wake, or null.
function playingApp(assertionsText) {
  const lines = assertionsText.split('\n');
  for (const line of lines) {
    if (!/PreventUserIdleDisplaySleep|PreventUserIdleSystemSleep/.test(line)) continue;
    const lower = line.toLowerCase();
    const hit = MEDIA_HINTS.find((h) => lower.includes(h));
    if (hit) return hit;
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
