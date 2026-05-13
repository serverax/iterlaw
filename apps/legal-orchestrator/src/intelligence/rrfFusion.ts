// Sprint 14 — Reciprocal Rank Fusion (RRF) for hybrid retrieval.
//
// Pure function. Inputs are two ranked candidate lists (e.g. BM25
// keyword and ANN vector). Output: deduplicated candidates with RRF
// scores. Higher score = better.
//
// RRF formula: score(d) = sum over each ranker r of 1 / (k + rank_r(d)),
// where k is a smoothing constant (default 60 per the original paper).

import type { RetrievalCandidate } from "./intelligence.types";

export interface RrfInput {
  keyword_ranked: RetrievalCandidate[]; // rank 1..N (best first)
  vector_ranked: RetrievalCandidate[];  // rank 1..N (best first)
}

export interface RrfOutput {
  fused: RetrievalCandidate[];          // sorted by score desc
  scores: Record<string, number>;       // candidate_id -> score
  reason_codes: string[];
}

export const RRF_K = 60;

export function rrfFuse(input: RrfInput, k: number = RRF_K): RrfOutput {
  if (k <= 0) {
    throw new Error("rrfFuse: k must be > 0");
  }

  const scoreById = new Map<string, number>();
  const candidateById = new Map<string, RetrievalCandidate>();
  const reason_codes: string[] = [];

  const addRanker = (list: RetrievalCandidate[], rankerName: string) => {
    list.forEach((cand, idx) => {
      const rank = idx + 1; // 1-indexed
      const contrib = 1 / (k + rank);
      const prev = scoreById.get(cand.candidate_id) ?? 0;
      scoreById.set(cand.candidate_id, prev + contrib);
      if (!candidateById.has(cand.candidate_id)) {
        candidateById.set(cand.candidate_id, cand);
      }
      reason_codes.push(`rrf_contrib:${rankerName}:rank=${rank}:id=${cand.candidate_id}`);
    });
  };

  addRanker(input.keyword_ranked, "keyword");
  addRanker(input.vector_ranked, "vector");

  const fused = [...scoreById.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => candidateById.get(id)!)
    .filter(Boolean);

  reason_codes.unshift(`rrf_k=${k}`);
  reason_codes.unshift(`dedup_input=${input.keyword_ranked.length + input.vector_ranked.length}_unique=${fused.length}`);

  return {
    fused,
    scores: Object.fromEntries(scoreById),
    reason_codes,
  };
}
