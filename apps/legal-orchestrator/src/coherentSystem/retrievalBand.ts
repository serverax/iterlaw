/** Default HNSW ef_search heuristic from `lists` build param. */
export function hnswEfSearchDefault(lists: number): number {
  if (lists <= 0 || !Number.isFinite(lists)) {
    throw new Error("lists must be positive finite");
  }
  return Math.min(200, Math.max(16, lists * 2));
}

/** TTL in ms for Ollama cache rows (stub policy table). */
export function ollamaCacheTtlMs(model: string): number {
  const m = model.toLowerCase();
  if (m.includes("70b")) {
    return 86_400_000;
  }
  if (m.includes("13b")) {
    return 172_800_000;
  }
  return 43_200_000;
}

/** Validate streaming chunk sequence is contiguous from 0..n-1. */
export function streamingChunksOrdered(chunks: readonly { seq: number }[]): boolean {
  if (chunks.length === 0) {
    return true;
  }
  const sorted = [...chunks].map((c) => c.seq).sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i) {
      return false;
    }
  }
  return true;
}
