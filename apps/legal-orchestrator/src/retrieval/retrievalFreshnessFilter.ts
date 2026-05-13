// Sprint 19 — Retrieval freshness filter.
//
// Tier-output filter that rejects superseded / out-of-effect candidates unless
// historical-comparison mode is enabled. Reasons are surfaced for the decision
// trace so the answer path can show why content was excluded.
//
// Pure functions. No DB. No network.

import type { RetrievalCandidate } from "../intelligence/intelligence.types";

export interface FreshnessFilterOutcome {
  readonly accepted: ReadonlyArray<RetrievalCandidate>;
  readonly rejected: ReadonlyArray<{ id: string; reason: string }>;
  /** Candidates kept only because historical mode allowed it; carry a warning. */
  readonly historicalKept: ReadonlyArray<{ id: string; reason: string }>;
}

function isBefore(aIso: string | null | undefined, bIso: string): boolean {
  if (!aIso) return false;
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return a < b;
}

export function applyFreshnessFilter(
  candidates: ReadonlyArray<RetrievalCandidate>,
  options: { historicalMode?: boolean; nowIsoDate?: string } = {},
): FreshnessFilterOutcome {
  const accepted: RetrievalCandidate[] = [];
  const rejected: { id: string; reason: string }[] = [];
  const historicalKept: { id: string; reason: string }[] = [];
  const now = options.nowIsoDate ?? new Date().toISOString();

  for (const c of candidates) {
    const isSuperseded = !!c.superseded_by;
    const effectiveToPassed = isBefore(c.effective_to, now);
    if (isSuperseded || effectiveToPassed) {
      const reason = isSuperseded ? "freshness_superseded" : "freshness_effective_to_passed";
      if (options.historicalMode) {
        accepted.push(c);
        historicalKept.push({ id: c.candidate_id, reason });
      } else {
        rejected.push({ id: c.candidate_id, reason });
      }
      continue;
    }
    accepted.push(c);
  }
  return { accepted, rejected, historicalKept };
}
