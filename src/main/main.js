const { app, ipcMain, powerMonitor, session, shell, systemPreferences } = require('electron');
const path = require('node:path');

const { DEFAULTS } = require('../core/config.js');
const { SleepStateMachine } = require('../core/state-machine.js');
const { EscalationEngine } = require('../core/escalation-engine.js');
const { computeThreshold } = require('../core/detector-logic.js');
const { DrowsinessDetector } = require('../core/drowsiness-detector.js');
const { pitchFromMatrix } = require('../core/head-pose.js');
const { resolveLocale } = require('../core/i18n.js');
const { DetectionLog } = require('../services/detection-log.js');
const { clampSettingsView } = require('../core/settings-schema.js');

const osActions = require('../services/os-actions.js');
const { MediaWatcher } = require('../services/media-watcher.js');
const { IdleMonitor } = require('../services/idle-monitor.js');
const { settings, addRecap, lastRecap, recentRecaps } = require('../services/stores.js');

const { createDetectorWindow, showNudge, hideNudge, showCalibration, closeCalibration, createPanelWindow, setAccent, showMainWindow, getMainWindow, markQuitting, setLang, relocalize, showOnboarding, closeOnboarding } = require('./windows.js');
const { CaptureScheduler } = require('./capture-scheduler.js');
const { NyxTray } = require('./tray.js');
const { Popover } = require('./popover.js');

app.setName('Nyx');
if (app.dock) app.dock.show();

let machine, engine, tray, popover, panelWin, detectorWin, scheduler, mediaWatcher, idleMonitor, tickTimer;
let drowsiness, detectionLog;
let cameraOk = true;
let calibrationOpen = false;
const calibrationSamples = { open: [], closed: [] };
const CALIBRATION_MIN = 10;

let monitoringMode = 'auto';
let monitoringUntil = 0;
let mediaInfo = null; // { app } while something is playing, else null
let manualArm = false; // user armed Nyx by hand (independent of playback)

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
  if (mode !== 'auto' && machine && machine.state !== 'IDLE') machine.mediaStopped();
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
  const intervals = settings.get('intervals', DEFAULTS.intervals);
  return clampAndDecorate({
    tAsleepSec: Math.round(settings.get('tAsleepMs', DEFAULTS.tAsleepMs) / 1000),
    checkIntervalSec: Math.round((intervals.baselineMs ?? DEFAULTS.intervals.baselineMs) / 1000),
    nudgeWaitSec: Math.round((ladder[0]?.waitMs ?? 30000) / 1000),
    pauseWaitSec: Math.round((ladder[1]?.waitMs ?? 45000) / 1000),
    finalAction: settings.get('finalAction', DEFAULTS.finalAction),
    nightHoursEnabled: nh.enabled,
    nightHoursStart: nh.start,
    nightHoursEnd: nh.end,
    openAtLogin: app.getLoginItemSettings().openAtLogin,
    logDetection: settings.get('logDetection', DEFAULTS.logDetection),
    language: settings.get('language', 'auto'),
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
  const intervals = { ...DEFAULTS.intervals, ...settings.get('intervals', DEFAULTS.intervals) };
  intervals.baselineMs = v.checkIntervalSec * 1000;
  settings.set('intervals', intervals);
  settings.set('finalAction', v.finalAction);
  settings.set('nightHours', { enabled: v.nightHoursEnabled, start: v.nightHoursStart, end: v.nightHoursEnd });
  const ladder = JSON.parse(JSON.stringify(DEFAULTS.ladder));
  ladder[0].waitMs = v.nudgeWaitSec * 1000;
  ladder[1].waitMs = v.pauseWaitSec * 1000;
  ladder[2].waitMs = v.nudgeWaitSec * 1000;
  settings.set('ladder', ladder);
  app.setLoginItemSettings({ openAtLogin: v.openAtLogin });
  settings.set('logDetection', v.logDetection);
  const prevLang = settings.get('language', 'auto');
  settings.set('language', v.language);
  if (v.language !== prevLang) {
    setLang(resolveLocale(v.language, app.getLocale()));
    relocalize();
    navigateMain('settings'); // stay on the settings page after the reload
  }
  refreshRuntimeConfig();
}

function refreshRuntimeConfig() {
  if (machine) {
    machine.config.tAsleepMs = settings.get('tAsleepMs', DEFAULTS.tAsleepMs);
    machine.config.nightHours = settings.get('nightHours', DEFAULTS.nightHours);
  }
  if (scheduler) scheduler.intervals = settings.get('intervals', DEFAULTS.intervals);
  const wasRunning = engine && engine._running;
  if (engine) engine.cancel();
  engine = buildEngine();
  if (wasRunning) engine.start();
}

function buildEngine() {
  const ladder = settings.get('ladder', DEFAULTS.ladder);
  const actions = {
    nudge: (level, waitMs) => { showNudge(level, waitMs ?? ladder[0]?.waitMs ?? 30000); },
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

function startArmed() { if (drowsiness) drowsiness.reset(); osActions.startCaffeinate(); scheduler.start(); refreshDetectorMode(); pushPanelState(); tray.refresh(); }
function stopArmed() { osActions.stopCaffeinate(); scheduler.stop(); hideNudge(); refreshDetectorMode(); pushPanelState(); tray.refresh(); }

// The detector only touches the camera when it needs to: 'off' when idle, 'pulse'
// (a brief check each cadence) while WATCHING, 'on' (continuous) while confirming a doze
// or calibrating. This keeps the green camera light dark unless Nyx is actually armed.
function detectorMode() {
  if (calibrationOpen) return 'on';
  const st = machine ? machine.state : 'IDLE';
  if (st === 'DROWSY' || st === 'ESCALATING') return 'on';
  if (st === 'WATCHING') return 'pulse';
  return 'off';
}
function refreshDetectorMode() {
  if (detectorWin && !detectorWin.isDestroyed()) detectorWin.webContents.send('nyx:detector-mode', detectorMode());
}

// Live detection readout for the Settings "Developer" panel.
function sendDetectorDebug(sample, cls) {
  const w = getMainWindow();
  if (!w || w.isDestroyed()) return;
  const m = drowsiness.metrics();
  w.webContents.send('nyx:detector-debug', {
    state: machine ? machine.state : 'IDLE',
    cls,
    avg: m.avg,
    closedFrac: m.closedFrac,
    pitch: m.pitch,
    headDown: typeof m.pitch === 'number' && m.pitch <= drowsiness.p.headDownDeg,
    left: sample ? sample.left : null,
    right: sample ? sample.right : null,
    threshold: currentThreshold(),
  });
}

function pushPanelState() {
  const nowPlaying = (mediaInfo && mediaWatcher) ? { title: mediaWatcher.currentTitle, app: mediaInfo.app || null } : null;
  const state = { state: machine ? machine.state : 'IDLE', recap: lastRecap(), cameraOk, monitoringMode, nowPlaying, manualArm };
  for (const w of [panelWin, getMainWindow()]) {
    if (w && !w.isDestroyed()) w.webContents.send('nyx:panel-state', state);
  }
}

// Navigate the main window to a view ('dashboard' | 'settings'), waiting for load if needed.
function navigateMain(view) {
  const w = showMainWindow();
  const send = () => { if (!w.isDestroyed()) w.webContents.send('nyx:navigate', view); };
  if (w.webContents.isLoading()) w.webContents.once('did-finish-load', send);
  else send();
}

function permStatus() {
  let camera = 'unknown';
  let accessibility = false;
  try { if (systemPreferences.getMediaAccessStatus) camera = systemPreferences.getMediaAccessStatus('camera'); } catch { /* ignore */ }
  try { if (systemPreferences.isTrustedAccessibilityClient) accessibility = systemPreferences.isTrustedAccessibilityClient(false); } catch { /* ignore */ }
  return { camera, accessibility };
}

app.whenReady().then(() => {
  setAccent('ada8ff'); // locked moonlight-lavender (Nyx design language)

  setLang(resolveLocale(settings.get('language', 'auto'), app.getLocale()));

  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media'));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');

  detectorWin = createDetectorWindow();
  drowsiness = new DrowsinessDetector({
    getThreshold: currentThreshold,
    params: settings.get('drowsiness', DEFAULTS.drowsiness),
  });
  detectionLog = new DetectionLog({ filePath: path.join(app.getPath('userData'), 'detection-log.jsonl') });
  panelWin = createPanelWindow();
  if (settings.get('onboarded', false)) showMainWindow();
  else showOnboarding();

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

  tray = new NyxTray({
    getState: () => machine.state,
    onToggle: () => popover.toggle(),
    actions: {
      open: () => showMainWindow(),
      calibrate: () => openCalibration(),
      settings: () => navigateMain('settings'),
      quit: () => { stopArmed(); app.quit(); },
    },
  });
  popover = new Popover({ window: panelWin, tray: tray.tray });

  scheduler = new CaptureScheduler({
    detectorWebContents: detectorWin.webContents,
    getState: () => machine.state,
    intervals: settings.get('intervals', DEFAULTS.intervals),
  });

  mediaWatcher = new MediaWatcher({ pollMs: 2000 });
  mediaWatcher.on('media-playing', (info) => { mediaInfo = info || {}; if (monitoringAllowed()) machine.mediaPlaying(); pushPanelState(); });
  mediaWatcher.on('media-stopped', () => { mediaInfo = null; if (!manualArm) machine.mediaStopped(); pushPanelState(); });
  mediaWatcher.start();

  idleMonitor = new IdleMonitor({ powerMonitor });
  idleMonitor.on('input', () => machine.input());
  idleMonitor.start();

  tickTimer = setInterval(() => machine.tick(), 1000);

  ipcMain.on('nyx:frame', (_e, sample) => {
    const now = Date.now();
    const pitch = sample && sample.matrix ? pitchFromMatrix(sample.matrix) : null;
    const input = sample ? { left: sample.left, right: sample.right, pitch } : null;
    drowsiness.update(input, now);
    const cls = drowsiness.classify();
    const prevState = machine.state;
    machine.frame(cls);
    if (machine.state !== prevState) refreshDetectorMode(); // WATCHING<->DROWSY toggles camera mode
    sendDetectorDebug(sample, cls);
    if (settings.get('logDetection', DEFAULTS.logDetection) && machine.state !== 'IDLE') {
      const m = drowsiness.metrics();
      detectionLog.append({ t: now, l: sample ? sample.left : null, r: sample ? sample.right : null,
        avg: m.avg, pitch: m.pitch, closedFrac: m.closedFrac, cls, state: machine.state });
    }
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
  ipcMain.on('nyx:panel-size', (_e, height) => {
    if (panelWin && !panelWin.isDestroyed() && height > 0) {
      const [w] = panelWin.getSize();
      panelWin.setContentSize(w, Math.min(Math.max(Math.round(height), 200), 900));
    }
  });
  ipcMain.handle('nyx:get-recaps', () => recentRecaps(10));
  ipcMain.on('nyx:dashboard-ready', () => pushPanelState());
  ipcMain.on('nyx:set-monitoring', (_e, mode) => setMonitoringMode(mode));
  ipcMain.on('nyx:toggle-watch', () => {
    if (machine.state === 'IDLE') { manualArm = true; machine.forceArm(); }
    else { manualArm = false; machine.mediaStopped(); }
    pushPanelState();
  });
  ipcMain.on('nyx:open-settings', () => navigateMain('settings'));
  ipcMain.on('nyx:open-calibration', () => openCalibration());
  ipcMain.on('nyx:calibration-done', () => { closeCalibration(); showMainWindow(); });
  ipcMain.on('nyx:quit', () => { stopArmed(); app.quit(); });
  ipcMain.on('nyx:reveal-log', () => shell.showItemInFolder(detectionLog.filePath));

  // Onboarding (first-run)
  ipcMain.on('nyx:onboarding-ready', (e) => e.sender.send('nyx:onboarding-permissions', permStatus()));
  ipcMain.handle('nyx:onboarding-permissions', () => permStatus());
  ipcMain.handle('nyx:onboarding-request-camera', async () => {
    try { if (systemPreferences.askForMediaAccess) await systemPreferences.askForMediaAccess('camera'); } catch { /* ignore */ }
    return permStatus();
  });
  ipcMain.on('nyx:onboarding-open-accessibility', () => {
    try { systemPreferences.isTrustedAccessibilityClient(true); } catch { /* ignore */ }
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility').catch(() => {});
  });
  ipcMain.on('nyx:onboarding-finish', (_e, opts) => {
    settings.set('onboarded', true);
    closeOnboarding();
    if (opts && opts.calibrate) openCalibration();
    else showMainWindow();
  });

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
  refreshDetectorMode(); // camera on for calibration
  win.on('closed', () => { calibrationOpen = false; calibrationScoreTarget = null; refreshDetectorMode(); });
}
function forwardCalibrationScore(sample) {
  if (calibrationScoreTarget && !calibrationScoreTarget.isDestroyed()) {
    calibrationScoreTarget.send('nyx:calibrate-score', sample);
  }
}

app.on('window-all-closed', (e) => e.preventDefault());
app.on('activate', () => showMainWindow());
app.on('before-quit', () => markQuitting());
