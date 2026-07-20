const { BrowserWindow, screen, app } = require('electron');
const path = require('node:path');

const PRELOAD = path.join(__dirname, '..', 'renderer', 'preload.js');

let accentHex = 'ada8ff';
function setAccent(hex) { if (hex) accentHex = hex; }

let langCode = 'en';
function setLang(l) { if (l) langCode = l; }

let appQuitting = false;
function markQuitting() { appQuitting = true; }

function createDetectorWindow() {
  const win = new BrowserWindow({
    show: false,
    width: 320, height: 240,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'detector.html'));
  return win;
}

let nudgeWin = null;
function showNudge(level, waitMs) {
  if (nudgeWin) { nudgeWin.webContents.send('nyx:nudge', { level, waitMs }); return nudgeWin; }
  const { width, height } = screen.getPrimaryDisplay().bounds;
  nudgeWin = new BrowserWindow({
    width, height, x: 0, y: 0,
    frame: false, transparent: true, alwaysOnTop: true, focusable: false,
    skipTaskbar: true, hasShadow: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  nudgeWin.setIgnoreMouseEvents(true);
  nudgeWin.loadFile(path.join(__dirname, '..', 'renderer', 'nudge.html'), { query: { accent: accentHex, lang: langCode } });
  nudgeWin.webContents.once('did-finish-load', () => nudgeWin.webContents.send('nyx:nudge', { level, waitMs }));
  nudgeWin.on('closed', () => { nudgeWin = null; });
  return nudgeWin;
}

function hideNudge() {
  if (nudgeWin) { nudgeWin.close(); nudgeWin = null; }
}

let calibrationWin = null;
function showCalibration() {
  if (calibrationWin) { calibrationWin.focus(); return calibrationWin; }
  calibrationWin = new BrowserWindow({
    width: 480, height: 560, resizable: false, title: 'Calibrate Nyx',
    transparent: true, vibrancy: 'under-window', visualEffectState: 'active',
    backgroundColor: '#00000000', titleBarStyle: 'hiddenInset',
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  calibrationWin.loadFile(path.join(__dirname, '..', 'renderer', 'calibration.html'), { query: { accent: accentHex, lang: langCode } });
  calibrationWin.on('closed', () => { calibrationWin = null; });
  return calibrationWin;
}
function closeCalibration() {
  if (calibrationWin && !calibrationWin.isDestroyed()) calibrationWin.close();
}

let panelWin = null;
function createPanelWindow() {
  panelWin = new BrowserWindow({
    width: 320, height: 440,
    show: false, frame: false, resizable: false, movable: false,
    transparent: true, vibrancy: 'popover', visualEffectState: 'active', roundedCorners: true,
    backgroundColor: '#00000000', alwaysOnTop: true, skipTaskbar: true, fullscreenable: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  panelWin.loadFile(path.join(__dirname, '..', 'renderer', 'panel.html'), { query: { accent: accentHex, lang: langCode } });
  return panelWin;
}

let devCamWin = null;
function showDevCam(threshold) {
  if (devCamWin && !devCamWin.isDestroyed()) { devCamWin.focus(); return devCamWin; }
  devCamWin = new BrowserWindow({
    width: 560, height: 560, title: 'Nyx · Camera preview',
    transparent: true, vibrancy: 'under-window', visualEffectState: 'active',
    backgroundColor: '#00000000', titleBarStyle: 'hiddenInset',
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  devCamWin.loadFile(path.join(__dirname, '..', 'renderer', 'devcam.html'), { query: { accent: accentHex, lang: langCode, threshold: String(threshold ?? 0.5) } });
  devCamWin.on('closed', () => { devCamWin = null; });
  return devCamWin;
}

let onboardingWin = null;
function showOnboarding() {
  if (onboardingWin && !onboardingWin.isDestroyed()) { onboardingWin.focus(); return onboardingWin; }
  onboardingWin = new BrowserWindow({
    width: 560, height: 640, resizable: false, title: 'Welcome to Nyx',
    transparent: true, vibrancy: 'under-window', visualEffectState: 'active',
    backgroundColor: '#00000000', titleBarStyle: 'hiddenInset',
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  onboardingWin.loadFile(path.join(__dirname, '..', 'renderer', 'onboarding.html'), { query: { accent: accentHex, lang: langCode } });
  onboardingWin.on('closed', () => { onboardingWin = null; });
  return onboardingWin;
}
function closeOnboarding() {
  if (onboardingWin && !onboardingWin.isDestroyed()) onboardingWin.close();
  onboardingWin = null;
}

let mainWin = null;
function showMainWindow() {
  if (app && app.dock) app.dock.show(); // window visible => show in Dock
  if (mainWin && !mainWin.isDestroyed()) { mainWin.show(); mainWin.focus(); return mainWin; }
  mainWin = new BrowserWindow({
    width: 820, height: 780, minWidth: 640, minHeight: 640,
    transparent: true, vibrancy: 'under-window', visualEffectState: 'active',
    backgroundColor: '#00000000', titleBarStyle: 'hiddenInset', title: 'Nyx',
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  mainWin.loadFile(path.join(__dirname, '..', 'renderer', 'main-window.html'), { query: { accent: accentHex, lang: langCode } });
  // Closing the window doesn't quit — it retreats to the menu bar and drops the Dock icon.
  mainWin.on('close', (e) => {
    if (!appQuitting) {
      e.preventDefault();
      mainWin.hide();
      if (app && app.dock) app.dock.hide();
    }
  });
  return mainWin;
}
function getMainWindow() { return (mainWin && !mainWin.isDestroyed()) ? mainWin : null; }

function relocalize() {
  const q = { query: { accent: accentHex, lang: langCode } };
  const rl = (w, file) => { if (w && !w.isDestroyed()) w.loadFile(path.join(__dirname, '..', 'renderer', file), q); };
  rl(panelWin, 'panel.html');
  rl(calibrationWin, 'calibration.html');
  rl(mainWin, 'main-window.html');
  rl(onboardingWin, 'onboarding.html');
}

module.exports = { createDetectorWindow, showNudge, hideNudge, showCalibration, closeCalibration, createPanelWindow, setAccent, showMainWindow, getMainWindow, markQuitting, setLang, relocalize, showOnboarding, closeOnboarding, showDevCam };
