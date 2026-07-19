const FINAL_ACTIONS = ['sleep', 'displayOff', 'pauseOnly'];

const DEFAULT_VIEW = {
  tAsleepSec: 90,
  nudgeWaitSec: 30,
  pauseWaitSec: 45,
  finalAction: 'sleep',
  nightHoursEnabled: false,
  nightHoursStart: 21,
  nightHoursEnd: 7,
  openAtLogin: false,
};

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clampSettingsView(view = {}) {
  const v = { ...DEFAULT_VIEW, ...view };
  return {
    tAsleepSec: clampInt(v.tAsleepSec, 5, 3600, DEFAULT_VIEW.tAsleepSec),
    nudgeWaitSec: clampInt(v.nudgeWaitSec, 5, 600, DEFAULT_VIEW.nudgeWaitSec),
    pauseWaitSec: clampInt(v.pauseWaitSec, 5, 600, DEFAULT_VIEW.pauseWaitSec),
    finalAction: FINAL_ACTIONS.includes(v.finalAction) ? v.finalAction : 'sleep',
    nightHoursEnabled: Boolean(v.nightHoursEnabled),
    nightHoursStart: clampInt(v.nightHoursStart, 0, 23, DEFAULT_VIEW.nightHoursStart),
    nightHoursEnd: clampInt(v.nightHoursEnd, 0, 23, DEFAULT_VIEW.nightHoursEnd),
    openAtLogin: Boolean(v.openAtLogin),
  };
}

module.exports = { clampSettingsView, FINAL_ACTIONS, DEFAULT_VIEW };
