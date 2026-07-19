import { describe, it, expect } from 'vitest';
import { pitchFromMatrix } from '../../src/core/head-pose.js';

function rotX(deg) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return [
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ];
}

describe('pitchFromMatrix', () => {
  it('returns 0 for identity', () => {
    expect(pitchFromMatrix(rotX(0))).toBeCloseTo(0, 4);
  });
  it('extracts a positive X rotation', () => {
    expect(pitchFromMatrix(rotX(20))).toBeCloseTo(20, 3);
  });
  it('extracts a negative X rotation', () => {
    expect(pitchFromMatrix(rotX(-15))).toBeCloseTo(-15, 3);
  });
  it('returns null for missing or wrong-length input', () => {
    expect(pitchFromMatrix(null)).toBe(null);
    expect(pitchFromMatrix([1, 2, 3])).toBe(null);
    expect(pitchFromMatrix('nope')).toBe(null);
  });
});
