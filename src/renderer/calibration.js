const t = window.t || ((k) => k);

const instruction = document.getElementById('instruction');
const status = document.getElementById('status');
const scoreEl = document.getElementById('score');
const dotsEl = document.getElementById('dots');
const preview = document.getElementById('preview');
const captureBtn = document.getElementById('capture');
let phase = 'open';
let count = 0;
let done = false;
const NEEDED = 10;

const tick = new Audio('../resources/tick.wav');
const chime = new Audio('../resources/chime.wav');
function play(a) { try { a.currentTime = 0; a.play().catch(() => {}); } catch { /* ignore */ } }

function renderDots() {
  dotsEl.innerHTML = '';
  for (let i = 0; i < NEEDED; i++) {
    const d = document.createElement('div');
    d.className = 'd' + (i < count ? ' on' : '');
    dotsEl.appendChild(d);
  }
}
renderDots();

navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  .then((stream) => { preview.srcObject = stream; })
  .catch(() => { status.textContent = t('calib.previewUnavailable'); });

window.nyx.onCalibrateScore((_e, sample) => {
  scoreEl.textContent = sample ? ((sample.left + sample.right) / 2).toFixed(2) : t('calib.noFace');
});

captureBtn.addEventListener('click', () => {
  if (done || count >= NEEDED) return;
  window.nyx.requestCalibrationSample(phase);
  count += 1;
  play(tick);
  renderDots();
  status.textContent = `${phase}: ${count}/${NEEDED} ${t('calib.captured')}`;
  if (count >= NEEDED) {
    if (phase === 'open') {
      phase = 'closed'; count = 0; renderDots();
      instruction.innerHTML = t('calib.step2');
      status.textContent = '';
    } else {
      done = true;
      captureBtn.disabled = true;
      captureBtn.textContent = t('calib.complete');
      instruction.textContent = t('calib.doneMsg');
      play(chime);
    }
  }
});
