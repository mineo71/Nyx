import { describe, it, expect } from 'vitest';
import { largestFaceIndex } from '../../src/core/face-select.js';

// tiny helper: a rectangular "face" of the given size
const face = (w, h) => [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: 0, y: h }, { x: w, y: h }];

describe('largestFaceIndex', () => {
  it('returns -1 for no faces', () => {
    expect(largestFaceIndex([])).toBe(-1);
    expect(largestFaceIndex(null)).toBe(-1);
  });
  it('returns 0 for a single face', () => {
    expect(largestFaceIndex([face(0.2, 0.3)])).toBe(0);
  });
  it('picks the largest (closest) face', () => {
    expect(largestFaceIndex([face(0.1, 0.1), face(0.4, 0.5), face(0.2, 0.2)])).toBe(1);
    expect(largestFaceIndex([face(0.6, 0.6), face(0.2, 0.2)])).toBe(0);
  });
  it('skips malformed entries', () => {
    expect(largestFaceIndex([[], face(0.3, 0.3)])).toBe(1);
  });
});
