import { describe, it, expect, vi } from 'vitest';
import { SleepStateMachine } from '../../src/core/state-machine.js';

function makeMachine(overrides = {}) {
  let t = 0;
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const on = { arm: vi.fn(), disarm: vi.fn(), escalate: vi.fn(), deescalate: vi.fn() };
  const config = { tAsleepMs: 90000, nightHours: { enabled: false } };
  const m = new SleepStateMachine({ config, clock, on, nowHour: () => 23, ...overrides });
  return { m, on, clock };
}

describe('SleepStateMachine', () => {
  it('starts IDLE', () => {
    const { m } = makeMachine();
    expect(m.state).toBe('IDLE');
  });

  it('arms to WATCHING when media plays', () => {
    const { m, on } = makeMachine();
    m.mediaPlaying();
    expect(m.state).toBe('WATCHING');
    expect(on.arm).toHaveBeenCalledOnce();
  });

  it('forceArm arms from IDLE even outside night hours', () => {
    const { m, on } = makeMachine({
      config: { tAsleepMs: 90000, nightHours: { enabled: true, start: 21, end: 7 } },
      nowHour: () => 13,
    });
    m.forceArm();
    expect(m.state).toBe('WATCHING');
    expect(on.arm).toHaveBeenCalledOnce();
  });

  it('forceArm is a no-op when not IDLE', () => {
    const { m, on } = makeMachine();
    m.mediaPlaying();
    on.arm.mockClear();
    m.forceArm();
    expect(on.arm).not.toHaveBeenCalled();
  });

  it('does not arm outside night hours when the gate is enabled', () => {
    const { m, on } = makeMachine({
      config: { tAsleepMs: 90000, nightHours: { enabled: true, start: 21, end: 7 } },
      nowHour: () => 13,
    });
    m.mediaPlaying();
    expect(m.state).toBe('IDLE');
    expect(on.arm).not.toHaveBeenCalled();
  });

  it('disarms back to IDLE when media stops', () => {
    const { m, on } = makeMachine();
    m.mediaPlaying();
    m.mediaStopped();
    expect(m.state).toBe('IDLE');
    expect(on.disarm).toHaveBeenCalledOnce();
  });

  it('goes WATCHING -> DROWSY on a closed frame', () => {
    const { m } = makeMachine();
    m.mediaPlaying();
    m.frame('closed');
    expect(m.state).toBe('DROWSY');
  });

  it('resets DROWSY -> WATCHING on an open frame', () => {
    const { m } = makeMachine();
    m.mediaPlaying();
    m.frame('closed');
    m.frame('open');
    expect(m.state).toBe('WATCHING');
  });

  it('escalates after tAsleepMs of continuous closed eyes', () => {
    const { m, on, clock } = makeMachine();
    m.mediaPlaying();
    m.frame('closed');
    clock.advance(89000);
    m.tick();
    expect(m.state).toBe('DROWSY');
    clock.advance(2000);
    m.tick();
    expect(m.state).toBe('ESCALATING');
    expect(on.escalate).toHaveBeenCalledOnce();
  });

  it('unknown frames do NOT advance toward sleep from WATCHING', () => {
    const { m } = makeMachine();
    m.mediaPlaying();
    m.frame('unknown');
    expect(m.state).toBe('WATCHING');
  });

  it('cancels escalation on input and returns to WATCHING', () => {
    const { m, on, clock } = makeMachine();
    m.mediaPlaying();
    m.frame('closed');
    clock.advance(91000);
    m.tick();
    expect(m.state).toBe('ESCALATING');
    m.input();
    expect(m.state).toBe('WATCHING');
    expect(on.deescalate).toHaveBeenCalledOnce();
  });

  it('cancels escalation on an open frame', () => {
    const { m, on, clock } = makeMachine();
    m.mediaPlaying();
    m.frame('closed');
    clock.advance(91000);
    m.tick();
    m.frame('open');
    expect(m.state).toBe('WATCHING');
    expect(on.deescalate).toHaveBeenCalledOnce();
  });

  it('goes to IDLE after slept()', () => {
    const { m } = makeMachine();
    m.mediaPlaying();
    m.frame('closed');
    m.slept();
    expect(m.state).toBe('IDLE');
  });

  it('input during DROWSY resets to WATCHING', () => {
    const { m } = makeMachine();
    m.mediaPlaying();
    m.frame('closed');
    m.input();
    expect(m.state).toBe('WATCHING');
  });

  it('disarms AND deescalates when media stops during DROWSY', () => {
    const { m, on } = makeMachine();
    m.mediaPlaying();
    m.frame('closed');            // now DROWSY
    m.mediaStopped();
    expect(m.state).toBe('IDLE');
    expect(on.disarm).toHaveBeenCalledOnce();
    expect(on.deescalate).toHaveBeenCalledOnce();
  });

  it('slept() disarms so the integration can tear down', () => {
    const { m, on } = makeMachine();
    m.mediaPlaying();
    m.frame('closed');
    m.slept();
    expect(m.state).toBe('IDLE');
    expect(on.disarm).toHaveBeenCalledTimes(1);
  });
});
