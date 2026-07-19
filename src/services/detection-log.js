const fs = require('node:fs');

// Pure: if text exceeds maxBytes, return the second half starting at the next line boundary.
function truncateTail(text, maxBytes) {
  if (Buffer.byteLength(text) <= maxBytes) return text;
  const half = text.slice(Math.floor(text.length / 2));
  const nl = half.indexOf('\n');
  return nl >= 0 ? half.slice(nl + 1) : half;
}

// Numbers-only append-only JSONL log, size-capped. All writes are best-effort.
class DetectionLog {
  constructor({ filePath, maxBytes = 5 * 1024 * 1024 }) {
    this.filePath = filePath;
    this.maxBytes = maxBytes;
  }

  append(record) {
    try {
      let size = 0;
      try { size = fs.statSync(this.filePath).size; } catch { size = 0; }
      if (size > this.maxBytes) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        fs.writeFileSync(this.filePath, truncateTail(data, this.maxBytes));
      }
      fs.appendFileSync(this.filePath, JSON.stringify(record) + '\n');
    } catch (e) {
      console.error('[nyx] detection-log write failed:', e.message);
    }
  }
}

module.exports = { DetectionLog, truncateTail };
