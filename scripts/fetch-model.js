const fs = require('fs');
const path = require('path');
const https = require('https');

const URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const outDir = path.join(__dirname, '..', 'src', 'resources', 'mediapipe');
const out = path.join(outDir, 'face_landmarker.task');
fs.mkdirSync(outDir, { recursive: true });

function download(url, dest, redirects = 0) {
  https.get(url, (res) => {
    if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
      res.resume(); return download(res.headers.location, dest, redirects + 1);
    }
    if (res.statusCode !== 200) { console.error('HTTP', res.statusCode); process.exit(1); }
    const file = fs.createWriteStream(dest);
    res.pipe(file);
    file.on('finish', () => file.close(() => console.log('wrote', dest, fs.statSync(dest).size, 'bytes')));
  }).on('error', (e) => { console.error(e.message); process.exit(1); });
}
download(URL, out);
