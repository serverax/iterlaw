// Sprint 19 — pgvector / semantic retrieval tier.
//
// The vector search is dependency-injected. No DB call here.

import type { RetrievalCandidate } from "../intelligence/intelligence.types";
import type { TierResult } from "./retrieval.types";

export interface VectorSearch {
  (
    question: string,
    options: { limit: number },
  ): Promise<RetrievalCandidate[]> | RetrievalCandidate[];
}

export async function runVectorTier(
  question: string,
  options: { limit: number },
  search?: VectorSearch,
): Promise<TierResult> {
  if (!search) {
    return {
      tier: "vector",
      status: "skipped",
      candidates: [],
      reasonCodes: ["vector_tier_no_search_configured"],
    };
  }
  const results = await search(question, options);
  if (!results || results.length === 0) {
    return {
      tier: "vector",
      status: "no_results",
      candidates: [],
      reasonCodes: ["vector_tier_empty"],
    };
  }
  return {
    tier: "vector",
    status: "selected",
    candidates: results,
    reasonCodes: [`vector_tier_count:${results.length}`],
  };
}
