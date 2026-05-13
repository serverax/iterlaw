// Sprint 14 — RAG evaluator. Given the final evidence pack + trust
// scores + freshness assessments + (optional) answer claim list,
// decide whether to allow, block, or require review.
//
// Hard rules for legal answers:
//   - No source available  -> block.
//   - Weak (< trust threshold) only -> needs_review.
//   - Old source (stale)   -> block (or historical-only banner).
//   - Uncited legal claim  -> block.
//   - Model confidence without source -> ignored (we don't pass
//     model-only confidence into the evaluator).
//
// Pure function. Reason codes always present.

import type {
  CompressedEvidenceBlock,
  FreshnessAssessment,
  RagEvaluationResult,
  TrustScore,
} from "./intelligence.types";

export interface RagEvaluatorOptions {
  legal_mode: boolean;
  min_trust_threshold?: number; // default 80 for legal, 50 otherwise
  min_citation_coverage?: number; // default 0.9 for legal, 0.5 otherwise
  min_source_diversity?: number;  // default 0.5
  answer_legal_claims?: Array<{ claim_id: string; cited_source_ids: string[] }>;
}

function uniqueSourceTypes(blocks: CompressedEvidenceBlock[]): number {
  const set = new Set(blocks.map((b) => b.source_type));
  return set.size;
}

export function evaluateRag(
  evidence: CompressedEvidenceBlock[],
  trust: TrustScore[],
  freshness: FreshnessAssessment[],
  options: RagEvaluatorOptions,
): RagEvaluationResult {
  const legal = options.legal_mode;
  const trustThreshold = options.min_trust_threshold ?? (legal ? 80 : 50);
  const coverageMin = options.min_citation_coverage ?? (legal ? 0.9 : 0.5);
  const diversityMin = options.min_source_diversity ?? 0.5;

  const reason_codes: string[] = [];
  let block_recommended = false;
  let needs_review = false;
  let uncited_legal_claim_detected = false;

  if (evidence.length === 0) {
    reason_codes.push("no_evidence_block_for_legal_answer");
    return {
      citation_coverage: 0,
      trust_threshold_met: false,
      freshness_ok: false,
      source_diversity: 0,
      block_recommended: true,
      needs_review: false,
      uncited_legal_claim_detected: legal,
      reason_codes,
    };
  }

  // Trust threshold.
  const maxTrust = Math.max(...trust.map((t) => t.score));
  const trust_threshold_met = maxTrust >= trustThreshold;
  reason_codes.push(`max_trust=${maxTrust}`);
  if (!trust_threshold_met) {
    needs_review = true;
    reason_codes.push(`below_trust_threshold:${trustThreshold}`);
  }

  // Freshness: any stale evidence is forbidden in legal mode unless
  // historical_only.
  const stale = freshness.filter(
    (f) => f.status === "stale_effective_to_passed" || f.status === "stale_superseded",
  );
  const freshness_ok = stale.length === 0;
  if (!freshness_ok && legal) {
    block_recommended = true;
    reason_codes.push(`stale_legal_sources:${stale.map((f) => f.candidate_id).join(",")}`);
  }
  const hasReview = freshness.some(
    (f) => f.status === "needs_review_missing_dates" || f.status === "needs_review_no_last_verified",
  );
  if (hasReview) {
    needs_review = true;
    reason_codes.push("legal_source_needs_review_metadata");
  }

  // Source diversity (#unique source_types / total).
  const diversity = uniqueSourceTypes(evidence) / evidence.length;
  if (diversity < diversityMin) {
    needs_review = true;
    reason_codes.push(`source_diversity_below_min:${diversity.toFixed(2)}<${diversityMin}`);
  }

  // Citation coverage. If answer_legal_claims supplied, compute fraction
  // of claims whose cited_source_ids are in the evidence pack. Otherwise
  // estimate as min(1, evidence.length / max(1, evidence.length)) = 1.
  let citation_coverage = 1;
  if (options.answer_legal_claims && options.answer_legal_claims.length > 0) {
    const evidenceIds = new Set(evidence.map((b) => b.source_id));
    let covered = 0;
    for (const claim of options.answer_legal_claims) {
      const ok = claim.cited_source_ids.some((sid) => evidenceIds.has(sid));
      if (ok) covered += 1;
      else if (legal) {
        uncited_legal_claim_detected = true;
        reason_codes.push(`uncited_legal_claim:${claim.claim_id}`);
      }
    }
    citation_coverage = covered / options.answer_legal_claims.length;
    if (citation_coverage < coverageMin) {
      if (legal) {
        block_recommended = true;
        reason_codes.push(`citation_coverage_below_min_legal:${citation_coverage.toFixed(2)}<${coverageMin}`);
      } else {
        needs_review = true;
        reason_codes.push(`citation_coverage_below_min_nonlegal:${citation_coverage.toFixed(2)}<${coverageMin}`);
      }
    }
  }

  if (uncited_legal_claim_detected) block_recommended = true;

  if (!block_recommended && !needs_review) reason_codes.push("evaluation_ok");

  return {
    citation_coverage,
    trust_threshold_met,
    freshness_ok,
    source_diversity: diversity,
    block_recommended,
    needs_review,
    uncited_legal_claim_detected,
    reason_codes,
  };
}
