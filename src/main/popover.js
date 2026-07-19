let screen;
try { ({ screen } = require('electron')); } catch { /* not in electron (e.g. unit tests) */ }

const MARGIN = 8;
const GAP = 6;

// Pure: where to place the popover so it sits under the tray icon and stays on screen.
function computePanelPosition(trayBounds, panelSize, workArea) {
  const centered = Math.round(trayBounds.x + trayBounds.width / 2 - panelSize.width / 2);
  const minX = workArea.x + MARGIN;
  const maxX = workArea.x + workArea.width - panelSize.width - MARGIN;
  const x = Math.max(minX, Math.min(centered, maxX));
  const y = trayBounds.y + trayBounds.height + GAP;
  return { x, y };
}

// Owns the popover window's show/hide/toggle and hide-on-blur behavior.
class Popover {
  constructor({ window, tray }) {
    this.window = window;
    this.tray = tray;
    this.window.on('blur', () => this.hide());
  }

  toggle() {
    if (this.window.isVisible()) this.hide();
    else this.show();
  }

  show() {
    const trayBounds = this.tray.getBounds();
    const [w, h] = this.window.getSize();
    const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
    const { x, y } = computePanelPosition(trayBounds, { width: w, height: h }, display.workArea);
    this.window.setPosition(x, y, false);
    this.window.show();
    this.window.focus();
  }

  hide() {
    if (this.window.isVisible()) this.window.hide();
  }
}

module.exports = { computePanelPosition, Popover, MARGIN, GAP };
