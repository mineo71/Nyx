// Pick the "owner" among multiple detected faces: the largest by bounding-box area —
// i.e. the person closest to the camera (in bed), so a partner or someone across the
// room doesn't drive detection. Isomorphic: usable from Node (tests) and the renderer.
(function (root) {
  function largestFaceIndex(faces) {
    if (!Array.isArray(faces) || faces.length === 0) return -1;
    if (faces.length === 1) return 0;
    let best = -1;
    let bestArea = -1;
    for (let i = 0; i < faces.length; i++) {
      const lm = faces[i];
      if (!Array.isArray(lm) || lm.length === 0) continue;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of lm) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const area = (maxX - minX) * (maxY - minY);
      if (area > bestArea) { bestArea = area; best = i; }
    }
    return best;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { largestFaceIndex };
  else root.NyxFaceSelect = { largestFaceIndex };
})(typeof window !== 'undefined' ? window : globalThis);
