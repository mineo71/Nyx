import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EscalationEngine } from '../../src/core/escalation-engine.js';

const LADDER = [
  { action: 'nudge', level: 'soft', waitMs: 30000 },
  { action: 'pauseAndNudge', level: 'soft', waitMs: 45000 },
  { action: 'nudge', level: 'loud', waitMs: 30000 },
  { action: 'final', waitMs: 0 },
];

function makeActions() {
  return { nudge: vi.fn(), pause: vi.fn(), sleep: vi.fn(), displayOff: vi.fn() };
}

describe('EscalationEngine', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs the first nudge immediately on start', () => {
    const actions = makeActions();
    const engine = new EscalationEngine({ ladder: LADDER, actions, finalAction: 'sleep' });
    engine.start();
    expect(actions.nudge).toHaveBeenCalledWith('soft');
    expect(actions.pause).not.toHaveBeenCalled();
  });

  it('advances through the ladder and sleeps at the end', () => {
    const actions = makeActions();
    const onComplete = vi.fn();
    const engine = new EscalationEngine({ ladder: LADDER, actions, finalAction: 'sleep', onComplete });
    engine.start();
    vi.advanceTimersByTime(30000);
    expect(actions.pause).toHaveBeenCalledOnce();
    expect(actions.nudge).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(45000);
    expect(actions.nudge).toHaveBeenCalledWith('loud');
    vi.advanceTimersByTime(30000);
    expect(actions.sleep).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('does not sleep if cancelled before the final step', () => {
    const actions = makeActions();
    const engine = new EscalationEngine({ ladder: LADDER, actions, finalAction: 'sleep' });
    engine.start();
    vi.advanceTimersByTime(30000);
    engine.cancel();
    vi.advanceTimersByTime(600000);
    expect(actions.sleep).not.toHaveBeenCalled();
  });

  it('cancel() is a safe no-op when not running', () => {
    const actions = makeActions();
    const engine = new EscalationEngine({ ladder: LADDER, actions, finalAction: 'sleep' });
    expect(() => engine.cancel()).not.toThrow();
  });

  it('honors displayOff as the final action', () => {
    const actions = makeActions();
    const engine = new EscalationEngine({ ladder: LADDER, actions, finalAction: 'displayOff' });
    engine.start();
    vi.advanceTimersByTime(30000 + 45000 + 30000);
    expect(actions.displayOff).toHaveBeenCalledOnce();
    expect(actions.sleep).not.toHaveBeenCalled();
  });

  it('pauseOnly final action pauses and does nothing else', () => {
    const actions = makeActions();
    const engine = new EscalationEngine({ ladder: LADDER, actions, finalAction: 'pauseOnly' });
    engine.start();
    vi.advanceTimersByTime(30000 + 45000 + 30000);
    expect(actions.sleep).not.toHaveBeenCalled();
    expect(actions.displayOff).not.toHaveBeenCalled();
  });
});
