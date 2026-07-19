const NUM_KEYS = ['tAsleepSec', 'nudgeWaitSec', 'pauseWaitSec', 'nightHoursStart', 'nightHoursEnd'];
const BOOL_KEYS = ['nightHoursEnabled', 'openAtLogin', 'logDetection'];
const SELECT_KEYS = ['finalAction'];

function fill(view) {
  NUM_KEYS.forEach((k) => { document.getElementById(k).value = view[k]; });
  BOOL_KEYS.forEach((k) => { document.getElementById(k).checked = view[k]; });
  SELECT_KEYS.forEach((k) => { document.getElementById(k).value = view[k]; });
  document.getElementById('threshold').textContent = (view.eyeCloseThreshold ?? 0).toFixed(2);
}

async function save(key, value) {
  const stored = await window.nyx.setSetting(key, value);
  fill(stored);
}

async function init() {
  fill(await window.nyx.getSettings());
  NUM_KEYS.forEach((k) => document.getElementById(k).addEventListener('change', (e) => save(k, Number(e.target.value))));
  BOOL_KEYS.forEach((k) => document.getElementById(k).addEventListener('change', (e) => save(k, e.target.checked)));
  SELECT_KEYS.forEach((k) => document.getElementById(k).addEventListener('change', (e) => save(k, e.target.value)));
  document.getElementById('recalibrate').addEventListener('click', () => window.nyx.openCalibration());
  document.getElementById('revealLog').addEventListener('click', () => window.nyx.revealLog());
}

init();
