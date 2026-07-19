// Two-phase capture ('open' then 'closed'). Each click asks main to grab a live sample
// from the detector window for the current phase. Main stores samples and computes the
// threshold once it has enough of each (see main process).
const instruction = document.getElementById('instruction');
const status = document.getElementById('status');
let phase = 'open';
let count = 0;
const NEEDED = 10;

document.getElementById('capture').addEventListener('click', () => {
  window.nyx.requestCalibrationSample(phase);
  count += 1;
  status.textContent = `${phase}: ${count}/${NEEDED} captured`;
  if (count >= NEEDED) {
    if (phase === 'open') {
      phase = 'closed';
      count = 0;
      instruction.innerHTML = 'Step 2: <b>close your eyes</b> and click Capture ~10 times.';
      status.textContent = '';
    } else {
      instruction.textContent = 'Calibration complete. You can close this window.';
    }
  }
});
