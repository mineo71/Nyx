// Pitch (rotation about X) in degrees from a MediaPipe facial transformation matrix.
// Matrix is a column-major 4x4 flat array: element(row, col) = matrix[col*4 + row].
function pitchFromMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 16) return null;
  // For Rx(θ): element(2,1)=sinθ -> m[1*4+2]=m[6]; element(2,2)=cosθ -> m[2*4+2]=m[10].
  const sin = matrix[6];
  const cos = matrix[10];
  return Math.atan2(sin, cos) * (180 / Math.PI);
}

module.exports = { pitchFromMatrix };
