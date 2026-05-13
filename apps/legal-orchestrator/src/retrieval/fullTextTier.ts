// Sprint 19 — Full-text (BM25-style) retrieval tier.
//
// The actual full-text search is dependency-injected. No DB call here.

import type { RetrievalCandidate } from "../intelligence/intelligence.types";
import type { TierResult } from "./retrieval.types";

export interface FullTextSearch {
  (
    question: string,
    options: { limit: number },
  ): Promise<RetrievalCandidate[]> | RetrievalCandidate[];
}

export async function runFullTextTier(
  question: string,
  options: { limit: number },
  search?: FullTextSearch,
): Promise<TierResult> {
  if (!search) {
    return {
      tier: "full_text",
      status: "skipped",
      candidates: [],
      reasonCodes: ["full_text_tier_no_search_configured"],
    };
  }
  const results = await search(question, options);
  if (!results || results.length === 0) {
    return {
      tier: "full_text",
      status: "no_results",
      candidates: [],
      reasonCodes: ["full_text_tier_empty"],
    };
  }
  return {
    tier: "full_text",
    status: "selected",
    candidates: results,
    reasonCodes: [`full_text_tier_count:${results.length}`],
  };
}
