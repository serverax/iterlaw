// Sprint 14 — Context compressor. Reduces a candidate + its trust score
// + its freshness assessment to a compact CompressedEvidenceBlock.
//
// Hard rules:
//   - NEVER invent text not present in the candidate.text.
//   - PRESERVE citation/source metadata (id, title, url, type).
//   - PRESERVE effective dates.
//   - PRODUCE concise evidence (max N chars by default).
//   - WARN if compression removed required citation metadata.
//   - confidence = (trust_score / 100) scaled by freshness factor.

import type {
  CompressedEvidenceBlock,
  FreshnessAssessment,
  RetrievalCandidate,
  TrustScore,
} from "./intelligence.types";

export interface CompressorOptions {
  max_evidence_chars?: number; // default 600
  supports_legal_issue?: string | null;
}

function freshnessFactor(status: FreshnessAssessment["status"]): number {
  switch (status) {
    case "fresh": return 1.0;
    case "historical_only": return 0.6;
    case "needs_review_missing_dates":
    case "needs_review_no_last_verified": return 0.5;
    case "stale_effective_to_passed":
    case "stale_superseded": return 0.0;
  }
}

export function compressEvidence(
  candidate: RetrievalCandidate,
  trust: TrustScore,
  freshness: FreshnessAssessment,
  options: CompressorOptions = {},
): CompressedEvidenceBlock {
  const max = options.max_evidence_chars ?? 600;
  const warnings: string[] = [];

  let evidence_text = candidate.text ?? "";
  if (evidence_text.length > max) {
    evidence_text = evidence_text.slice(0, max).trimEnd() + " …";
    warnings.push("evidence_truncated_to_max_chars");
  }
  if (!evidence_text.trim()) {
    warnings.push("empty_evidence_text");
  }

  const block: CompressedEvidenceBlock = {
    source_id: candidate.source_id,
    source_title: candidate.source_title ?? null,
    source_url: candidate.source_url ?? null,
    source_type: trust.source_type,
    effective_from: candidate.effective_from ?? null,
    effective_to: candidate.effective_to ?? null,
    trust_score: trust.score,
    evidence_text,
    supports_legal_issue: options.supports_legal_issue ?? null,
    confidence: Math.max(0, Math.min(1, (trust.score / 100) * freshnessFactor(freshness.status))),
    warnings,
  };

  if (!block.source_title) warnings.push("missing_source_title");
  if (!block.source_url) warnings.push("missing_source_url");
  if (!block.effective_from && (block.source_type === "statutory_source" || block.source_type === "govuk_guidance" || block.source_type === "acas_guidance" || block.source_type === "tribunal_case")) {
    warnings.push("missing_effective_from_on_legal_source");
  }

  return block;
}
