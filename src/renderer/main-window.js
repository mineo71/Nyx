const t = window.t || ((k) => k);

const dot = document.getElementById('dot');
const stateLabel = document.getElementById('stateLabel');
const statusLine = document.getElementById('statusLine');
const statusSub = document.getElementById('statusSub');
const modeSeg = document.getElementById('mode');
const recapsEl = document.getElementById('recaps');

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

function renderState(s) {
  const c = copyFor(s.state);
  dot.style.background = c.dot;
  stateLabel.textContent = c.label;
  statusLine.textContent = c.line;
  statusSub.textContent = s.cameraOk === false ? t('state.cameraOff') : c.sub;
  statusSub.style.color = s.cameraOk === false ? '#E0A45C' : 'rgba(242,243,245,0.55)';
  if (s.monitoringMode) segSet(modeSeg, s.monitoringMode);
}

async function renderRecaps() {
  const list = await window.nyx.getRecaps();
  recapsEl.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'nyx-muted';
    li.textContent = t('panel.noEvents');
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
