import { FaceLandmarker, FilesetResolver }
  from '../../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs';

const WASM_ROOT = '../../node_modules/@mediapipe/tasks-vision/wasm';
const video = document.getElementById('cam');
let landmarker = null;

async function init() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
    await video.play();

    const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
    landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      },
      outputFaceBlendshapes: true,
      runningMode: 'IMAGE',
      numFaces: 1,
    });
    window.nyx.sendDetectorReady();
  } catch (e) {
    window.nyx.sendDetectorError(String(e && e.message ? e.message : e));
  }
}

function captureSample() {
  if (!landmarker || video.readyState < 2) return null;
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
  return { left, right };
}

window.nyx.onCaptureRequest(() => {
  window.nyx.sendFrame(captureSample());
});

window.nyx.onCalibrateCapture((_e, { phase }) => {
  window.nyx.sendCalibrationResult(phase, captureSample());
});

init();
