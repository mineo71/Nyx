const DEFAULTS = {
  nightHours: { enabled: false, start: 21, end: 7 }, // 24h clock; [start, end)
  intervals: { baselineMs: 60000, confirmMs: 2000 },
  tAsleepMs: 90000,            // continuous eyes-closed before escalating
  finalAction: 'sleep',        // 'sleep' | 'displayOff' | 'pauseOnly'
  eyeCloseThreshold: 0.5,      // avg blink blendshape >= this => eyes closed
  ladder: [
    { action: 'nudge', level: 'soft', waitMs: 30000 },
    { action: 'pauseAndNudge', level: 'soft', waitMs: 45000 },
    { action: 'nudge', level: 'loud', waitMs: 30000 },
    { action: 'final', waitMs: 0 },
  ],
};

function isWithinNightHours(nightHours, hour) {
  if (!nightHours.enabled) return true;
  const { start, end } = nightHours;
  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;   // same-day window
  return hour >= start || hour < end;                     // wraps midnight
}

module.exports = { DEFAULTS, isWithinNightHours };
