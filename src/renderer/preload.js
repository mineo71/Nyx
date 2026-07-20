const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nyx', {
  // Detector window
  onCaptureRequest: (cb) => ipcRenderer.on('nyx:capture', cb),
  onDetectorMode: (cb) => ipcRenderer.on('nyx:detector-mode', cb),
  sendFrame: (sample) => ipcRenderer.send('nyx:frame', sample),
  sendDetectorReady: () => ipcRenderer.send('nyx:detector-ready'),
  sendDetectorError: (msg) => ipcRenderer.send('nyx:detector-error', msg),
  onCalibrateCapture: (cb) => ipcRenderer.on('nyx:calibrate-capture', cb),
  sendCalibrationResult: (phase, sample) => ipcRenderer.send('nyx:calibrate-result', { phase, sample }),
  // Calibration window
  requestCalibrationSample: (phase) => ipcRenderer.send('nyx:calibrate-request', { phase }),
  onCalibrateScore: (cb) => ipcRenderer.on('nyx:calibrate-score', cb),
  calibrationDone: () => ipcRenderer.send('nyx:calibration-done'),
  // Nudge window
  onNudge: (cb) => ipcRenderer.on('nyx:nudge', cb),
  // Panel (popover)
  onPanelState: (cb) => ipcRenderer.on('nyx:panel-state', cb),
  onNavigate: (cb) => ipcRenderer.on('nyx:navigate', cb),
  onDetectorDebug: (cb) => ipcRenderer.on('nyx:detector-debug', cb),
  panelReady: () => ipcRenderer.send('nyx:panel-ready'),
  setPanelHeight: (h) => ipcRenderer.send('nyx:panel-size', h),
  setMonitoringMode: (mode) => ipcRenderer.send('nyx:set-monitoring', mode),
  toggleWatch: () => ipcRenderer.send('nyx:toggle-watch'),
  openSettings: () => ipcRenderer.send('nyx:open-settings'),
  openCalibration: () => ipcRenderer.send('nyx:open-calibration'),
  quit: () => ipcRenderer.send('nyx:quit'),
  getRecaps: () => ipcRenderer.invoke('nyx:get-recaps'),
  dashboardReady: () => ipcRenderer.send('nyx:dashboard-ready'),
  // Settings window
  getSettings: () => ipcRenderer.invoke('nyx:get-settings'),
  setSetting: (key, value) => ipcRenderer.invoke('nyx:set-setting', { key, value }),
  revealLog: () => ipcRenderer.send('nyx:reveal-log'),
  openExternal: (url) => ipcRenderer.send('nyx:open-url', url),
  // Onboarding window
  onboardingReady: () => ipcRenderer.send('nyx:onboarding-ready'),
  getPermissions: () => ipcRenderer.invoke('nyx:onboarding-permissions'),
  requestCamera: () => ipcRenderer.invoke('nyx:onboarding-request-camera'),
  openAccessibility: () => ipcRenderer.send('nyx:onboarding-open-accessibility'),
  onPermissions: (cb) => ipcRenderer.on('nyx:onboarding-permissions', cb),
  finishOnboarding: (opts) => ipcRenderer.send('nyx:onboarding-finish', opts),
});
