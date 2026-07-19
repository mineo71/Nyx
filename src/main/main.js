const { app, ipcMain, powerMonitor, session } = require('electron');

const { DEFAULTS } = require('../core/config.js');
const { SleepStateMachine } = require('../core/state-machine.js');
const { EscalationEngine } = require('../core/escalation-engine.js');
const { classifyEyes, computeThreshold } = require('../core/detector-logic.js');
const { clampSettingsView } = require('../core/settings-schema.js');

const osActions = require('../services/os-actions.js');
const { MediaWatcher } = require('../services/media-watcher.js');
const { IdleMonitor } = require('../services/idle-monitor.js');
const { settings, addRecap, lastRecap } = require('../services/stores.js');

const { createDetectorWindow, showNudge, hideNudge, showCalibration, createPanelWindow, showSettings } = require('./windows.js');
const { CaptureScheduler } = require('./capture-scheduler.js');
const { NyxTray } = require('./tray.js');
const { Popover } = require('./popover.js');

app.setName('Nyx');
if (app.dock) app.dock.hide();

let machine, engine, tray, popover, panelWin, detectorWin, scheduler, mediaWatcher, idleMonitor, tickTimer;
let cameraOk = true;
let calibrationOpen = false;
const calibrationSamples = { open: [], closed: [] };
const CALIBRATION_MIN = 10;

let monitoringMode = 'auto';
let monitoringUntil = 0;

function currentThreshold() {
  return settings.get('eyeCloseThreshold', DEFAULTS.eyeCloseThreshold);
}

function nextHour(hour) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function setMonitoringMode(mode) {
  monitoringMode = mode;
  if (mode === 'off') monitoringUntil = nextHour(5);
  else if (mode === 'snooze') monitoringUntil = Date.now() + 60 * 60 * 1000;
  else monitoringUntil = 0;
  pushPanelState();
}

function monitoringAllowed() {
  if (monitoringMode !== 'auto' && Date.now() >= monitoringUntil) {
    monitoringMode = 'auto'; monitoringUntil = 0;
  }
  return monitoringMode === 'auto';
}

function readSettingsView() {
  const ladder = settings.get('ladder', DEFAULTS.ladder);
  const nh = settings.get('nightHours', DEFAULTS.nightHours);
  return clampAndDecorate({
    tAsleepSec: Math.round(settings.get('tAsleepMs', DEFAULTS.tAsleepMs) / 1000),
    nudgeWaitSec: Math.round((ladder[0]?.waitMs ?? 30000) / 1000),
    pauseWaitSec: Math.round((ladder[1]?.waitMs ?? 45000) / 1000),
    finalAction: settings.get('finalAction', DEFAULTS.finalAction),
    nightHoursEnabled: nh.enabled,
    nightHoursStart: nh.start,
    nightHoursEnd: nh.end,
    openAtLogin: app.getLoginItemSettings().openAtLogin,
  });
}

function clampAndDecorate(view) {
  const clamped = clampSettingsView(view);
  clamped.eyeCloseThreshold = currentThreshold();
  return clamped;
}

function applySettingsView(view) {
  const v = clampSettingsView(view);
  settings.set('tAsleepMs', v.tAsleepSec * 1000);
  settings.set('finalAction', v.finalAction);
  settings.set('nightHours', { enabled: v.nightHoursEnabled, start: v.nightHoursStart, end: v.nightHoursEnd });
  const ladder = JSON.parse(JSON.stringify(DEFAULTS.ladder));
  ladder[0].waitMs = v.nudgeWaitSec * 1000;
  ladder[1].waitMs = v.pauseWaitSec * 1000;
  ladder[2].waitMs = v.nudgeWaitSec * 1000;
  settings.set('ladder', ladder);
  app.setLoginItemSettings({ openAtLogin: v.openAtLogin });
  refreshRuntimeConfig();
}

function refreshRuntimeConfig() {
  if (machine) {
    machine.config.tAsleepMs = settings.get('tAsleepMs', DEFAULTS.tAsleepMs);
    machine.config.nightHours = settings.get('nightHours', DEFAULTS.nightHours);
  }
  engine = buildEngine();
}

function buildEngine() {
  const ladder = settings.get('ladder', DEFAULTS.ladder);
  const actions = {
    nudge: (level) => { showNudge(level, ladder[0]?.waitMs ?? 30000); },
    pause: () => {
      osActions.pressMediaPlayPause();
      addRecap({ title: mediaWatcher.currentTitle, app: null, timestamp: Date.now() });
      pushPanelState();
    },
    sleep: () => { hideNudge(); osActions.sleepNow(); },
    displayOff: () => { hideNudge(); osActions.displayOff(); },
  };
  return new EscalationEngine({
    ladder,
    finalAction: settings.get('finalAction', DEFAULTS.finalAction),
    actions,
    onComplete: () => { machine.slept(); pushPanelState(); },
  });
}

function startArmed() { osActions.startCaffeinate(); scheduler.start(); pushPanelState(); tray.refresh(); }
function stopArmed() { osActions.stopCaffeinate(); scheduler.stop(); hideNudge(); pushPanelState(); tray.refresh(); }

function pushPanelState() {
  if (!panelWin || panelWin.isDestroyed()) return;
  panelWin.webContents.send('nyx:panel-state', {
    state: machine ? machine.state : 'IDLE',
    recap: lastRecap(),
    cameraOk,
    monitoringMode,
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media'));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');

  detectorWin = createDetectorWindow();
  panelWin = createPanelWindow();

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
      deescalate: () => { engine.cancel(); hideNudge(); pushPanelState(); },
    },
  });

  engine = buildEngine();

  tray = new NyxTray({ getState: () => machine.state, onToggle: () => popover.toggle() });
  popover = new Popover({ window: panelWin, tray: tray.tray });

  scheduler = new CaptureScheduler({
    detectorWebContents: detectorWin.webContents,
    getState: () => machine.state,
    intervals: settings.get('intervals', DEFAULTS.intervals),
  });

  mediaWatcher = new MediaWatcher({ pollMs: 5000 });
  mediaWatcher.on('media-playing', () => { if (monitoringAllowed()) machine.mediaPlaying(); });
  mediaWatcher.on('media-stopped', () => machine.mediaStopped());
  mediaWatcher.start();

  idleMonitor = new IdleMonitor({ powerMonitor });
  idleMonitor.on('input', () => machine.input());
  idleMonitor.start();

  tickTimer = setInterval(() => machine.tick(), 1000);

  ipcMain.on('nyx:frame', (_e, sample) => {
    machine.frame(classifyEyes(sample, currentThreshold()));
    if (calibrationOpen) forwardCalibrationScore(sample);
  });
  ipcMain.on('nyx:detector-ready', () => { cameraOk = true; pushPanelState(); });
  ipcMain.on('nyx:detector-error', (_e, msg) => {
    console.error('[nyx] detector error:', msg);
    cameraOk = false; pushPanelState();
  });

  ipcMain.on('nyx:calibrate-request', (_e, { phase }) => detectorWin.webContents.send('nyx:calibrate-capture', { phase }));
  ipcMain.on('nyx:calibrate-result', (_e, { phase, sample }) => {
    if (!sample || !calibrationSamples[phase]) return;
    calibrationSamples[phase].push(sample);
    if (calibrationSamples.open.length >= CALIBRATION_MIN && calibrationSamples.closed.length >= CALIBRATION_MIN) {
      settings.set('eyeCloseThreshold', computeThreshold(calibrationSamples.open, calibrationSamples.closed));
    }
  });

  ipcMain.on('nyx:panel-ready', () => pushPanelState());
  ipcMain.on('nyx:set-monitoring', (_e, mode) => setMonitoringMode(mode));
  ipcMain.on('nyx:open-settings', () => showSettings());
  ipcMain.on('nyx:open-calibration', () => openCalibration());
  ipcMain.on('nyx:quit', () => { stopArmed(); app.quit(); });

  ipcMain.handle('nyx:get-settings', () => readSettingsView());
  ipcMain.handle('nyx:set-setting', (_e, { key, value }) => {
    const view = readSettingsView();
    view[key] = value;
    applySettingsView(view);
    return readSettingsView();
  });
});

let calibrationScoreTarget = null;
function openCalibration() {
  calibrationSamples.open = []; calibrationSamples.closed = [];
  const win = showCalibration();
  calibrationOpen = true;
  calibrationScoreTarget = win.webContents;
  win.on('closed', () => { calibrationOpen = false; calibrationScoreTarget = null; });
}
function forwardCalibrationScore(sample) {
  if (calibrationScoreTarget && !calibrationScoreTarget.isDestroyed()) {
    calibrationScoreTarget.send('nyx:calibrate-score', sample);
  }
}

app.on('window-all-closed', (e) => e.preventDefault());
