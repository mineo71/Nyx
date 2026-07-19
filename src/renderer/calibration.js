const instruction = document.getElementById('instruction');
const status = document.getElementById('status');
const scoreEl = document.getElementById('score');
const dotsEl = document.getElementById('dots');
const preview = document.getElementById('preview');
let phase = 'open';
let count = 0;
const NEEDED = 10;

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
  .catch(() => { status.textContent = 'Camera preview unavailable'; });

window.nyx.onCalibrateScore((_e, sample) => {
  scoreEl.textContent = sample ? ((sample.left + sample.right) / 2).toFixed(2) : 'no face';
});

document.getElementById('capture').addEventListener('click', () => {
  window.nyx.requestCalibrationSample(phase);
  count += 1;
  renderDots();
  status.textContent = `${phase}: ${count}/${NEEDED} captured`;
  if (count >= NEEDED) {
    if (phase === 'open') {
      phase = 'closed'; count = 0; renderDots();
      instruction.innerHTML = 'Step 2 — <b>close your eyes</b> and click Capture ~10 times.';
      status.textContent = '';
    } else {
      instruction.textContent = 'Calibration complete. You can close this window.';
    }
  }
});
