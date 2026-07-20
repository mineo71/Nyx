const dot = document.getElementById('dot');
const stateLabel = document.getElementById('stateLabel');
const statusLine = document.getElementById('statusLine');
const statusSub = document.getElementById('statusSub');
const modeSeg = document.getElementById('mode');
const recapsEl = document.getElementById('recaps');

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

function renderState(s) {
  const c = STATE_COPY[s.state] || STATE_COPY.IDLE;
  dot.style.background = c.dot;
  stateLabel.textContent = c.label;
  statusLine.textContent = c.line;
  statusSub.textContent = s.cameraOk === false ? 'Camera unavailable — auto-sleep off' : c.sub;
  statusSub.style.color = s.cameraOk === false ? '#E0A45C' : 'rgba(242,243,245,0.55)';
  if (s.monitoringMode) segSet(modeSeg, s.monitoringMode);
}

async function renderRecaps() {
  const list = await window.nyx.getRecaps();
  recapsEl.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'nyx-muted';
    li.textContent = 'No sleep events yet';
    recapsEl.appendChild(li);
    return;
  }
  for (const r of list) {
    const li = document.createElement('li');
    li.className = 'nyx-row';
    const when = new Date(r.timestamp);
    const title = document.createElement('span');
    title.textContent = `"${r.title}"`;
    const meta = document.createElement('span');
    meta.className = 'nyx-muted';
    meta.textContent = `${when.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    li.append(title, meta);
    recapsEl.appendChild(li);
  }
}

modeSeg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
  segSet(modeSeg, b.dataset.value);
  window.nyx.setMonitoringMode(b.dataset.value);
}));
document.getElementById('calibrate').addEventListener('click', () => window.nyx.openCalibration());
document.getElementById('settings').addEventListener('click', () => window.nyx.openSettings());

window.nyx.onPanelState((_e, s) => { renderState(s); renderRecaps(); });
segSet(modeSeg, 'auto');
renderRecaps();
window.nyx.dashboardReady();
