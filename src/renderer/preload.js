const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nyx', {
  // Detector window
  onCaptureRequest: (cb) => ipcRenderer.on('nyx:capture', cb),
  sendFrame: (sample) => ipcRenderer.send('nyx:frame', sample),
  sendDetectorReady: () => ipcRenderer.send('nyx:detector-ready'),
  sendDetectorError: (msg) => ipcRenderer.send('nyx:detector-error', msg),
  onCalibrateCapture: (cb) => ipcRenderer.on('nyx:calibrate-capture', cb),
  sendCalibrationResult: (phase, sample) => ipcRenderer.send('nyx:calibrate-result', { phase, sample }),
  // Calibration window
  requestCalibrationSample: (phase) => ipcRenderer.send('nyx:calibrate-request', { phase }),
  onCalibrateScore: (cb) => ipcRenderer.on('nyx:calibrate-score', cb),
  // Nudge window
  onNudge: (cb) => ipcRenderer.on('nyx:nudge', cb),
  // Panel (popover)
  onPanelState: (cb) => ipcRenderer.on('nyx:panel-state', cb),
  panelReady: () => ipcRenderer.send('nyx:panel-ready'),
  setMonitoringMode: (mode) => ipcRenderer.send('nyx:set-monitoring', mode),
  openSettings: () => ipcRenderer.send('nyx:open-settings'),
  openCalibration: () => ipcRenderer.send('nyx:open-calibration'),
  quit: () => ipcRenderer.send('nyx:quit'),
  getRecaps: () => ipcRenderer.invoke('nyx:get-recaps'),
  dashboardReady: () => ipcRenderer.send('nyx:dashboard-ready'),
  // Settings window
  getSettings: () => ipcRenderer.invoke('nyx:get-settings'),
  setSetting: (key, value) => ipcRenderer.invoke('nyx:set-setting', { key, value }),
  revealLog: () => ipcRenderer.send('nyx:reveal-log'),
});
