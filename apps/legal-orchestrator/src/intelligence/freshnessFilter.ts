// Sprint 14 — Freshness filter / classifier. Determines whether each
// candidate is fresh, stale, or needs review based on effective dates
// and superseded_by pointers.
//
// Pure function. NOTE: legal sources MUST NOT be allowed into the
// final context if stale, unless allow_historical=true (historical
// comparison use case).

import type {
  FreshnessAssessment,
  FreshnessStatus,
  RetrievalCandidate,
} from "./intelligence.types";

export interface FreshnessOptions {
  now_utc?: string;          // ISO-8601 UTC; defaults to runtime now
  allow_historical?: boolean; // permit historical/stale legal sources
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function assessFreshness(
  candidates: RetrievalCandidate[],
  options: FreshnessOptions = {},
): FreshnessAssessment[] {
  const now = parseDate(options.now_utc ?? null) ?? new Date();

  return candidates.map((c) => {
    const reason_codes: string[] = [];
    let status: FreshnessStatus = "fresh";

    const effFrom = parseDate(c.effective_from);
    const effTo = parseDate(c.effective_to);

    if (c.superseded_by) {
      status = "stale_superseded";
      reason_codes.push(`superseded_by:${c.superseded_by}`);
    } else if (effTo && effTo.getTime() < now.getTime()) {
      status = "stale_effective_to_passed";
      reason_codes.push(`effective_to_before_now:${c.effective_to}`);
    } else if (!effFrom && !effTo && (c.source_type === "statutory_source" || c.source_type === "govuk_guidance" || c.source_type === "acas_guidance" || c.source_type === "tribunal_case")) {
      status = "needs_review_missing_dates";
      reason_codes.push("legal_source_missing_effective_dates");
    } else if (!c.last_verified_at && (c.source_type === "statutory_source" || c.source_type === "govuk_guidance" || c.source_type === "acas_guidance")) {
      status = "needs_review_no_last_verified";
      reason_codes.push("legal_source_missing_last_verified_at");
    } else {
      reason_codes.push("fresh_within_effective_window");
    }

    if (options.allow_historical && (status === "stale_effective_to_passed" || status === "stale_superseded")) {
      status = "historical_only";
      reason_codes.push("allow_historical_override");
    }

    return {
      candidate_id: c.candidate_id,
      status,
      effective_from: c.effective_from ?? null,
      effective_to: c.effective_to ?? null,
      superseded_by: c.superseded_by ?? null,
      reason_codes,
    };
  });
}

export function filterFreshForLegalAnswer(
  candidates: RetrievalCandidate[],
  assessments: FreshnessAssessment[],
): {
  kept: RetrievalCandidate[];
  removed: RetrievalCandidate[];
  reason_codes: string[];
} {
  const byId = new Map(assessments.map((a) => [a.candidate_id, a]));
  const kept: RetrievalCandidate[] = [];
  const removed: RetrievalCandidate[] = [];
  const reason_codes: string[] = [];

  for (const c of candidates) {
    const a = byId.get(c.candidate_id);
    if (!a) {
      removed.push(c);
      reason_codes.push(`removed_no_assessment:${c.candidate_id}`);
      continue;
    }
    if (a.status === "fresh") {
      kept.push(c);
      continue;
    }
    if (a.status === "needs_review_missing_dates" || a.status === "needs_review_no_last_verified") {
      // Keep for review but the rag evaluator will require operator review.
      kept.push(c);
      reason_codes.push(`kept_for_review:${c.candidate_id}:${a.status}`);
      continue;
    }
    if (a.status === "historical_only") {
      kept.push(c);
      reason_codes.push(`kept_historical_only:${c.candidate_id}`);
      continue;
    }
    removed.push(c);
    reason_codes.push(`removed_stale:${c.candidate_id}:${a.status}`);
  }
  return { kept, removed, reason_codes };
}
