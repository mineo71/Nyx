const { Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');

function iconFor() {
  const img = nativeImage.createFromPath(path.join(__dirname, '..', 'resources', 'trayTemplate.png'));
  img.setTemplateImage(true);
  return img;
}

class NyxTray {
  constructor({ onToggle, getState, actions = {} }) {
    this.tray = new Tray(iconFor());
    this.getState = getState;
    this.actions = actions;

    this.menu = Menu.buildFromTemplate([
      { label: 'Open Nyx', click: () => actions.open && actions.open() },
      { label: 'Calibrate…', click: () => actions.calibrate && actions.calibrate() },
      { label: 'Settings…', click: () => actions.settings && actions.settings() },
      { type: 'separator' },
      { label: 'Quit Nyx', click: () => actions.quit && actions.quit() },
    ]);

    // Left-click toggles the popover; right-click opens the menu.
    this.tray.on('click', () => onToggle());
    this.tray.on('right-click', () => this.tray.popUpContextMenu(this.menu));
    this.refresh();
  }

  refresh() {
    this.tray.setToolTip(`Nyx — ${this.getState()}`);
  }
}

module.exports = { NyxTray };
