const t = window.t || ((k) => k);

const dot = document.getElementById('dot');
const stateLabel = document.getElementById('stateLabel');
const statusLine = document.getElementById('statusLine');
const statusSub = document.getElementById('statusSub');
const modeSeg = document.getElementById('mode');
const recapsEl = document.getElementById('recaps');
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

function renderState(s) {
  const c = copyFor(s.state);
  dot.style.background = c.dot;
  setOrb(s.state, s.cameraOk);
  stateLabel.textContent = c.label;
  statusLine.textContent = c.line;
  statusSub.textContent = s.cameraOk === false ? t('state.cameraOff') : c.sub;
  statusSub.style.color = s.cameraOk === false ? '#E0A45C' : 'rgba(242,243,245,0.55)';
  if (s.monitoringMode) segSet(modeSeg, s.monitoringMode);
  renderNowPlaying(s.nowPlaying);
  renderWatch(s);
}

const watchBtn = document.getElementById('watchToggle');
function renderWatch(s) {
  if (!watchBtn) return;
  if (s.state === 'IDLE') { watchBtn.style.display = ''; watchBtn.textContent = t('watch.start'); }
  else if (s.manualArm) { watchBtn.style.display = ''; watchBtn.textContent = t('watch.stop'); }
  else { watchBtn.style.display = 'none'; }
}
if (watchBtn) watchBtn.addEventListener('click', () => window.nyx.toggleWatch());

const npWrap = document.getElementById('npWrap');
function renderNowPlaying(np) {
  if (!npWrap) return;
  if (np && np.title) {
    npWrap.style.display = 'block';
    document.getElementById('npTitle').textContent = np.title;
    document.getElementById('npApp').textContent = np.app || '';
  } else {
    npWrap.style.display = 'none';
  }
}

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

async function renderRecaps() {
  const list = await window.nyx.getRecaps();
  recapsEl.innerHTML = '';
  if (!list.length) {
    const empty = el('div', 'flex flex-col items-center gap-3 text-center');
    empty.style.padding = '34px 0 30px';
    const mark = el('span', 'nyx-mark');
    mark.style.cssText = 'width:40px;height:40px;opacity:.35';
    empty.append(mark, el('div', 'text-[15px] font-medium nyx-muted', t('panel.noEvents')));
    const hint = el('div', 'text-[13px] nyx-faint', t('main.emptyHint'));
    hint.style.maxWidth = '320px';
    empty.append(hint);
    recapsEl.appendChild(empty);
    return;
  }
  for (const r of list) {
    const when = new Date(r.timestamp);
    const row = el('div', 'flex items-center gap-3.5 py-2.5');
    row.style.borderTop = 'var(--hair)';

    const thumb = el('div', 'nyx-thumb');
    thumb.style.cssText = 'width:52px;height:34px';

    const mid = el('div', 'flex-1 min-w-0');
    mid.append(
      el('div', 'text-sm font-medium truncate', r.title),
      el('div', 'text-[12px] nyx-faint mt-0.5', when.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })),
    );

    const right = el('div', 'text-right');
    right.append(
      el('div', 'text-[13px] nyx-mono nyx-muted', when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })),
      el('div', 'text-[11px] mt-0.5', t('main.fellAsleep')),
    );
    right.lastChild.style.color = 'var(--text-4)';

    row.append(thumb, mid, right);
    recapsEl.appendChild(row);
  }
}

modeSeg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
  segSet(modeSeg, b.dataset.value);
  window.nyx.setMonitoringMode(b.dataset.value);
}));

/* ---------- view navigation (Dashboard <-> Settings page) ---------- */
const viewDashboard = document.getElementById('viewDashboard');
const viewSettings = document.getElementById('viewSettings');

function showView(v) {
  const settings = v === 'settings';
  viewSettings.style.display = settings ? 'flex' : 'none';
  viewDashboard.style.display = settings ? 'none' : 'flex';
}

document.getElementById('navSettings').addEventListener('click', () => showView('settings'));
document.getElementById('navBack').addEventListener('click', () => showView('dashboard'));
document.getElementById('calibrate').addEventListener('click', () => window.nyx.openCalibration());
window.nyx.onNavigate((_e, v) => showView(v));

/* ---------- settings controls ---------- */
const NUM_KEYS = ['tAsleepSec', 'checkIntervalSec', 'nudgeWaitSec', 'pauseWaitSec', 'nightHoursStart', 'nightHoursEnd'];
const BOOL_KEYS = ['nightHoursEnabled', 'openAtLogin', 'logDetection'];
const finalActionSeg = document.getElementById('finalAction');
const languageSeg = document.getElementById('language');

function fillSettings(view) {
  NUM_KEYS.forEach((k) => { document.getElementById(k).value = view[k]; });
  BOOL_KEYS.forEach((k) => { document.getElementById(k).checked = view[k]; });
  segSet(finalActionSeg, view.finalAction);
  segSet(languageSeg, view.language);
  document.getElementById('threshold').textContent = (view.eyeCloseThreshold ?? 0).toFixed(2);
}

async function saveSetting(key, value) {
  const stored = await window.nyx.setSetting(key, value);
  fillSettings(stored);
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

async function initSettings() {
  fillSettings(await window.nyx.getSettings());
  NUM_KEYS.forEach((k) => document.getElementById(k).addEventListener('change', (e) => saveSetting(k, Number(e.target.value))));
  BOOL_KEYS.forEach((k) => document.getElementById(k).addEventListener('change', (e) => saveSetting(k, e.target.checked)));
  finalActionSeg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => saveSetting('finalAction', b.dataset.value)));
  languageSeg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => saveSetting('language', b.dataset.value)));
  wireSteppers();
  document.getElementById('recalibrate').addEventListener('click', () => window.nyx.openCalibration());
  document.getElementById('revealLog').addEventListener('click', () => window.nyx.revealLog());
}

/* ---------- developer detection readout ---------- */
const dbg = (id) => document.getElementById(id);
const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
const f2 = (x) => (typeof x === 'number' ? x.toFixed(2) : '—');

function renderDebug(d) {
  const cls = dbg('dbgCls');
  cls.textContent = d.state === 'IDLE' ? '— idle' : (d.cls || 'unknown').toUpperCase();
  cls.style.color = d.cls === 'closed' ? 'var(--warm)' : d.cls === 'open' ? 'var(--accent)' : 'var(--text-3)';

  const avg = d.avg;
  dbg('dbgAvg').textContent = pct(avg);
  const w = avg == null ? 0 : Math.max(0, Math.min(100, avg * 100));
  const bar = dbg('dbgBar');
  bar.style.width = `${w}%`;
  bar.style.background = (avg != null && d.threshold != null && avg >= d.threshold) ? 'var(--warm)' : 'var(--accent)';
  if (d.threshold != null) {
    dbg('dbgThreshMark').style.left = `${Math.max(0, Math.min(100, d.threshold * 100))}%`;
    dbg('dbgThresh').textContent = d.threshold.toFixed(2);
  }
  dbg('dbgLeft').textContent = f2(d.left);
  dbg('dbgRight').textContent = f2(d.right);
  dbg('dbgPitch').textContent = typeof d.pitch === 'number' ? `${d.pitch.toFixed(1)}°` : '—';
  dbg('dbgHead').textContent = d.headDown ? '· head down' : '';
  dbg('dbgPerclos').textContent = pct(d.closedFrac);
}
window.nyx.onDetectorDebug((_e, d) => renderDebug(d));

window.nyx.onPanelState((_e, s) => { renderState(s); renderRecaps(); });
segSet(modeSeg, 'auto');
renderRecaps();
initSettings();
window.nyx.dashboardReady();
