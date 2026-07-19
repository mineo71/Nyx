import { describe, it, expect } from 'vitest';
import { DEFAULTS, isWithinNightHours } from '../../src/core/config.js';

describe('config', () => {
  it('exposes sane defaults', () => {
    expect(DEFAULTS.tAsleepMs).toBe(90000);
    expect(DEFAULTS.intervals.baselineMs).toBe(60000);
    expect(DEFAULTS.intervals.confirmMs).toBe(2000);
    expect(DEFAULTS.finalAction).toBe('sleep');
    expect(DEFAULTS.ladder).toHaveLength(4);
    expect(DEFAULTS.ladder[3].action).toBe('final');
    expect(DEFAULTS.nightHours.enabled).toBe(false);
  });

  it('is always within hours when the gate is disabled', () => {
    expect(isWithinNightHours({ enabled: false, start: 21, end: 7 }, 12)).toBe(true);
  });

  it('handles an overnight window that wraps past midnight', () => {
    const nh = { enabled: true, start: 21, end: 7 };
    expect(isWithinNightHours(nh, 22)).toBe(true);
    expect(isWithinNightHours(nh, 2)).toBe(true);
    expect(isWithinNightHours(nh, 7)).toBe(false);
    expect(isWithinNightHours(nh, 13)).toBe(false);
  });

  it('handles a same-day window', () => {
    const nh = { enabled: true, start: 1, end: 5 };
    expect(isWithinNightHours(nh, 3)).toBe(true);
    expect(isWithinNightHours(nh, 6)).toBe(false);
  });

  it('includes the start boundary of a same-day window', () => {
    expect(isWithinNightHours({ enabled: true, start: 1, end: 5 }, 1)).toBe(true);
  });
});
