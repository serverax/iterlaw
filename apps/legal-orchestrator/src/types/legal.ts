// Mother Brain — shared types (Phase 2 of the bundle, narrowed to Task 4 scope).
// Nothing here calls the network. All pipeline stages return plain values that
// downstream stages can verify. The LLM is never the decision authority — the
// orchestrator is.

export type AnswerStatus =
  | "safe_answer"
  | "needs_more_facts"
  | "high_risk_deadline"
  | "insufficient_sources"
  | "external_review_needed"
  | "document_required"
  | "citation_failed"
  | "policy_failed"
  | "llm_unavailable";

export type RiskLevel = "low" | "medium" | "high" | "critical" | "unknown";

export type RequestType =
  | "legal_advice"
  | "document_review"
  | "document_generation"
  | "risk_assessment"
  | "deadline_check"
  | "tribunal_form_help"
  | "grievance_draft"
  | "disciplinary_response"
  | "settlement_review"
  | "appeal_draft"
  | "case_timeline"
  | "unknown";

export type AreaOfLaw =
  | "unfair_dismissal"
  | "wrongful_dismissal"
  | "discrimination"
  | "whistleblowing"
  | "redundancy"
  | "disciplinary"
  | "grievance"
  | "suspension"
  | "holiday_pay"
  | "sick_pay"
  | "contract_variation"
  | "settlement_agreement"
  | "constructive_dismissal"
  | "wages_deduction"
  | "maternity"
  | "flexible_working"
  | "harassment"
  | "victimisation"
  | "working_time"
  | "minimum_wage"
  | "tupe"
  | "unknown";

export type ModelRole =
  | "fast_classifier"
  | "uk_employment_qa"
  | "uk_employment_document"
  | "uk_employment_drafting"
  | "coding"
  | "heavy_reasoning";

export interface LegalRequest {
  request_id: string;
  user_id: string;
  workspace_id: string;
  case_id?: string;
  legal_pack?: string;
  mode: "ask" | "document_review" | "draft" | "deadline" | "risk";
  question?: string;
  document_id?: string;
  document_text?: string;
  facts?: Record<string, unknown>;
  allow_external_llm?: boolean;
}

export interface Citation {
  chunk_id: string;
  document_id: string;
  source_type: string;
  source_title: string;
  source_url: string;
  section_reference?: string;
  paragraph_reference?: string;
  quote_text?: string;
  authority_level: number;
}

export interface Classification {
  question_type: RequestType;
  area_of_law: AreaOfLaw;
  jurisdiction: string;
  requires_document: boolean;
  requires_deadline_check: boolean;
  requires_citations: boolean;
  recommended_model_role: ModelRole;
}

export interface RiskCheck {
  status: "ok" | "needs_more_facts" | "high_risk_deadline";
  risk_level: RiskLevel;
  missing_facts: string[];
  rule_hits: string[];
  warnings: string[];
}

// Synthesis status reflects what legal-orchestrator did about the request.
// The orchestrator never calls a model — synthesis is performed by the
// out-of-band synthesis-worker reached over Redis Streams. These two
// fields describe the orchestrator's behaviour, not the model used.
export type SynthesisStatus =
  | "not_attempted"   // The orchestrator did not enqueue a synthesis job.
  | "queued"          // Enqueued on the synthesis request stream.
  | "completed"       // Response received from synthesis-worker.
  | "unavailable"     // Synthesis subsystem reported synthesis_unavailable.
  | "timeout"         // No response within SYNTHESIS_TIMEOUT_MS.
  | "error";          // synthesis_internal_error from the worker.

export type SynthesisMode = "redis_streams" | "disabled" | "direct_local";

export interface LegalResponse {
  request_id: string;
  status: AnswerStatus;
  legal_pack: string;
  jurisdiction: string;
  answer: string;
  risk_level: RiskLevel;
  confidence_score: number;
  rag_used: boolean;
  external_llm_used: boolean;
  synthesis_status: SynthesisStatus;
  synthesis_mode: SynthesisMode;
  citations: Citation[];
  missing_facts?: string[];
  next_steps: string[];
  audit_id?: string;
}

export interface ExtractedFacts {
  employment_start_date?: string;
  employment_end_date?: string;
  dismissal_date?: string;
  incident_date?: string;
  suspension_date?: string;
  grievance_date?: string;
  appeal_deadline?: string;
  acas_started?: boolean;
  acas_certificate_date?: string;
  employment_status?: string;
  protected_characteristic_mentioned?: boolean;
  whistleblowing_mentioned?: boolean;
  jurisdiction?: string;
}

export interface RagChunk {
  chunk_id: string;
  document_id: string;
  source_type: string;
  authority_level: number;
  title: string;
  url: string;
  section_reference?: string;
  paragraph_reference?: string;
  chunk_text: string;
  score: number;
}
