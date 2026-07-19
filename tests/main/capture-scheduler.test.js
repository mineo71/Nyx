import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CaptureScheduler } from '../../src/main/capture-scheduler.js';

const INTERVALS = { baselineMs: 60000, confirmMs: 2000 };

function makeScheduler(state) {
  const wc = { send: vi.fn() };
  const s = new CaptureScheduler({ detectorWebContents: wc, getState: () => state, intervals: INTERVALS });
  return { s, wc };
}

describe('CaptureScheduler.cadenceFor', () => {
  it('maps states to cadences', () => {
    const { s } = makeScheduler('IDLE');
    expect(s.cadenceFor('WATCHING')).toBe(60000);
    expect(s.cadenceFor('DROWSY')).toBe(2000);
    expect(s.cadenceFor('ESCALATING')).toBe(2000);
    expect(s.cadenceFor('IDLE')).toBe(null);
  });
});

describe('CaptureScheduler tick loop', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('never captures while IDLE', () => {
    const { s, wc } = makeScheduler('IDLE');
    s.start();
    vi.advanceTimersByTime(100000);
    s.stop();
    expect(wc.send).not.toHaveBeenCalled();
  });

  it('captures once per baseline window while WATCHING', () => {
    const { s, wc } = makeScheduler('WATCHING');
    s.start();
    vi.advanceTimersByTime(60000); // first capture lands at the 60s tick
    s.stop();
    expect(wc.send).toHaveBeenCalledTimes(1);
    expect(wc.send).toHaveBeenCalledWith('nyx:capture');
  });

  it('captures every confirm tick while DROWSY', () => {
    const { s, wc } = makeScheduler('DROWSY');
    s.start();
    vi.advanceTimersByTime(6000); // ticks at 2s,4s,6s -> 3 captures
    s.stop();
    expect(wc.send).toHaveBeenCalledTimes(3);
  });

  it('stops capturing after stop()', () => {
    const { s, wc } = makeScheduler('DROWSY');
    s.start();
    vi.advanceTimersByTime(2000); // 1 capture
    s.stop();
    vi.advanceTimersByTime(10000);
    expect(wc.send).toHaveBeenCalledTimes(1);
  });
});
