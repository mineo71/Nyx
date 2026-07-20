// Copies the Lucide SVGs we use into src/renderer/icons/ (committed, offline).
const fs = require('fs');
const path = require('path');

const NAMES = ['moon', 'sliders-horizontal', 'scan-face', 'power', 'camera'];
const src = path.join(__dirname, '..', 'node_modules', 'lucide-static', 'icons');
const dest = path.join(__dirname, '..', 'src', 'renderer', 'icons');
fs.mkdirSync(dest, { recursive: true });
for (const n of NAMES) {
  fs.copyFileSync(path.join(src, `${n}.svg`), path.join(dest, `${n}.svg`));
}
console.log('copied', NAMES.length, 'icons ->', dest);
