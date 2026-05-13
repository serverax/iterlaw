// Sprint 14 — Hybrid retriever orchestrator. Takes mock keyword + vector
// ranker outputs, applies RRF, returns HybridRetrievalResult.
//
// NO real DB. NO real BM25 / pgvector call here. The rankers are
// supplied as already-ranked arrays so this module stays mock-safe and
// deterministic.

import type {
  HybridRetrievalResult,
  RetrievalCandidate,
} from "./intelligence.types";
import { rrfFuse } from "./rrfFusion";

export interface HybridRetrieverInput {
  keyword_ranked: RetrievalCandidate[]; // rank 1..N best first
  vector_ranked: RetrievalCandidate[];  // rank 1..N best first
}

export function hybridRetrieve(input: HybridRetrieverInput): HybridRetrievalResult {
  const fused = rrfFuse(input);

  const per_source_counts: Record<string, number> = {};
  for (const c of fused.fused) {
    per_source_counts[c.source_type] = (per_source_counts[c.source_type] ?? 0) + 1;
  }

  const initial = input.keyword_ranked.length + input.vector_ranked.length;
  const dedup_count = initial - fused.fused.length;

  return {
    candidates: fused.fused,
    rrf_scores: fused.scores,
    per_source_counts,
    dedup_count,
    reason_codes: [
      `hybrid_initial=${initial}`,
      `hybrid_unique=${fused.fused.length}`,
      `hybrid_dedup=${dedup_count}`,
      ...fused.reason_codes,
    ],
  };
}
