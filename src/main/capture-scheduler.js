// Ticks at the fast interval; only requests a capture when enough time has elapsed
// for the current state's cadence.
class CaptureScheduler {
  constructor({ detectorWebContents, getState, intervals }) {
    this.wc = detectorWebContents;
    this.getState = getState;          // () => 'IDLE'|'WATCHING'|'DROWSY'|'ESCALATING'
    this.intervals = intervals;        // { baselineMs, confirmMs }
    this._timer = null;
    this._lastCaptureAt = 0;
    this._nowMs = () => Date.now();
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this._tick(), this.intervals.confirmMs);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  cadenceFor(state) {
    if (state === 'WATCHING') return this.intervals.baselineMs;
    if (state === 'DROWSY' || state === 'ESCALATING') return this.intervals.confirmMs;
    return null; // IDLE => no captures
  }

  _tick() {
    const cadence = this.cadenceFor(this.getState());
    if (cadence == null) return;
    const now = this._nowMs();
    if (now - this._lastCaptureAt >= cadence) {
      this._lastCaptureAt = now;
      this.wc.send('nyx:capture');
    }
  }
}

module.exports = { CaptureScheduler };
