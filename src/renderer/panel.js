const dot = document.getElementById('dot');
const stateLabel = document.getElementById('stateLabel');
const statusLine = document.getElementById('statusLine');
const statusSub = document.getElementById('statusSub');
const recapTitle = document.getElementById('recapTitle');
const recapTime = document.getElementById('recapTime');
const modeSeg = document.getElementById('mode');

const STATE_COPY = {
  IDLE:       { label: 'Idle',      line: 'Idle',              sub: 'Waiting for something to play', dot: 'rgba(242,243,245,0.35)' },
  WATCHING:   { label: 'Watching',  line: 'Watching over you', sub: 'Armed by playback',             dot: 'var(--accent)' },
  DROWSY:     { label: 'Watching',  line: 'Checking on you…',  sub: 'Your eyes look closed',         dot: 'var(--accent)' },
  ESCALATING: { label: 'Nudging',   line: 'Still watching?',   sub: 'Nudging you awake',             dot: '#E0A45C' },
};

function segSet(el, value) {
  el.dataset.value = value;
  el.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.value === value));
}

function render(s) {
  const c = STATE_COPY[s.state] || STATE_COPY.IDLE;
  dot.style.background = c.dot;
  stateLabel.textContent = c.label;
  statusLine.textContent = c.line;
  statusSub.textContent = s.cameraOk === false ? 'Camera unavailable — auto-sleep off' : c.sub;
  statusSub.style.color = s.cameraOk === false ? '#E0A45C' : 'rgba(242,243,245,0.55)';
  if (s.recap) {
    recapTitle.textContent = `Paused "${s.recap.title}"`;
    recapTime.textContent = `at ${new Date(s.recap.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  } else {
    recapTitle.textContent = 'No sleep events yet';
    recapTime.textContent = '';
  }
  if (s.monitoringMode) segSet(modeSeg, s.monitoringMode);
}

modeSeg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
  segSet(modeSeg, b.dataset.value);
  window.nyx.setMonitoringMode(b.dataset.value);
}));

window.nyx.onPanelState((_e, s) => render(s));
document.getElementById('calibrate').addEventListener('click', () => window.nyx.openCalibration());
document.getElementById('settings').addEventListener('click', () => window.nyx.openSettings());
document.getElementById('quit').addEventListener('click', () => window.nyx.quit());

segSet(modeSeg, 'auto');
window.nyx.panelReady();
