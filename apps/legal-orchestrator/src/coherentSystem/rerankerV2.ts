/** Binary cross-entropy for a single Bernoulli trial (numerically stable). */
export function crossEntropyBinary(probPositive: number, label: 0 | 1): number {
  const p = Math.min(1 - 1e-9, Math.max(1e-9, probPositive));
  return -(label * Math.log(p) + (1 - label) * Math.log(1 - p));
}

/** Map recent CE loss into a confidence shrink factor in (0,1]. */
export function calibrateRerankerConfidence(raw: number, ceLoss: number): number {
  const r = Math.min(1, Math.max(0, raw));
  const shrink = 1 / (1 + Math.max(0, ceLoss));
  return r * shrink;
}
