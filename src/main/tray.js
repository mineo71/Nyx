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
    this.update = null; // { version, url, dmgUrl } when an update is available

    // Left-click toggles the popover; right-click opens the (freshly-built) menu.
    this.tray.on('click', () => onToggle());
    this.tray.on('right-click', () => this.tray.popUpContextMenu(this.buildMenu()));
    this.refresh();
  }

  buildMenu() {
    const a = this.actions;
    const items = [];
    if (this.update) {
      items.push(
        { label: `Update to ${this.update.version} →`, click: () => a.openUpdate && a.openUpdate(this.update) },
        { type: 'separator' },
      );
    }
    items.push(
      { label: 'Open Nyx', click: () => a.open && a.open() },
      { label: 'Calibrate…', click: () => a.calibrate && a.calibrate() },
      { label: 'Settings…', click: () => a.settings && a.settings() },
      { type: 'separator' },
      { label: 'Check for Updates…', click: () => a.checkUpdates && a.checkUpdates() },
      { type: 'separator' },
      { label: 'Quit Nyx', click: () => a.quit && a.quit() },
    );
    return Menu.buildFromTemplate(items);
  }

  setUpdate(rel) {
    this.update = rel;
    this.refresh();
  }

  refresh() {
    this.tray.setToolTip(`Nyx — ${this.getState()}${this.update ? ` · update ${this.update.version} available` : ''}`);
  }
}

module.exports = { NyxTray };
