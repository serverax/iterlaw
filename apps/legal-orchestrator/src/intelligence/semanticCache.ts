// Sprint 14 — Semantic cache key builder. Deterministic. Pure.
//
// The key intentionally includes:
//   - workspace_id, project_id  (isolation)
//   - normalized question        (whitespace/punct normalised)
//   - question_embedding_hash    (placeholder hash to be supplied by
//                                 a future embedding port; null is
//                                 acceptable in mock-safe mode)
//   - retrieved_context_hash     (stable hash of the evidence pack
//                                 the answer was produced from)
//   - latest_event_at            (last event timestamp the workspace
//                                 saw; invalidates the cache on any
//                                 event)
//   - model_used                 (model identity)
//   - legal_mode                 (legal vs non-legal answers cache
//                                 separately)
//
// Cache MUST NOT be reused if any of the listed invalidators changed
// (law source updated, evidence uploaded, sprint status changed,
// case facts changed, prior answer was high-risk, prior answer
// failed citation verification). This module produces the KEY; the
// invalidation policy is enforced by the caller (the future cache
// store).

import { createHash } from "node:crypto";
import type {
  CompressedEvidenceBlock,
  IntelligenceRequest,
  SemanticCacheKey,
} from "./intelligence.types";

export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashEvidencePack(blocks: CompressedEvidenceBlock[]): string {
  const fingerprint = blocks
    .map((b) => [
      b.source_id,
      b.source_type,
      b.effective_from ?? "",
      b.effective_to ?? "",
      b.trust_score,
      // Use first 64 chars of evidence_text in the fingerprint to keep
      // the hash stable while not pulling DSN-shaped strings into the
      // cache key.
      (b.evidence_text ?? "").slice(0, 64),
    ].join(""))
    .sort()
    .join("");
  return createHash("sha256").update(fingerprint).digest("hex");
}

export function buildCacheKey(args: {
  request: IntelligenceRequest;
  evidence: CompressedEvidenceBlock[];
  model_used: string | null;
}): SemanticCacheKey {
  const { request, evidence, model_used } = args;
  return {
    workspace_id: request.workspace_id,
    project_id: request.project_id,
    normalized_question: normalizeQuestion(request.question ?? ""),
    question_embedding_hash: request.embedding_hash ?? null,
    retrieved_context_hash: hashEvidencePack(evidence),
    latest_event_at: request.latest_event_at ?? null,
    model_used: model_used ?? null,
    legal_mode: request.legal_mode === true,
  };
}

export function cacheKeyEquals(a: SemanticCacheKey, b: SemanticCacheKey): boolean {
  return (
    a.workspace_id === b.workspace_id &&
    a.project_id === b.project_id &&
    a.normalized_question === b.normalized_question &&
    a.question_embedding_hash === b.question_embedding_hash &&
    a.retrieved_context_hash === b.retrieved_context_hash &&
    a.latest_event_at === b.latest_event_at &&
    a.model_used === b.model_used &&
    a.legal_mode === b.legal_mode
  );
}

export const INVALIDATORS = [
  "law_source_changed",
  "user_uploaded_new_evidence",
  "sprint_status_changed",
  "case_facts_changed",
  "previous_answer_high_risk",
  "previous_answer_failed_citation_verification",
] as const;

export type CacheInvalidator = (typeof INVALIDATORS)[number];
