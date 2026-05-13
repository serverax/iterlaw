// Sprint 19 — RRF fusion adapter.
//
// Deterministic Reciprocal Rank Fusion over keyword + vector rankings. The
// existing `src/intelligence/rrfFusion.ts` provides the full intelligence-layer
// fuser; this adapter exposes a simple, pure function for multi-tier retrieval
// composition and keeps the call site explicit.

import type { RetrievalCandidate } from "../intelligence/intelligence.types";

export interface RrfFusionResult {
  readonly candidates: ReadonlyArray<RetrievalCandidate>;
  readonly scores: Record<string, number>;
  readonly dedupCount: number;
}

const DEFAULT_K = 60;

function rrfPartialScore(rank: number | null | undefined, k: number): number {
  if (typeof rank !== "number" || rank <= 0) return 0;
  return 1 / (k + rank);
}

export function fuseRrf(
  candidates: ReadonlyArray<RetrievalCandidate>,
  k = DEFAULT_K,
): RrfFusionResult {
  const byId = new Map<string, RetrievalCandidate>();
  const scores: Record<string, number> = {};

  for (const c of candidates) {
    const prev = byId.get(c.candidate_id);
    if (prev) {
      // dedupe by candidate_id, keep the richer one
      byId.set(c.candidate_id, { ...prev, ...c });
    } else {
      byId.set(c.candidate_id, c);
    }
    const s = rrfPartialScore(c.keyword_rank, k) + rrfPartialScore(c.vector_rank, k);
    scores[c.candidate_id] = (scores[c.candidate_id] ?? 0) + s;
  }

  const sorted = Array.from(byId.values()).sort(
    (a, b) => (scores[b.candidate_id] ?? 0) - (scores[a.candidate_id] ?? 0),
  );
  return {
    candidates: sorted,
    scores,
    dedupCount: candidates.length - sorted.length,
  };
}
