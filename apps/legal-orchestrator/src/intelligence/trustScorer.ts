// Sprint 14 — Trust scorer. Maps retrieval source + qa_status to a
// trust score in 0..100 per the project's trust model.
//
// Rules (canonical):
//   100  primary legislation / statutory_source
//    95  official acas_guidance / govuk_guidance
//    90  official tribunal_case (court source)
//    85  approved architecture_decision
//    80  verified sprint_report
//    70  approved_output (successful previous approved output)
//    50  draft_ai_output
//    30  unreviewed content
//     0  failed QA or blocked source
//
// Additional constraints:
//   - draft_ai_output MUST NOT outrank an official source (statutory,
//     govuk_guidance, acas_guidance, tribunal_case) for the same query.
//   - architecture_decision may be high for project/technical questions,
//     but MUST NOT outrank primary legal sources for legal answers.
//
// Pure function. Reason codes for every decision.

import type {
  IntelligenceRequest,
  RetrievalCandidate,
  TrustScore,
} from "./intelligence.types";

const BASE: Record<string, number> = {
  statutory_source: 100,
  govuk_guidance: 95,
  acas_guidance: 95,
  tribunal_case: 90,
  architecture_decision: 85,
  sprint_report: 80,
  approved_output: 70,
  draft_ai_output: 50,
  user_uploaded_document: 50,
  project_memory: 60,
};

const UNREVIEWED_FALLBACK = 30;

export function scoreCandidates(
  candidates: RetrievalCandidate[],
  request: IntelligenceRequest,
): TrustScore[] {
  const isLegal = request.legal_mode === true;
  const results: TrustScore[] = [];

  for (const c of candidates) {
    const reason_codes: string[] = [`source_type:${c.source_type}`];

    if (c.qa_status === "failed") {
      results.push({
        candidate_id: c.candidate_id,
        score: 0,
        source_type: "failed_qa_or_blocked",
        reason_codes: [...reason_codes, "qa_failed_or_blocked", "score_0_by_rule"],
      });
      continue;
    }

    let score = BASE[c.source_type] ?? UNREVIEWED_FALLBACK;
    if (BASE[c.source_type] === undefined) {
      reason_codes.push("no_base_for_source_using_unreviewed_fallback");
    }

    if (c.qa_status === "unreviewed") {
      score = Math.min(score, UNREVIEWED_FALLBACK);
      reason_codes.push("qa_unreviewed_score_capped_at_30");
    }
    if (c.qa_status === "draft" && c.source_type !== "draft_ai_output") {
      score = Math.min(score, BASE.draft_ai_output ?? 50);
      reason_codes.push("qa_draft_score_capped_at_50");
    }

    // Legal-mode demotion: draft and architecture must not outrank
    // official legal sources for a legal answer.
    if (isLegal) {
      if (c.source_type === "draft_ai_output") {
        score = Math.min(score, BASE.draft_ai_output ?? 50);
        reason_codes.push("legal_mode_draft_capped");
      }
      if (c.source_type === "architecture_decision") {
        // Cap below primary legal authority.
        score = Math.min(score, (BASE.tribunal_case ?? 90) - 1);
        reason_codes.push("legal_mode_architecture_capped_below_tribunal");
      }
    }

    score = Math.max(0, Math.min(100, score));
    results.push({
      candidate_id: c.candidate_id,
      score,
      source_type: c.source_type,
      reason_codes,
    });
  }

  return results;
}
