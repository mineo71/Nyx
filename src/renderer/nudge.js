const CIRC = 2 * Math.PI * 32; // circumference for r=32
const ring = document.querySelector('.ring');
const prog = document.querySelector('.ring .prog');
prog.style.strokeDasharray = String(CIRC);

function startRing(waitMs) {
  if (!waitMs) { ring.style.display = 'none'; return; }
  ring.style.display = 'block';
  prog.style.transition = 'none';
  prog.style.strokeDashoffset = '0';
  void prog.getBoundingClientRect();
  prog.style.transition = `stroke-dashoffset ${waitMs}ms linear`;
  prog.style.strokeDashoffset = String(CIRC);
}

window.nyx.onNudge((_e, { level, waitMs }) => {
  const chime = document.getElementById('chime');
  if (chime) { chime.volume = level === 'loud' ? 1.0 : 0.3; chime.currentTime = 0; chime.play().catch(() => {}); }
  startRing(waitMs);
});
