const { spawn } = require('node:child_process');
const path = require('node:path');
const { run } = require('./run-cmd.js');

const MEDIAKEY_BIN = path.join(__dirname, '..', 'resources', 'mediakey');

let caffeinateProc = null;

// Prevent the OS from idle-sleeping while Nyx is armed, so Nyx controls sleep.
function startCaffeinate() {
  if (caffeinateProc) return;
  caffeinateProc = spawn('caffeinate', ['-di'], { stdio: 'ignore' });
  caffeinateProc.on('exit', () => { caffeinateProc = null; });
}

function stopCaffeinate() {
  if (caffeinateProc) { caffeinateProc.kill(); caffeinateProc = null; }
}

async function sleepNow() {
  await run('pmset', ['sleepnow']);
}

async function displayOff() {
  await run('pmset', ['displaysleepnow']);
}

// Fire-and-forget media Play/Pause. Missing/failed helper is logged, never throws.
function pressMediaPlayPause() {
  return run(MEDIAKEY_BIN, []).catch((err) => {
    console.error('[nyx] media-key helper failed:', err.message);
  });
}

module.exports = {
  startCaffeinate, stopCaffeinate, sleepNow, displayOff, pressMediaPlayPause, MEDIAKEY_BIN,
};
