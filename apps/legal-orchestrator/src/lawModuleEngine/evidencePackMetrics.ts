/** Evidence pack density (0–1) from entry count for engine scoring heuristics. */
export function lawModuleEvidenceDensity(entryCount: number, maxEntries = 12): number {
  if (entryCount <= 0) {
    return 0;
  }
  return Math.min(1, entryCount / maxEntries);
}

/** Combine density with mean chunk trust (0–1) for a single evidence quality scalar. */
export function lawModuleEvidenceQualityScore(density: number, meanTrust: number): number {
  const d = Math.min(1, Math.max(0, density));
  const t = Math.min(1, Math.max(0, meanTrust));
  return 0.5 * d + 0.5 * t;
}
