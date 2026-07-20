const t = window.t || ((k) => k);

const dot = document.getElementById('dot');
const stateLabel = document.getElementById('stateLabel');
const statusLine = document.getElementById('statusLine');
const statusSub = document.getElementById('statusSub');
const recapTitle = document.getElementById('recapTitle');
const recapTime = document.getElementById('recapTime');
const modeSeg = document.getElementById('mode');
const orb = document.getElementById('orb');

function setOrb(state, cameraOk) {
  if (!orb) return;
  const warm = state === 'ESCALATING';
  const idle = state === 'IDLE' || cameraOk === false;
  orb.classList.toggle('nyx-orb--warm', warm);
  orb.classList.toggle('nyx-orb--idle', idle && !warm);
}

function copyFor(state) {
  const map = {
    IDLE:       { label: t('state.idle.label'), line: t('state.idle.line'), sub: t('state.idle.sub'), dot: 'rgba(242,243,245,0.35)' },
    WATCHING:   { label: t('state.watching.label'), line: t('state.watching.line'), sub: t('state.watching.sub'), dot: 'var(--accent)' },
    DROWSY:     { label: t('state.drowsy.label'), line: t('state.drowsy.line'), sub: t('state.drowsy.sub'), dot: 'var(--accent)' },
    ESCALATING: { label: t('state.escalating.label'), line: t('state.escalating.line'), sub: t('state.escalating.sub'), dot: '#E0A45C' },
  };
  return map[state] || map.IDLE;
}

function segSet(el, value) {
  el.dataset.value = value;
  el.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.value === value));
}

function render(s) {
  const c = copyFor(s.state);
  dot.style.background = c.dot;
  setOrb(s.state, s.cameraOk);
  stateLabel.textContent = c.label;
  statusLine.textContent = c.line;
  statusSub.textContent = s.cameraOk === false ? t('state.cameraOff') : c.sub;
  statusSub.style.color = s.cameraOk === false ? '#E0A45C' : 'rgba(242,243,245,0.55)';
  if (s.recap) {
    recapTitle.textContent = `${t('panel.paused')} "${s.recap.title}"`;
    recapTime.textContent = `${t('panel.at')} ${new Date(s.recap.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  } else {
    recapTitle.textContent = t('panel.noEvents');
    recapTime.textContent = '';
  }
  if (s.monitoringMode) segSet(modeSeg, s.monitoringMode);
  renderNowPlaying(s.nowPlaying);
  renderWatch(s);
}

const watchBtn = document.getElementById('watchToggle');
function renderWatch(s) {
  if (!watchBtn) return;
  if (s.state === 'IDLE') { watchBtn.style.display = ''; watchBtn.textContent = t('watch.start'); }
  else if (s.manualArm) { watchBtn.style.display = ''; watchBtn.textContent = t('watch.stop'); }
  else { watchBtn.style.display = 'none'; } // auto-armed by playback
}
if (watchBtn) watchBtn.addEventListener('click', () => window.nyx.toggleWatch());

const npRow = document.getElementById('npRow');
function renderNowPlaying(np) {
  if (!npRow) return;
  if (np && np.title) {
    npRow.style.display = 'block';
    document.getElementById('npTitle').textContent = np.title;
    document.getElementById('npApp').textContent = np.app || '';
  } else {
    npRow.style.display = 'none';
  }
}

modeSeg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
  segSet(modeSeg, b.dataset.value);
  window.nyx.setMonitoringMode(b.dataset.value);
}));

// Resize the popover window to hug its content (handles longer translated strings too).
function syncHeight() {
  requestAnimationFrame(() => {
    const h = Math.ceil(document.body.getBoundingClientRect().height);
    if (h > 0) window.nyx.setPanelHeight(h);
  });
}

window.nyx.onPanelState((_e, s) => { render(s); syncHeight(); });
document.getElementById('calibrate').addEventListener('click', () => window.nyx.openCalibration());
document.getElementById('settings').addEventListener('click', () => window.nyx.openSettings());
document.getElementById('quit').addEventListener('click', () => window.nyx.quit());

segSet(modeSeg, 'auto');
window.nyx.panelReady();
syncHeight();
