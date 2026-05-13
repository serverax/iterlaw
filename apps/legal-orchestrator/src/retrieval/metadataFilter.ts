// Sprint 19 — Metadata filter for retrieval candidates.
//
// Pure functions. No DB. No network. No external LLM.

import type { RetrievalCandidate } from "../intelligence/intelligence.types";
import type { MetadataFilter } from "./retrieval.types";

interface FilterOutcome {
  readonly accepted: ReadonlyArray<RetrievalCandidate>;
  readonly rejected: ReadonlyArray<{ id: string; reason: string }>;
}

function isBefore(aIso: string, bIso: string): boolean {
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return a < b;
}

export function applyMetadataFilter(
  candidates: ReadonlyArray<RetrievalCandidate>,
  filter: MetadataFilter,
): FilterOutcome {
  const accepted: RetrievalCandidate[] = [];
  const rejected: { id: string; reason: string }[] = [];
  const effectiveAt = filter.effectiveAtIsoDate ?? new Date().toISOString();

  for (const c of candidates) {
    if (typeof filter.minSourceTier === "number" && typeof c.authority_level === "number") {
      // authority_level: lower number = higher authority. Reject if it ranks below the minimum tier.
      if (c.authority_level > filter.minSourceTier) {
        rejected.push({ id: c.candidate_id, reason: "metadata_below_min_source_tier" });
        continue;
      }
    }
    if (!filter.historicalMode && c.effective_to && isBefore(c.effective_to, effectiveAt)) {
      rejected.push({ id: c.candidate_id, reason: "metadata_effective_to_passed" });
      continue;
    }
    accepted.push(c);
  }
  return { accepted, rejected };
}
