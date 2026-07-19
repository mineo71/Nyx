const { Tray, nativeImage } = require('electron');
const path = require('node:path');

function iconFor() {
  const img = nativeImage.createFromPath(path.join(__dirname, '..', 'resources', 'trayTemplate.png'));
  img.setTemplateImage(true);
  return img;
}

class NyxTray {
  constructor({ onToggle, getState }) {
    this.tray = new Tray(iconFor());
    this.getState = getState;
    this.tray.on('click', () => onToggle());
    this.tray.on('right-click', () => onToggle());
    this.refresh();
  }

  refresh() {
    this.tray.setToolTip(`Nyx — ${this.getState()}`);
  }
}

module.exports = { NyxTray };
