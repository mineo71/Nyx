const { EventEmitter } = require('node:events');

// Emits 'input' when the user's system idle time resets (i.e. they touched the machine).
// Depends on Electron's powerMonitor, injected so it can be swapped/tested.
class IdleMonitor extends EventEmitter {
  constructor({ powerMonitor, pollMs = 1000 }) {
    super();
    this.powerMonitor = powerMonitor;
    this.pollMs = pollMs;
    this._timer = null;
    this._lastIdle = null;
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      const idle = this.powerMonitor.getSystemIdleTime(); // seconds since last input
      if (this._lastIdle !== null && idle < this._lastIdle) this.emit('input');
      this._lastIdle = idle;
    }, this.pollMs);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._lastIdle = null;
  }
}

module.exports = { IdleMonitor };
