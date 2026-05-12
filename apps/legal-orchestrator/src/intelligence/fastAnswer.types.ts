// Fast Legal Answer Engine — type contracts.
//
// These types describe the inputs and outputs of `planFastLegalAnswer`,
// the pure deterministic decision function that decides whether a user
// request can be answered from cache / prepared blocks / RAG / queued
// LLM job / deep analysis, or whether it needs more facts. The planner
// does not perform I/O — every value it consults is supplied by the
// caller.
//
// The proposed underlying database tables are documented in
// docs/infra/ITERLAW_FAST_LEGAL_ANSWER_ENGINE.md.

// ---------------------------------------------------------------------
// Inputs.
// ---------------------------------------------------------------------

/** Verbatim user-supplied request, classified + risk-checked upstream. */
export interface FastAnswerInput {
  request_id: string;
  legal_pack: string;
  question_mode: "ask" | "document_review" | "draft" | "deadline" | "risk";
  question_fingerprint: string;
  facts_fingerprint: string;
  classification: {
    area_of_law: string;
    jurisdiction: string;
    requires_deadline_check: boolean;
    requires_citations: boolean;
    /** Optional 0..1 hint from the classifier; absence treated as 0.3 (mid). */
    complexity_score?: number;
    /** Operator-routable scenario id when the classifier matched one. */
    scenario_key?: string;
  };
  /** Subset of facts the planner reasons about. Other facts are opaque. */
  facts: {
    dismissal_date?: string;
    incident_date?: string;
    employment_start_date?: string;
    employment_end_date?: string;
    acas_started?: boolean;
  };
  /** Upstream `immediateRiskCheck` output. */
  risk: {
    status: "ok" | "needs_more_facts" | "high_risk_deadline";
    risk_level: "low" | "medium" | "high" | "critical" | "unknown";
    missing_facts: string[];
  };
  /** Optional cache lookup hint already computed by the orchestrator. */
  cache_hit?: LegalResponseCacheEntry | null;
  /** Optional prepared answer block hint already computed by the orchestrator. */
  prepared_block?: LegalAnswerBlock | null;
  /** Hint that retrieval is likely to return chunks (e.g. RAG pre-warm).
   *  Defaults to true when omitted — the planner errs on the side of
   *  attempting RAG rather than skipping straight to LLM. */
  rag_expected_to_return_chunks?: boolean;
}

// ---------------------------------------------------------------------
// Resource types (mirrors of future DB rows; no SQL coupling).
// ---------------------------------------------------------------------

export interface LegalAnswerBlock {
  id: string;
  scenario_key: string;
  area_of_law: string;
  jurisdiction: string;
  template_text: string;
  cited_chunk_ids: string[];
  effective_from?: string;
  effective_to?: string;
}

export interface LegalResponseCacheEntry {
  id: string;
  fingerprint: string;
  legal_pack: string;
  jurisdiction: string;
  answer_text: string;
  cited_chunk_ids: string[];
  created_at: string;
  /** Unix-style ISO. The planner treats `undefined` as "no TTL recorded". */
  expires_at?: string;
  /** Hash of the chunk versions the cached answer was built from. The
   *  planner does not invalidate the cache on its own; the caller is
   *  responsible for the freshness check. */
  cited_versions_hash?: string;
}

export interface LegalLlmJob {
  id: string;
  task_fingerprint: string;
  /** Logical role rather than a literal model tag. The synthesis-worker
   *  resolves the role to the actual Ollama model (e.g. drafting →
   *  `uk-employment-drafting:latest`). */
  role: "uk_employment_qa" | "uk_employment_drafting" | "uk_employment_document" | "heavy_reasoning";
  /** Logical bundle id supplied to the synthesis-worker (not the prompt
   *  itself — the planner never carries user text). */
  prompt_bundle_id: string;
  /** Optional list of `legal_chunks.id` that should accompany the job. */
  chunk_ids?: string[];
  priority: "low" | "normal" | "high" | "urgent";
  max_tokens?: number;
}

export interface LegalLlmOutput {
  id: string;
  job_id: string;
  task_fingerprint: string;
  model_name: string;
  output_text: string;
  cited_chunk_ids: string[];
  output_quality?: number;
  expires_at?: string;
}

// ---------------------------------------------------------------------
// Decision outputs.
// ---------------------------------------------------------------------

export type FastAnswerMode =
  | "missing_facts"
  | "instant_prepared"
  | "rag_grounded"
  | "llm_composed"
  | "deep_analysis";

export interface ModelRoutingDecision {
  role: LegalLlmJob["role"];
  /** Suggested cache TTL in seconds for the result this job would produce. */
  cache_ttl_s: number;
  priority: LegalLlmJob["priority"];
  max_tokens: number;
  prompt_bundle_id: string;
}

export interface MotherBrainDecision {
  mode: FastAnswerMode;
  /** Short, audit-safe explanation. MUST NOT contain user PII. */
  reason: string;
  /** Whether the orchestrator should bring up the synthesis path at all.
   *  False for `instant_prepared` and `missing_facts`. */
  synthesis_required: boolean;
  /** When `mode = "llm_composed"` or `"deep_analysis"`, this is non-null. */
  llm_job?: Omit<LegalLlmJob, "id">;
  routing?: ModelRoutingDecision;
}

export interface FastAnswerResult {
  decision: MotherBrainDecision;
  /** When the planner answered from cache or block, the answer source. */
  answer_source?:
    | { kind: "cache"; cache_id: string; expires_at?: string }
    | { kind: "prepared_block"; block_id: string; scenario_key: string };
  /** When `mode = "missing_facts"`, the names the caller should ask for. */
  missing_facts?: string[];
  /** Mirror of the input request id for log correlation. */
  request_id: string;
}
