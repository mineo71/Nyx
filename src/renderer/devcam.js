import { FaceLandmarker, FilesetResolver }
  from '../../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs';

const WASM_ROOT = '../../node_modules/@mediapipe/tasks-vision/wasm';
const params = new URLSearchParams(location.search);
const THRESH = parseFloat(params.get('threshold') || '0.5');

const video = document.getElementById('cam');
const ov = document.getElementById('ov');
const ctx = ov.getContext('2d');
const hud = document.getElementById('hud');
const dot = document.getElementById('dot');
const stateLabel = document.getElementById('stateLabel');

let landmarker = null;
let running = true;
let lastTs = 0;

// FaceMesh eye-contour + iris-center indices (478-point model).
const L_EYE = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
const R_EYE = [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382];
const L_IRIS = 468;
const R_IRIS = 473;

const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#ada8ff';
const pitchFrom = (m) => (Array.isArray(m) && m.length === 16 ? Math.atan2(m[6], m[10]) * 180 / Math.PI : null);

async function init() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
    video.srcObject = stream;
    await video.play();
    const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
    landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: new URL('../resources/mediapipe/face_landmarker.task', import.meta.url).href },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: 'VIDEO',
      numFaces: 1,
    });
    loop();
  } catch (e) {
    hud.textContent = 'Camera unavailable: ' + (e && e.message ? e.message : e);
  }
}

function loop() {
  if (!running) return;
  if (landmarker && video.readyState >= 2) {
    if (ov.width !== video.videoWidth) { ov.width = video.videoWidth || 640; ov.height = video.videoHeight || 480; }
    const ts = performance.now();
    if (ts > lastTs) { lastTs = ts; draw(landmarker.detectForVideo(video, ts)); }
  }
  if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(loop);
  else requestAnimationFrame(loop);
}

function draw(res) {
  const W = ov.width, H = ov.height;
  ctx.clearRect(0, 0, W, H);
  const face = res.faceLandmarks && res.faceLandmarks[0];
  const bs = res.faceBlendshapes && res.faceBlendshapes[0];
  if (!face) { setHud(null); return; }

  const find = (n) => { const c = bs && bs.categories.find((x) => x.categoryName === n); return c ? c.score : null; };
  const left = find('eyeBlinkLeft');
  const right = find('eyeBlinkRight');
  const avg = (left != null && right != null) ? (left + right) / 2 : null;
  const closed = avg != null && avg >= THRESH;
  const accent = cssVar('--accent');
  const warm = '#f2c58b';
  const eyeColor = closed ? warm : accent;

  // face bounding box
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of face) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; }
  rrect(minX * W, minY * H, (maxX - minX) * W, (maxY - minY) * H, 12, accent, 2.4);

  // eye-contour dots
  ctx.fillStyle = eyeColor;
  for (const idx of L_EYE) plot(face[idx], W, H, 1.8);
  for (const idx of R_EYE) plot(face[idx], W, H, 1.8);

  // iris centers (ring + dot)
  for (const idx of [L_IRIS, R_IRIS]) {
    const p = face[idx];
    if (!p) continue;
    ring(p.x * W, p.y * H, 6, eyeColor, 2);
    ctx.fillStyle = eyeColor;
    plot(p, W, H, 2.4);
  }

  const mtx = res.facialTransformationMatrixes && res.facialTransformationMatrixes[0];
  const pitch = mtx && mtx.data ? pitchFrom(Array.from(mtx.data)) : null;
  const headDown = typeof pitch === 'number' && pitch <= -12;

  // head-pose tick: short vertical line at the nose tip, tilted by pitch
  const nose = face[1];
  if (nose && typeof pitch === 'number') {
    const cx = nose.x * W, cy = nose.y * H;
    const len = H * 0.14, a = (pitch / 90) * (Math.PI / 3);
    ctx.strokeStyle = headDown ? warm : accent;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(a) * len, cy - Math.cos(a) * len); ctx.stroke();
  }

  setHud({ left, right, avg, closed, pitch, headDown });
}

function plot(p, W, H, r) { if (p) { ctx.beginPath(); ctx.arc(p.x * W, p.y * H, r, 0, Math.PI * 2); ctx.fill(); } }
function ring(x, y, r, color, lw) { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
function rrect(x, y, w, h, r, color, lw) {
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.stroke();
}

function setHud(m) {
  if (!m) {
    hud.innerHTML = '<div>no face</div>';
    dot.style.background = 'var(--text-3)';
    stateLabel.textContent = 'no face';
    return;
  }
  const pc = (x) => (x == null ? '—' : Math.round(x * 100) + '%');
  const f2 = (x) => (x == null ? '—' : x.toFixed(2));
  hud.innerHTML = [
    `eyes ${m.closed ? 'CLOSED' : 'OPEN'}`,
    `score ${pc(m.avg)}  ·  thr ${THRESH.toFixed(2)}`,
    `L ${f2(m.left)}   R ${f2(m.right)}`,
    `pitch ${typeof m.pitch === 'number' ? m.pitch.toFixed(1) + '°' : '—'}${m.headDown ? '  ↓ down' : ''}`,
  ].map((s) => `<div>${s}</div>`).join('');
  dot.style.background = m.closed ? 'var(--warm)' : 'var(--accent)';
  stateLabel.textContent = m.closed ? 'closed' : 'open';
}

window.addEventListener('beforeunload', () => {
  running = false;
  const s = video.srcObject;
  if (s) s.getTracks().forEach((t) => t.stop());
});

init();
