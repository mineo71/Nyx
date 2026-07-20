import { describe, it, expect } from 'vitest';
import { normalizeAccent } from '../../src/core/accent.js';

describe('normalizeAccent', () => {
  it('strips the alpha from an 8-digit macOS accent hex', () => {
    expect(normalizeAccent('7C8CF8FF')).toBe('7C8CF8');
  });
  it('accepts a 6-digit hex with or without leading #', () => {
    expect(normalizeAccent('#A1B2C3')).toBe('A1B2C3');
    expect(normalizeAccent('a1b2c3')).toBe('A1B2C3');
  });
  it('defaults on empty / null / garbage', () => {
    expect(normalizeAccent('')).toBe('7C8CF8');
    expect(normalizeAccent(null)).toBe('7C8CF8');
    expect(normalizeAccent('zzz')).toBe('7C8CF8');
  });
});
