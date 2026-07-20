import { describe, it, expect } from 'vitest';
import { playingApp } from '../../src/services/media-watcher.js';

describe('playingApp', () => {
  it('detects a browser video wake lock (NoDisplaySleepAssertion)', () => {
    const text = 'pid 1800(Arc): [0x0002006500058ec3] 00:02:06 NoDisplaySleepAssertion named: "Video Wake Lock"';
    expect(playingApp(text)).toBe('Arc');
  });

  it('detects a player holding PreventUserIdleDisplaySleep', () => {
    const text = 'pid 700(QuickTime Player): [0x0] 00:01:00 PreventUserIdleDisplaySleep named: "playing"';
    expect(playingApp(text)).toBe('QuickTime Player');
  });

  it('ignores system daemons that hold sleep assertions', () => {
    const text = [
      'pid 107(powerd): [0x] 09:59:31 PreventUserIdleSystemSleep named: "Powerd"',
      'pid 178(coreaudiod): [0x] 00:02:06 PreventUserIdleSystemSleep named: "output.context.preventuseridlesleep"',
      'pid 44336(caffeinate): [0x] 00:01:36 PreventUserIdleSystemSleep named: "caffeinate command-line tool"',
    ].join('\n');
    expect(playingApp(text)).toBe(null);
  });

  it('returns null when nothing is asserting display wake', () => {
    expect(playingApp('   PreventUserIdleDisplaySleep    1')).toBe(null);
    expect(playingApp('')).toBe(null);
  });

  it('picks the first non-system media owner', () => {
    const text = [
      'pid 107(powerd): [0x] PreventUserIdleSystemSleep named: "Powerd"',
      'pid 1800(Google Chrome): [0x] NoDisplaySleepAssertion named: "Video Wake Lock"',
    ].join('\n');
    expect(playingApp(text)).toBe('Google Chrome');
  });
});
