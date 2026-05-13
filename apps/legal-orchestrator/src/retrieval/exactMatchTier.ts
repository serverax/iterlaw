// Sprint 19 — Exact approved Q&A tier.
//
// The exact tier returns at most one previously-approved canonical answer for
// the input question. The implementation here is dependency-injected: the
// answer store is supplied as a function. No DB call is performed by this file;
// when no store is wired, the tier yields zero results.

import type { RetrievalCandidate } from "../intelligence/intelligence.types";
import type { ExactApprovedHit, TierResult } from "./retrieval.types";

export interface ExactApprovedLookup {
  (question: string): Promise<ExactApprovedHit | null> | ExactApprovedHit | null;
}

export async function runExactMatchTier(
  question: string,
  lookup?: ExactApprovedLookup,
): Promise<TierResult> {
  if (!lookup) {
    return {
      tier: "exact_approved_qa",
      status: "skipped",
      candidates: [],
      reasonCodes: ["exact_tier_no_lookup_configured"],
    };
  }
  const hit = await lookup(question);
  if (!hit) {
    return {
      tier: "exact_approved_qa",
      status: "no_results",
      candidates: [],
      reasonCodes: ["exact_tier_no_approved_match"],
    };
  }
  const candidate: RetrievalCandidate = {
    ...hit.candidate,
    reason_codes: [...(hit.candidate.reason_codes ?? []), "exact_approved_qa_match"],
  };
  return {
    tier: "exact_approved_qa",
    status: "selected",
    candidates: [candidate],
    reasonCodes: ["exact_tier_match_found"],
  };
}
