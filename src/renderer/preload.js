const { contextBridge, ipcRenderer } = require('electron');

// Bridges renderer windows to the main process over a fixed channel contract.
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
  // Nudge window
  onNudge: (cb) => ipcRenderer.on('nyx:nudge', cb),
});
