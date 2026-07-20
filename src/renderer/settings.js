const NUM_KEYS = ['tAsleepSec', 'nudgeWaitSec', 'pauseWaitSec', 'nightHoursStart', 'nightHoursEnd'];
const BOOL_KEYS = ['nightHoursEnabled', 'openAtLogin', 'logDetection'];
const finalActionSeg = document.getElementById('finalAction');
const languageSeg = document.getElementById('language');

function segSet(el, value) {
  el.dataset.value = value;
  el.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.value === value));
}

function fill(view) {
  NUM_KEYS.forEach((k) => { document.getElementById(k).value = view[k]; });
  BOOL_KEYS.forEach((k) => { document.getElementById(k).checked = view[k]; });
  segSet(finalActionSeg, view.finalAction);
  segSet(languageSeg, view.language);
  document.getElementById('threshold').textContent = (view.eyeCloseThreshold ?? 0).toFixed(2);
}

async function save(key, value) {
  const stored = await window.nyx.setSetting(key, value);
  fill(stored);
}

function wireSteppers() {
  document.querySelectorAll('.nyx-stepper').forEach((stepper) => {
    const input = stepper.querySelector('input');
    const min = Number(stepper.dataset.min);
    const max = Number(stepper.dataset.max);
    stepper.querySelectorAll('button[data-step]').forEach((btn) => btn.addEventListener('click', () => {
      const next = Math.max(min, Math.min(max, Number(input.value) + Number(btn.dataset.step)));
      input.value = next;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }));
  });
}

async function init() {
  fill(await window.nyx.getSettings());
  NUM_KEYS.forEach((k) => document.getElementById(k).addEventListener('change', (e) => save(k, Number(e.target.value))));
  BOOL_KEYS.forEach((k) => document.getElementById(k).addEventListener('change', (e) => save(k, e.target.checked)));
  finalActionSeg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => save('finalAction', b.dataset.value)));
  languageSeg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => save('language', b.dataset.value)));
  wireSteppers();
  document.getElementById('recalibrate').addEventListener('click', () => window.nyx.openCalibration());
  document.getElementById('revealLog').addEventListener('click', () => window.nyx.revealLog());
}

init();
