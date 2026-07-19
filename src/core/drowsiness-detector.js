// Windowed, hysteretic awake/asleep classifier. Pure and stateful; time is injected via
// the nowMs argument to update(). Consumes {left,right,pitch} samples (or null) and emits a
// debounced 'open' | 'closed' | 'unknown' that the state machine consumes unchanged.
class DrowsinessDetector {
  constructor({ getThreshold, params }) {
    this.getThreshold = getThreshold;
    this.p = params; // { windowMs, enterFrac, exitFrac, headDownDeg }
    this._entries = [];      // { t, known, closed, headDown }
    this._state = 'open';
    this._lastAvg = null;
    this._lastPitch = null;
  }

  update(sample, nowMs) {
    if (!sample || typeof sample.left !== 'number' || typeof sample.right !== 'number') {
      this._entries.push({ t: nowMs, known: false, closed: false, headDown: false });
      this._lastAvg = null;
      this._lastPitch = null;
    } else {
      const avg = (sample.left + sample.right) / 2;
      const closed = avg >= this.getThreshold();
      const headDown = typeof sample.pitch === 'number' && sample.pitch <= this.p.headDownDeg;
      this._entries.push({ t: nowMs, known: true, closed, headDown });
      this._lastAvg = avg;
      this._lastPitch = typeof sample.pitch === 'number' ? sample.pitch : null;
    }
    // Drop entries at or beyond the trailing edge of the window so a window with no
    // fresh samples truly empties (entries exactly windowMs old are already stale).
    const cutoff = nowMs - this.p.windowMs;
    this._entries = this._entries.filter((e) => e.t > cutoff);
  }

  classify() {
    const known = this._entries.filter((e) => e.known);
    if (known.length === 0) return 'unknown';

    const last2 = known.slice(-2);
    // Head-nod fast path: two consecutive closed-and-down samples force closed regardless
    // of the eye majority, catching a sudden nod-off before the rolling window agrees.
    if (last2.length === 2 && last2.every((e) => e.closed && e.headDown)) {
      this._state = 'closed';
      return 'closed';
    }

    const closedFrac = known.filter((e) => e.closed).length / known.length;
    if (this._state === 'closed') {
      // Wake fast path: two consecutive open samples wake even when the window still holds
      // enough recent closures to keep the majority above exitFrac. Mirrors the head-nod
      // fast path so sustained openness recovers promptly without a single blink resetting.
      const wokeUp = last2.length === 2 && last2.every((e) => !e.closed);
      if (wokeUp || closedFrac < this.p.exitFrac) this._state = 'open';
    } else if (closedFrac >= this.p.enterFrac) {
      this._state = 'closed';
    }
    return this._state;
  }

  perclos() {
    const known = this._entries.filter((e) => e.known);
    if (known.length === 0) return 0;
    return known.filter((e) => e.closed).length / known.length;
  }

  metrics() {
    return {
      avg: this._lastAvg,
      pitch: this._lastPitch,
      closedFrac: this.perclos(),
      known: this._entries.filter((e) => e.known).length,
    };
  }

  reset() {
    this._entries = [];
    this._state = 'open';
    this._lastAvg = null;
    this._lastPitch = null;
  }
}

module.exports = { DrowsinessDetector };
