const { app, ipcMain, powerMonitor, session } = require('electron');

const { DEFAULTS } = require('../core/config.js');
const { SleepStateMachine } = require('../core/state-machine.js');
const { EscalationEngine } = require('../core/escalation-engine.js');
const { classifyEyes, computeThreshold } = require('../core/detector-logic.js');

const osActions = require('../services/os-actions.js');
const { MediaWatcher } = require('../services/media-watcher.js');
const { IdleMonitor } = require('../services/idle-monitor.js');
const { settings, addRecap, lastRecap } = require('../services/stores.js');

const { createDetectorWindow, showNudge, hideNudge, showCalibration } = require('./windows.js');
const { CaptureScheduler } = require('./capture-scheduler.js');
const { NyxTray } = require('./tray.js');

app.setName('Nyx');
if (app.dock) app.dock.hide(); // menu-bar only, no dock icon

let machine, engine, tray, detectorWin, scheduler, mediaWatcher, idleMonitor, tickTimer;
const calibrationSamples = { open: [], closed: [] };
const CALIBRATION_MIN = 10; // matches the calibration window's per-phase sample count

function currentThreshold() {
  return settings.get('eyeCloseThreshold', DEFAULTS.eyeCloseThreshold);
}

function buildEngine() {
  const actions = {
    nudge: (level) => showNudge(level),
    pause: () => {
      osActions.pressMediaPlayPause();
      addRecap({ title: mediaWatcher.currentTitle, app: null, timestamp: Date.now() });
      tray.refresh();
    },
    sleep: () => { hideNudge(); osActions.sleepNow(); },
    displayOff: () => { hideNudge(); osActions.displayOff(); },
  };
  return new EscalationEngine({
    ladder: settings.get('ladder', DEFAULTS.ladder),
    finalAction: settings.get('finalAction', DEFAULTS.finalAction),
    actions,
    onComplete: () => { machine.slept(); tray.refresh(); },
  });
}

function startArmed() {
  osActions.startCaffeinate();
  scheduler.start();
  tray.refresh();
}

function stopArmed() {
  osActions.stopCaffeinate();
  scheduler.stop();
  hideNudge();
  tray.refresh();
}

app.whenReady().then(() => {
  // Allow the hidden detector renderer to use the camera.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media'));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');

  detectorWin = createDetectorWindow();

  machine = new SleepStateMachine({
    config: {
      tAsleepMs: settings.get('tAsleepMs', DEFAULTS.tAsleepMs),
      nightHours: settings.get('nightHours', DEFAULTS.nightHours),
    },
    clock: { now: () => Date.now() },
    nowHour: () => new Date().getHours(),
    on: {
      arm: () => startArmed(),
      disarm: () => { stopArmed(); engine.cancel(); },
      escalate: () => engine.start(),
      deescalate: () => { engine.cancel(); hideNudge(); tray.refresh(); },
    },
  });

  engine = buildEngine();

  tray = new NyxTray({
    getState: () => machine.state,
    getLastRecap: () => lastRecap(),
    onCalibrate: () => { calibrationSamples.open = []; calibrationSamples.closed = []; showCalibration(); },
    onQuit: () => { stopArmed(); app.quit(); },
  });

  scheduler = new CaptureScheduler({
    detectorWebContents: detectorWin.webContents,
    getState: () => machine.state,
    intervals: settings.get('intervals', DEFAULTS.intervals),
  });

  mediaWatcher = new MediaWatcher({ pollMs: 5000 });
  mediaWatcher.on('media-playing', () => machine.mediaPlaying());
  mediaWatcher.on('media-stopped', () => machine.mediaStopped());
  mediaWatcher.start();

  idleMonitor = new IdleMonitor({ powerMonitor });
  idleMonitor.on('input', () => machine.input());
  idleMonitor.start();

  // Drives the DROWSY -> ESCALATING timer.
  tickTimer = setInterval(() => machine.tick(), 1000);

  // Detector frames -> classify -> feed the machine.
  ipcMain.on('nyx:frame', (_e, sample) => {
    machine.frame(classifyEyes(sample, currentThreshold()));
  });
  ipcMain.on('nyx:detector-ready', () => tray.refresh());
  ipcMain.on('nyx:detector-error', (_e, msg) => {
    console.error('[nyx] detector error:', msg);
    if (tray) tray.tray.setToolTip('Nyx — camera unavailable');
  });

  // Calibration: the calibration window asks main for a sample; main asks the detector,
  // detector returns it, main accumulates and computes the threshold when it has enough.
  ipcMain.on('nyx:calibrate-request', (_e, { phase }) => {
    detectorWin.webContents.send('nyx:calibrate-capture', { phase });
  });
  ipcMain.on('nyx:calibrate-result', (_e, { phase, sample }) => {
    if (!sample || !calibrationSamples[phase]) return;
    calibrationSamples[phase].push(sample);
    if (calibrationSamples.open.length >= CALIBRATION_MIN && calibrationSamples.closed.length >= CALIBRATION_MIN) {
      const t = computeThreshold(calibrationSamples.open, calibrationSamples.closed);
      settings.set('eyeCloseThreshold', t);
      console.log('[nyx] new eyeCloseThreshold:', t);
    }
  });
});

app.on('window-all-closed', (e) => e.preventDefault()); // stay alive as a menu-bar app
