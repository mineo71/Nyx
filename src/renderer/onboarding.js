const t = window.t || ((k) => k);

const steps = Array.from(document.querySelectorAll('.onb-step'));
const camStatus = document.getElementById('camStatus');
const accStatus = document.getElementById('accStatus');
const permContinue = document.getElementById('permContinue');
let index = 0;
let permTimer = null;
let statuses = { camera: 'unknown', accessibility: false };

function show(i) {
  index = Math.max(0, Math.min(steps.length - 1, i));
  steps.forEach((s, n) => s.classList.toggle('active', n === index));
  if (index === 2) startPermPolling();
  else stopPermPolling();
}

function badge() {
  const b = document.createElement('div');
  b.className = 'grid place-items-center';
  b.style.cssText = 'width:28px;height:28px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent-line);color:var(--accent);font:600 14px var(--font)';
  b.textContent = '✓';
  return b;
}

function enableBtn(onClick) {
  const btn = document.createElement('button');
  btn.className = 'nyx-btn nyx-btn-primary';
  btn.style.padding = '8px 16px';
  btn.textContent = t('onb.perm.enable');
  btn.addEventListener('click', onClick);
  return btn;
}

function renderPerms() {
  const camOk = statuses.camera === 'granted';
  const accOk = statuses.accessibility === true;

  camStatus.replaceChildren(camOk ? badge() : enableBtn(async () => {
    statuses = await window.nyx.requestCamera();
    renderPerms();
  }));

  accStatus.replaceChildren(accOk ? badge() : enableBtn(() => window.nyx.openAccessibility()));

  permContinue.textContent = (camOk && accOk) ? t('onb.continue') : t('onb.perm.continueWhen');
}

function startPermPolling() {
  window.nyx.getPermissions().then((s) => { statuses = s; renderPerms(); });
  if (!permTimer) {
    permTimer = setInterval(async () => { statuses = await window.nyx.getPermissions(); renderPerms(); }, 1500);
  }
}

function stopPermPolling() {
  if (permTimer) { clearInterval(permTimer); permTimer = null; }
}

document.querySelectorAll('[data-next]').forEach((b) => b.addEventListener('click', () => show(index + 1)));
document.getElementById('calibrateNow').addEventListener('click', () => window.nyx.finishOnboarding({ calibrate: true }));
document.getElementById('skipCalibrate').addEventListener('click', () => window.nyx.finishOnboarding({ calibrate: false }));

window.nyx.onPermissions((_e, s) => { statuses = s; if (index === 2) renderPerms(); });
window.nyx.onboardingReady();
show(0);
