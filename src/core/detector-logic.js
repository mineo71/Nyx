function classifyEyes(sample, threshold) {
  if (!sample || typeof sample.left !== 'number' || typeof sample.right !== 'number') {
    return 'unknown';
  }
  const avg = (sample.left + sample.right) / 2;
  return avg >= threshold ? 'closed' : 'open';
}

function meanOfSamples(samples) {
  const total = samples.reduce((sum, s) => sum + (s.left + s.right) / 2, 0);
  return total / samples.length;
}

function computeThreshold(openSamples, closedSamples) {
  if (!openSamples.length || !closedSamples.length) {
    throw new Error('computeThreshold needs at least one open and one closed sample');
  }
  return (meanOfSamples(openSamples) + meanOfSamples(closedSamples)) / 2;
}

module.exports = { classifyEyes, computeThreshold };
