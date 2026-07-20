import { describe, it, expect } from 'vitest';
import { isNewer, pickRelease, parseVersion } from '../../src/core/update-check.js';

describe('isNewer', () => {
  it('detects a higher version', () => {
    expect(isNewer('0.2.0', '0.1.0')).toBe(true);
    expect(isNewer('1.0.0', '0.9.9')).toBe(true);
    expect(isNewer('0.1.1', '0.1.0')).toBe(true);
  });
  it('is false for equal or older', () => {
    expect(isNewer('0.1.0', '0.1.0')).toBe(false);
    expect(isNewer('0.1.0', '0.2.0')).toBe(false);
    expect(isNewer('0.9.9', '1.0.0')).toBe(false);
  });
  it('tolerates a leading v and missing segments', () => {
    expect(isNewer('v0.2', '0.1.9')).toBe(true);
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(isNewer('', '0.1.0')).toBe(false);
  });
});

describe('pickRelease', () => {
  it('extracts version + dmg asset url', () => {
    const r = pickRelease({
      tag_name: 'v0.2.0',
      html_url: 'https://github.com/mineo71/Nyx/releases/tag/v0.2.0',
      assets: [
        { name: 'Nyx-0.2.0-arm64-mac.zip', browser_download_url: 'https://z' },
        { name: 'Nyx-0.2.0-arm64.dmg', browser_download_url: 'https://d' },
      ],
    });
    expect(r).toEqual({ version: '0.2.0', url: 'https://github.com/mineo71/Nyx/releases/tag/v0.2.0', dmgUrl: 'https://d' });
  });
  it('returns null on a malformed payload', () => {
    expect(pickRelease(null)).toBe(null);
    expect(pickRelease({})).toBe(null);
  });
  it('handles a release with no dmg asset', () => {
    expect(pickRelease({ tag_name: '0.3.0', assets: [] })).toEqual({ version: '0.3.0', url: null, dmgUrl: null });
  });
});
