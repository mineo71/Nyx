import { describe, it, expect } from 'vitest';
import { DrowsinessDetector } from '../../src/core/drowsiness-detector.js';

const PARAMS = { windowMs: 12000, enterFrac: 0.6, exitFrac: 0.4, headDownDeg: -12 };
function make() {
  return new DrowsinessDetector({ getThreshold: () => 0.5, params: PARAMS });
}
const OPEN = { left: 0.1, right: 0.1 };
const CLOSED = { left: 0.9, right: 0.9 };
const CLOSED_DOWN = { left: 0.9, right: 0.9, pitch: -20 };

describe('DrowsinessDetector', () => {
  it('starts open and returns unknown with no face samples', () => {
    const d = make();
    d.update(null, 0);
    expect(d.classify()).toBe('unknown');
  });

  it('does not flip to closed on an isolated blink', () => {
    const d = make();
    d.update(OPEN, 0); d.update(CLOSED, 4000); d.update(OPEN, 8000);
    expect(d.classify()).toBe('open');
  });

  it('flips to closed on sustained closure', () => {
    const d = make();
    d.update(CLOSED, 0); d.update(CLOSED, 4000); d.update(CLOSED, 8000);
    expect(d.classify()).toBe('closed');
  });

  it('does not reset on a single stray open during closure', () => {
    const d = make();
    d.update(CLOSED, 0); d.update(CLOSED, 4000); d.update(CLOSED, 8000);
    expect(d.classify()).toBe('closed');
    d.update(OPEN, 10000);
    expect(d.classify()).toBe('closed');
  });

  it('wakes to open on sustained open', () => {
    const d = make();
    d.update(CLOSED, 0); d.update(CLOSED, 2000); d.update(CLOSED, 4000);
    expect(d.classify()).toBe('closed');
    d.update(OPEN, 6000); d.update(OPEN, 8000); d.update(OPEN, 10000);
    expect(d.classify()).toBe('open');
  });

  it('preserves state and returns unknown when the window has no known samples', () => {
    const d = make();
    d.update(CLOSED, 0); d.update(CLOSED, 4000); d.update(CLOSED, 8000);
    expect(d.classify()).toBe('closed');
    d.update(null, 20000);
    expect(d.classify()).toBe('unknown');
  });

  it('head-nod fast path forces closed even when eye majority says open', () => {
    const d = make();
    d.update(OPEN, 0); d.update(OPEN, 1000); d.update(OPEN, 2000);
    d.update(CLOSED_DOWN, 3000); d.update(CLOSED_DOWN, 4000);
    expect(d.classify()).toBe('closed');
  });

  it('drops entries older than the time window', () => {
    const d = make();
    d.update(CLOSED, 0);
    d.update(OPEN, 20000);
    expect(d.classify()).toBe('open');
  });

  it('reset clears state', () => {
    const d = make();
    d.update(CLOSED, 0); d.update(CLOSED, 4000); d.update(CLOSED, 8000);
    expect(d.classify()).toBe('closed');
    d.reset();
    expect(d.classify()).toBe('unknown');
  });

  it('exposes perclos and metrics', () => {
    const d = make();
    d.update(OPEN, 0); d.update(CLOSED, 4000);
    expect(d.perclos()).toBeCloseTo(0.5, 5);
    const m = d.metrics();
    expect(m.closedFrac).toBeCloseTo(0.5, 5);
    expect(m.known).toBe(2);
    expect(m.avg).toBeCloseTo(0.9, 5);
  });
});
