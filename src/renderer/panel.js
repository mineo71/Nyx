const dot = document.getElementById('dot');
const stateLabel = document.getElementById('stateLabel');
const statusLine = document.getElementById('statusLine');
const statusSub = document.getElementById('statusSub');
const recapTitle = document.getElementById('recapTitle');
const recapTime = document.getElementById('recapTime');
const modeSelect = document.getElementById('mode');

const STATE_COPY = {
  IDLE:       { label: 'Idle',      line: 'Idle',                sub: 'Waiting for something to play', dot: 'var(--dot-idle)' },
  WATCHING:   { label: 'Watching',  line: 'Watching over you',   sub: 'Armed by playback',             dot: 'var(--dot-watch)' },
  DROWSY:     { label: 'Watching',  line: 'Checking on you…',    sub: 'Your eyes look closed',         dot: 'var(--dot-watch)' },
  ESCALATING: { label: 'Nudging',   line: 'Still watching?',     sub: 'Nudging you awake',             dot: 'var(--dot-escalate)' },
};

function render(s) {
  const c = STATE_COPY[s.state] || STATE_COPY.IDLE;
  dot.style.background = c.dot;
  stateLabel.textContent = c.label;
  statusLine.textContent = c.line;
  statusSub.textContent = s.cameraOk === false ? 'Camera unavailable — auto-sleep off' : c.sub;
  statusSub.style.color = s.cameraOk === false ? 'var(--warn)' : 'var(--muted)';
  if (s.recap) {
    recapTitle.textContent = `Paused "${s.recap.title}"`;
    recapTime.textContent = `at ${new Date(s.recap.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  } else {
    recapTitle.textContent = 'No sleep events yet';
    recapTime.textContent = '';
  }
  if (s.monitoringMode) modeSelect.value = s.monitoringMode;
}

window.nyx.onPanelState((_e, s) => render(s));
modeSelect.addEventListener('change', () => window.nyx.setMonitoringMode(modeSelect.value));
document.getElementById('calibrate').addEventListener('click', () => window.nyx.openCalibration());
document.getElementById('settings').addEventListener('click', () => window.nyx.openSettings());
document.getElementById('quit').addEventListener('click', () => window.nyx.quit());

window.nyx.panelReady();
