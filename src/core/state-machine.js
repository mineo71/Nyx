const { isWithinNightHours } = require('./config.js');

class SleepStateMachine {
  constructor({ config, clock, on, nowHour }) {
    this.config = config;
    this.clock = clock;                       // { now(): ms }
    this.on = { arm() {}, disarm() {}, escalate() {}, deescalate() {}, ...on };
    this.nowHour = nowHour || (() => 0);      // injected: current local hour 0-23
    this.state = 'IDLE';
    this._closedSince = null;                 // ms timestamp DROWSY entered
  }

  mediaPlaying() {
    if (this.state !== 'IDLE') return;
    if (!isWithinNightHours(this.config.nightHours, this.nowHour())) return;
    this.state = 'WATCHING';
    this.on.arm();
  }

  mediaStopped() {
    if (this.state === 'IDLE') return;
    const wasEscalating = this.state === 'ESCALATING';
    this._reset();
    this.state = 'IDLE';
    this.on.disarm();
    if (wasEscalating) this.on.deescalate();
  }

  frame(classification) {
    if (this.state === 'WATCHING') {
      if (classification === 'closed') {
        this.state = 'DROWSY';
        this._closedSince = this.clock.now();
      }
      return;
    }
    if (this.state === 'DROWSY' || this.state === 'ESCALATING') {
      if (classification === 'open') this._wake();
      // 'closed' and 'unknown' hold the current state
    }
  }

  input() {
    if (this.state === 'DROWSY' || this.state === 'ESCALATING') this._wake();
  }

  tick() {
    if (this.state !== 'DROWSY') return;
    if (this.clock.now() - this._closedSince >= this.config.tAsleepMs) {
      this.state = 'ESCALATING';
      this.on.escalate();
    }
  }

  slept() {
    this._reset();
    this.state = 'IDLE';
  }

  _wake() {
    this._closedSince = null;
    this.state = 'WATCHING';
    this.on.deescalate();
  }

  _reset() {
    this._closedSince = null;
  }
}

module.exports = { SleepStateMachine };
