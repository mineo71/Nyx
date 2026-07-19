const { Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');

// Template icon; state shown via tooltip + menu label.
function iconFor() {
  const img = nativeImage.createFromPath(path.join(__dirname, '..', 'resources', 'trayTemplate.png'));
  img.setTemplateImage(true);
  return img;
}

class NyxTray {
  constructor({ onCalibrate, onQuit, getState, getLastRecap }) {
    this.tray = new Tray(iconFor());
    this.onCalibrate = onCalibrate;
    this.onQuit = onQuit;
    this.getState = getState;
    this.getLastRecap = getLastRecap;
    this.refresh();
  }

  refresh() {
    const recap = this.getLastRecap();
    const recapLabel = recap
      ? `Last night: paused "${recap.title}" at ${new Date(recap.timestamp).toLocaleTimeString()}`
      : 'No sleep events yet';
    const menu = Menu.buildFromTemplate([
      { label: `Nyx — ${this.getState()}`, enabled: false },
      { label: recapLabel, enabled: false },
      { type: 'separator' },
      { label: 'Calibrate…', click: () => this.onCalibrate() },
      { type: 'separator' },
      { label: 'Quit Nyx', click: () => this.onQuit() },
    ]);
    this.tray.setToolTip(`Nyx — ${this.getState()}`);
    this.tray.setContextMenu(menu);
  }
}

module.exports = { NyxTray };
