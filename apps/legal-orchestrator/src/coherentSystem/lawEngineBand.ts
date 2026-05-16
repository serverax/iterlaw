/** Sprints 22–25 — fuse multiple calculator lane scores (weights sum-normalised). */
export function fuseCalculatorScores(scores: readonly number[], weights: readonly number[]): number {
  if (scores.length === 0 || scores.length !== weights.length) {
    throw new Error("scores and weights must be same non-empty length");
  }
  const wsum = weights.reduce((a, b) => a + b, 0);
  if (wsum <= 0) {
    throw new Error("weights must sum to positive value");
  }
  const wnorm = weights.map((w) => w / wsum);
  let acc = 0;
  for (let i = 0; i < scores.length; i++) {
    const s = Math.min(1, Math.max(0, scores[i]!));
    acc += s * wnorm[i]!;
  }
  return acc;
}

/** Evidence chain edge kind rollup for analytics. */
export function aggregateEdgeKinds(edges: readonly { edgeKind: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of edges) {
    out[e.edgeKind] = (out[e.edgeKind] ?? 0) + 1;
  }
  return out;
}
