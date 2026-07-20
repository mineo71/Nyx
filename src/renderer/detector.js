import { FaceLandmarker, FilesetResolver }
  from '../../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs';

const WASM_ROOT = '../../node_modules/@mediapipe/tasks-vision/wasm';
const video = document.getElementById('cam');
let landmarker = null;
let stream = null;
let starting = null;
let mode = 'off'; // 'off' | 'pulse' | 'on'

async function initModel() {
  try {
    const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
    landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: new URL('../resources/mediapipe/face_landmarker.task', import.meta.url).href,
      },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: 'IMAGE',
      numFaces: 1,
    });
  } catch (e) {
    window.nyx.sendDetectorError(String(e && e.message ? e.message : e));
  }
}

// Give the sensor a few frames to expose/settle before the first detect.
function waitForFrame() {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    if ('requestVideoFrameCallback' in video) {
      let n = 0;
      const cb = () => { if (++n >= 3) finish(); else video.requestVideoFrameCallback(cb); };
      video.requestVideoFrameCallback(cb);
    }
    setTimeout(finish, 600);
  });
}

async function startCamera() {
  if (stream) return true;
  if (starting) return starting;
  starting = (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.srcObject = stream;
      await video.play();
      await waitForFrame();
      window.nyx.sendDetectorReady();
      return true;
    } catch (e) {
      window.nyx.sendDetectorError(String(e && e.message ? e.message : e));
      stream = null;
      return false;
    } finally {
      starting = null;
    }
  })();
  return starting;
}

function stopCamera() {
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  video.srcObject = null;
}

function captureSample() {
  if (!landmarker || !stream || video.readyState < 2) return null;
  const result = landmarker.detect(video);
  const shapes = result.faceBlendshapes && result.faceBlendshapes[0];
  if (!shapes) return null;
  const find = (name) => {
    const c = shapes.categories.find((x) => x.categoryName === name);
    return c ? c.score : null;
  };
  const left = find('eyeBlinkLeft');
  const right = find('eyeBlinkRight');
  if (left == null || right == null) return null;
  const mtx = result.facialTransformationMatrixes && result.facialTransformationMatrixes[0];
  const matrix = mtx && mtx.data ? Array.from(mtx.data) : null;
  return { left, right, matrix };
}

window.nyx.onDetectorMode((_e, m) => {
  mode = m;
  if (m === 'on') startCamera();
  else stopCamera(); // 'off' and 'pulse' both release the camera between checks
});

window.nyx.onCaptureRequest(async () => {
  if (mode === 'off') { window.nyx.sendFrame(null); return; }
  if (mode === 'pulse') {
    const ok = await startCamera();
    window.nyx.sendFrame(ok ? captureSample() : null);
    if (mode === 'pulse') stopCamera(); // release again until the next check
    return;
  }
  window.nyx.sendFrame(captureSample()); // 'on': stream already up
});

window.nyx.onCalibrateCapture(async (_e, { phase }) => {
  if (!stream) await startCamera(); // calibration runs in 'on' mode; guard just in case
  window.nyx.sendCalibrationResult(phase, captureSample());
});

initModel();
