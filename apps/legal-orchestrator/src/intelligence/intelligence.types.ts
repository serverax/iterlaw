// Sprint 14 Intelligence Layer — type contracts.
//
// Mock-safe types only. NO runtime imports of legal/pipeline modules
// to keep this layer independently testable and avoid coupling the
// active answer path with a not-yet-wired layer.

export type QueryIntent =
  | "legal_question"
  | "project_status"
  | "technical_architecture"
  | "security_risk"
  | "deployment"
  | "billing_or_pricing"
  | "customer_support"
  | "code_generation"
  | "compliance"
  | "unknown";

export type RetrievalSource =
  | "statutory_source"
  | "govuk_guidance"
  | "acas_guidance"
  | "tribunal_case"
  | "project_memory"
  | "sprint_report"
  | "approved_output"
  | "architecture_decision"
  | "user_uploaded_document"
  | "draft_ai_output";

// Failed-QA / blocked content uses a special source label that maps to
// trust score 0 by rule.
export type BlockedSourceTag = "failed_qa_or_blocked";

export interface IntelligenceRequest {
  workspace_id: string;
  project_id: string;
  user_id: string;
  question: string;
  legal_pack?: string | null;
  facts?: Record<string, unknown> | null;
  legal_mode?: boolean;
  embedding_hash?: string | null; // placeholder for vector model output
  latest_event_at?: string | null; // ISO-8601 UTC
}

export interface RetrievalCandidate {
  candidate_id: string;          // stable id (chunk_id / doc_id / etc.)
  source_type: RetrievalSource;  // statutory / acas / etc.
  source_id: string;             // canonical source id
  source_title?: string | null;
  source_url?: string | null;
  text: string;                  // raw text fragment
  effective_from?: string | null; // ISO date
  effective_to?: string | null;   // ISO date (or null if open)
  last_verified_at?: string | null;
  superseded_by?: string | null;  // candidate_id of the newer version
  qa_status?: "approved" | "draft" | "failed" | "unreviewed";
  authority_level?: number | null; // optional pre-existing legal weight
  keyword_rank?: number | null;    // BM25-style rank, 1 = best
  vector_rank?: number | null;     // ANN rank, 1 = best
  reason_codes: string[];          // why this candidate was included
}

export type RetrievalStrategy =
  | "statutory_first"
  | "guidance_first"
  | "case_law_first"
  | "project_memory_first"
  | "architecture_first"
  | "approved_outputs_first"
  | "conservative_unknown";

export interface RetrievalPlan {
  intent: QueryIntent;
  sources_priority: RetrievalSource[];
  strategy: RetrievalStrategy;
  max_candidates_per_source: number;
  must_include_legal_temporal: boolean;
  reason_codes: string[];
}

export interface HybridRetrievalResult {
  candidates: RetrievalCandidate[];
  rrf_scores: Record<string, number>;       // candidate_id -> RRF score
  per_source_counts: Record<string, number>;
  dedup_count: number;
  reason_codes: string[];
}

export interface TrustScore {
  candidate_id: string;
  score: number;                  // 0..100
  source_type: RetrievalSource | BlockedSourceTag;
  reason_codes: string[];
}

export type FreshnessStatus =
  | "fresh"
  | "stale_effective_to_passed"
  | "stale_superseded"
  | "needs_review_missing_dates"
  | "needs_review_no_last_verified"
  | "historical_only";

export interface FreshnessAssessment {
  candidate_id: string;
  status: FreshnessStatus;
  effective_from?: string | null;
  effective_to?: string | null;
  superseded_by?: string | null;
  reason_codes: string[];
}

export interface CompressedEvidenceBlock {
  source_id: string;
  source_title: string | null;
  source_url: string | null;
  source_type: RetrievalSource | BlockedSourceTag;
  effective_from: string | null;
  effective_to: string | null;
  trust_score: number;
  evidence_text: string;
  supports_legal_issue: string | null;
  confidence: number; // 0..1
  warnings: string[];
}

export interface SemanticCacheKey {
  workspace_id: string;
  project_id: string;
  normalized_question: string;
  question_embedding_hash: string | null;
  retrieved_context_hash: string;
  latest_event_at: string | null;
  model_used: string | null;
  legal_mode: boolean;
}

export interface RagEvaluationResult {
  citation_coverage: number;            // 0..1
  trust_threshold_met: boolean;
  freshness_ok: boolean;
  source_diversity: number;             // 0..1
  block_recommended: boolean;
  needs_review: boolean;
  uncited_legal_claim_detected: boolean;
  reason_codes: string[];
}

export interface IntelligenceDecisionTrace {
  request_id: string;
  intent: QueryIntent;
  plan: RetrievalPlan;
  hybrid: HybridRetrievalResult;
  trust_scores: TrustScore[];
  freshness: FreshnessAssessment[];
  compressed: CompressedEvidenceBlock[];
  cache_key?: SemanticCacheKey | null;
  evaluation: RagEvaluationResult;
  reason_codes: string[];
}

export interface IntelligenceResult {
  decision: "proceed" | "block" | "needs_review" | "insufficient_sources";
  trace: IntelligenceDecisionTrace;
  evidence: CompressedEvidenceBlock[];
  reason_codes: string[];
}
