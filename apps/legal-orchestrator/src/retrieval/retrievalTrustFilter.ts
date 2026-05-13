// Sprint 19 — Retrieval trust filter.
//
// Tier-output filter that rejects any candidate whose computed trust falls
// below the configured minimum. Composes the existing intelligence-layer
// trust scoring rules at a high level without re-implementing them.
//
// Pure functions. No DB. No network. No external LLM.

import type { RetrievalCandidate } from "../intelligence/intelligence.types";

const FAILED_QA_STATES: ReadonlyArray<string> = ["failed"];
const UNREVIEWED_STATES: ReadonlyArray<string> = ["unreviewed"];

export interface TrustFilterOutcome {
  readonly accepted: ReadonlyArray<RetrievalCandidate>;
  readonly rejected: ReadonlyArray<{ id: string; reason: string; score: number }>;
}

/**
 * Returns 0 for failed-QA / blocked content, 50 for draft AI output, 30 for
 * unreviewed content, and 80+ for approved trusted-source candidates. The exact
 * numbers align with the AIA trust model used elsewhere in the project.
 */
function computeTrust(candidate: RetrievalCandidate): number {
  if (candidate.qa_status && FAILED_QA_STATES.includes(candidate.qa_status)) return 0;
  if (candidate.source_type === "draft_ai_output") return 50;
  if (candidate.qa_status && UNREVIEWED_STATES.includes(candidate.qa_status)) return 30;
  switch (candidate.source_type) {
    case "statutory_source":
      return 100;
    case "tribunal_case":
      return 90;
    case "govuk_guidance":
    case "acas_guidance":
      return 85;
    case "approved_output":
      return 80;
    case "architecture_decision":
      return 75;
    case "sprint_report":
    case "project_memory":
    case "user_uploaded_document":
      return 60;
    default:
      return 50;
  }
}

export function applyTrustFilter(
  candidates: ReadonlyArray<RetrievalCandidate>,
  minScore = 60,
): TrustFilterOutcome {
  const accepted: RetrievalCandidate[] = [];
  const rejected: { id: string; reason: string; score: number }[] = [];
  for (const c of candidates) {
    const score = computeTrust(c);
    if (score < minScore) {
      rejected.push({
        id: c.candidate_id,
        reason: score === 0 ? "trust_blocked_failed_qa" : "trust_below_min_score",
        score,
      });
      continue;
    }
    accepted.push(c);
  }
  return { accepted, rejected };
}
