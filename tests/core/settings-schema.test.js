import { describe, it, expect } from 'vitest';
import { clampSettingsView, FINAL_ACTIONS, DEFAULT_VIEW } from '../../src/core/settings-schema.js';

describe('clampSettingsView', () => {
  it('passes through valid values unchanged', () => {
    const v = { tAsleepSec: 90, nudgeWaitSec: 30, pauseWaitSec: 45, finalAction: 'sleep',
      nightHoursEnabled: true, nightHoursStart: 21, nightHoursEnd: 7, openAtLogin: false,
      logDetection: true, language: 'auto' };
    expect(clampSettingsView(v)).toEqual(v);
  });

  it('clamps numbers into range and rounds', () => {
    const v = clampSettingsView({ tAsleepSec: 2, nudgeWaitSec: 9999, pauseWaitSec: 3.7 });
    expect(v.tAsleepSec).toBe(5);
    expect(v.nudgeWaitSec).toBe(600);
    expect(v.pauseWaitSec).toBe(5);
  });

  it('falls back to sleep for an unknown finalAction', () => {
    expect(clampSettingsView({ finalAction: 'explode' }).finalAction).toBe('sleep');
    expect(FINAL_ACTIONS).toContain('displayOff');
  });

  it('clamps night hours to 0..23 and coerces booleans', () => {
    const v = clampSettingsView({ nightHoursStart: 30, nightHoursEnd: -3, nightHoursEnabled: 1, openAtLogin: 0 });
    expect(v.nightHoursStart).toBe(23);
    expect(v.nightHoursEnd).toBe(0);
    expect(v.nightHoursEnabled).toBe(true);
    expect(v.openAtLogin).toBe(false);
  });

  it('fills missing keys from DEFAULT_VIEW', () => {
    const v = clampSettingsView({});
    expect(v).toEqual(DEFAULT_VIEW);
  });

  it('defaults logDetection to true and coerces it to boolean', () => {
    expect(clampSettingsView({}).logDetection).toBe(true);
    expect(clampSettingsView({ logDetection: 0 }).logDetection).toBe(false);
    expect(clampSettingsView({ logDetection: 1 }).logDetection).toBe(true);
  });

  it('clamps language to auto/en/uk', () => {
    expect(clampSettingsView({}).language).toBe('auto');
    expect(clampSettingsView({ language: 'uk' }).language).toBe('uk');
    expect(clampSettingsView({ language: 'zz' }).language).toBe('auto');
  });
});
