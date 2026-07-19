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

module.exports = { computePanelPosition, MARGIN, GAP };
