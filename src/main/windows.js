const { BrowserWindow, screen } = require('electron');
const path = require('node:path');

const PRELOAD = path.join(__dirname, '..', 'renderer', 'preload.js');

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
function showNudge(level) {
  if (nudgeWin) { nudgeWin.webContents.send('nyx:nudge', { level }); return nudgeWin; }
  const { width, height } = screen.getPrimaryDisplay().bounds;
  nudgeWin = new BrowserWindow({
    width, height, x: 0, y: 0,
    frame: false, transparent: true, alwaysOnTop: true, focusable: false,
    skipTaskbar: true, hasShadow: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  nudgeWin.setIgnoreMouseEvents(true);
  nudgeWin.loadFile(path.join(__dirname, '..', 'renderer', 'nudge.html'));
  nudgeWin.webContents.once('did-finish-load', () => nudgeWin.webContents.send('nyx:nudge', { level }));
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
    width: 480, height: 320,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  calibrationWin.loadFile(path.join(__dirname, '..', 'renderer', 'calibration.html'));
  calibrationWin.on('closed', () => { calibrationWin = null; });
  return calibrationWin;
}

function createPanelWindow() {
  const win = new BrowserWindow({
    width: 300, height: 360,
    show: false, frame: false, resizable: false, movable: false,
    transparent: false, alwaysOnTop: true, skipTaskbar: true, fullscreenable: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'panel.html'));
  return win;
}

let settingsWin = null;
function showSettings() {
  if (settingsWin) { settingsWin.focus(); return settingsWin; }
  settingsWin = new BrowserWindow({
    width: 460, height: 560, resizable: false, title: 'Nyx Settings',
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false },
  });
  settingsWin.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
  return settingsWin;
}

module.exports = { createDetectorWindow, showNudge, hideNudge, showCalibration, createPanelWindow, showSettings };
