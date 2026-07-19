import { describe, it, expect } from 'vitest';
import { classifyEyes, computeThreshold } from '../../src/core/detector-logic.js';

describe('classifyEyes', () => {
  it('returns unknown when no face sample', () => {
    expect(classifyEyes(null, 0.5)).toBe('unknown');
  });

  it('classifies closed when average score >= threshold', () => {
    expect(classifyEyes({ left: 0.8, right: 0.7 }, 0.5)).toBe('closed');
  });

  it('classifies open when average score < threshold', () => {
    expect(classifyEyes({ left: 0.1, right: 0.2 }, 0.5)).toBe('open');
  });

  it('treats a partial sample (one eye missing) as unknown', () => {
    expect(classifyEyes({ left: 0.9, right: null }, 0.5)).toBe('unknown');
  });
});

describe('computeThreshold', () => {
  it('returns the midpoint between mean-open and mean-closed', () => {
    const open = [{ left: 0.1, right: 0.1 }, { left: 0.2, right: 0.2 }];
    const closed = [{ left: 0.8, right: 0.9 }, { left: 0.9, right: 0.8 }];
    expect(computeThreshold(open, closed)).toBeCloseTo(0.5, 5);
  });

  it('throws when either sample set is empty', () => {
    expect(() => computeThreshold([], [{ left: 0.9, right: 0.9 }])).toThrow();
  });
});
