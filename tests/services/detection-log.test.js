import { describe, it, expect } from 'vitest';
import { truncateTail } from '../../src/services/detection-log.js';

describe('truncateTail', () => {
  it('returns text unchanged when under the byte cap', () => {
    const t = 'a\nb\nc\n';
    expect(truncateTail(t, 1000)).toBe(t);
  });

  it('trims to a tail starting after a newline when over the cap', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line${i}`).join('\n') + '\n';
    const out = truncateTail(lines, 200);
    expect(Buffer.byteLength(out)).toBeLessThan(Buffer.byteLength(lines));
    expect(out.startsWith('line')).toBe(true);
    expect(lines.endsWith(out)).toBe(true);
  });
});
