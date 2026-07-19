// Level 'loud' plays the chime louder; the dim overlay is always shown while this window exists.
window.nyx.onNudge((_e, { level }) => {
  const chime = document.getElementById('chime');
  if (chime) { chime.volume = level === 'loud' ? 1.0 : 0.3; chime.play().catch(() => {}); }
});
