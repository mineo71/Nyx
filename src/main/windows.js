const { BrowserWindow, screen } = require('electron');
const path = require('node:path');

const PRELOAD = path.join(__dirname, '..', 'renderer', 'preload.js');

let accentHex = '7C8CF8';
function setAccent(hex) { if (hex) accentHex = hex; }

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
  nudgeWin.loadFile(path.join(__dirname, '..', 'renderer', 'nudge.html'));
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
  calibrationWin.loadFile(path.join(__dirname, '..', 'renderer', 'calibration.html'), { query: { accent: accentHex } });
  calibrationWin.on('closed', () => { calibrationWin = null; });
  return calibrationWin;
}

function createPanelWindow() {
  const win = new BrowserWindow({
    width: 300, height: 380,
    show: false, frame: false, resizable: false, movable: false,
    transparent: true, vibrancy: 'popover', visualEffectState: 'active', roundedCorners: true,
    backgroundColor: '#00000000', alwaysOnTop: true, skipTaskbar: true, fullscreenable: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'panel.html'), { query: { accent: accentHex } });
  return win;
}

let settingsWin = null;
function showSettings() {
  if (settingsWin) { settingsWin.focus(); return settingsWin; }
  settingsWin = new BrowserWindow({
    width: 460, height: 600, resizable: false, title: 'Nyx Settings',
    transparent: true, vibrancy: 'under-window', visualEffectState: 'active',
    backgroundColor: '#00000000', titleBarStyle: 'hiddenInset',
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  settingsWin.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'), { query: { accent: accentHex } });
  settingsWin.on('closed', () => { settingsWin = null; });
  return settingsWin;
}

module.exports = { createDetectorWindow, showNudge, hideNudge, showCalibration, createPanelWindow, showSettings, setAccent };
