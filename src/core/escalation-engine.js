class EscalationEngine {
  constructor({ ladder, actions, finalAction, onComplete }) {
    this.ladder = ladder;
    this.actions = actions;         // { nudge(level), pause(), sleep(), displayOff() }
    this.finalAction = finalAction; // 'sleep' | 'displayOff' | 'pauseOnly'
    this.onComplete = onComplete || (() => {});
    this._timer = null;
    this._index = -1;
    this._running = false;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._index = -1;
    this._advance();
  }

  cancel() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
    this._running = false;
    this._index = -1;
  }

  _advance() {
    if (!this._running) return;
    this._index += 1;
    const step = this.ladder[this._index];
    if (!step) { this._finish(); return; }

    switch (step.action) {
      case 'nudge':
        this.actions.nudge(step.level, step.waitMs);
        break;
      case 'pauseAndNudge':
        this.actions.pause();
        this.actions.nudge(step.level, step.waitMs);
        break;
      case 'final':
        this._runFinal();
        this._finish();
        return;
      default:
        break;
    }
    this._timer = setTimeout(() => this._advance(), step.waitMs);
  }

  _runFinal() {
    if (this.finalAction === 'sleep') this.actions.sleep();
    else if (this.finalAction === 'displayOff') this.actions.displayOff();
    // 'pauseOnly': playback was already paused earlier in the ladder; nothing more.
  }

  _finish() {
    this._running = false;
    this._timer = null;
    this.onComplete();
  }
}

module.exports = { EscalationEngine };
