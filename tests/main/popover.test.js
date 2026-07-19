import { describe, it, expect } from 'vitest';
import { computePanelPosition } from '../../src/main/popover.js';

const WORK = { x: 0, y: 0, width: 1440, height: 900 };
const PANEL = { width: 300, height: 360 };

describe('computePanelPosition', () => {
  it('centers the panel under a mid-screen tray icon, below the menu bar', () => {
    const tray = { x: 700, y: 0, width: 24, height: 24 };
    const { x, y } = computePanelPosition(tray, PANEL, WORK);
    expect(x).toBe(Math.round(700 + 12 - 150));
    expect(y).toBe(24 + 6);
  });

  it('clamps a right-edge tray icon so the panel stays on screen', () => {
    const tray = { x: 1420, y: 0, width: 24, height: 24 };
    const { x } = computePanelPosition(tray, PANEL, WORK);
    expect(x).toBe(WORK.width - PANEL.width - 8);
  });

  it('never positions left of the work-area margin', () => {
    const tray = { x: 0, y: 0, width: 24, height: 24 };
    const { x } = computePanelPosition(tray, PANEL, WORK);
    expect(x).toBe(8);
  });
});
