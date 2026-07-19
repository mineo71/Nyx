import { describe, it, expect } from 'vitest';
import { playingApp } from '../../src/services/media-watcher.js';

describe('playingApp', () => {
  it('returns null when no assertion lines mention a media app', () => {
    const text = 'pid 111(loginwindow): PreventUserIdleDisplaySleep named: "unrelated"';
    expect(playingApp(text)).toBe(null);
  });

  it('detects a browser holding a display-sleep assertion', () => {
    const text = [
      'Assertion status system-wide:',
      '   PreventUserIdleDisplaySleep    1',
      '   pid 501(Google Chrome): PreventUserIdleDisplaySleep named: "playing video"',
    ].join('\n');
    expect(playingApp(text)).toBe('chrome');
  });

  it('detects QuickTime', () => {
    const text = 'pid 700(QuickTime Player): PreventUserIdleSystemSleep named: "QuickTime Playing"';
    expect(playingApp(text)).toBe('quicktime');
  });

  it('ignores assertions that are not idle-sleep prevention', () => {
    const text = 'pid 900(VLC): SomeOtherAssertion named: "x"';
    expect(playingApp(text)).toBe(null);
  });
});
