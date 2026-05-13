// Sprint 19 — Deterministic rules lookup tier.
//
// Returns deterministic rule candidates (statutory calculators, limitation
// dates, NMW/NLW rates, etc.) when the query is a legal-rules calculation.
// The actual rule data is dependency-injected; no DB call here.

import type { RetrievalCandidate } from "../intelligence/intelligence.types";
import type { RulesLookupHit, TierResult } from "./retrieval.types";

export interface RulesLookup {
  (question: string): Promise<RulesLookupHit[]> | RulesLookupHit[];
}

export async function runRulesLookupTier(
  question: string,
  lookup?: RulesLookup,
): Promise<TierResult> {
  if (!lookup) {
    return {
      tier: "rules_lookup",
      status: "skipped",
      candidates: [],
      reasonCodes: ["rules_tier_no_lookup_configured"],
    };
  }
  const hits = await lookup(question);
  if (!hits || hits.length === 0) {
    return {
      tier: "rules_lookup",
      status: "no_results",
      candidates: [],
      reasonCodes: ["rules_tier_no_matching_rule"],
    };
  }
  const candidates: RetrievalCandidate[] = hits.map((h) => ({
    ...h.candidate,
    reason_codes: [
      ...(h.candidate.reason_codes ?? []),
      `rules_lookup_match:${h.ruleId}`,
    ],
  }));
  return {
    tier: "rules_lookup",
    status: "selected",
    candidates,
    reasonCodes: [`rules_tier_matched:${hits.length}`],
  };
}
