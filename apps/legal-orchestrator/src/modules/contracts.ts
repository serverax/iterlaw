// Frozen JSON I/O shapes for the six Mother Brain deterministic modules.
// A future Rust→WASM port must produce/consume these EXACTLY.
//
// No imports from /pipeline or /types/legal — these contracts must be
// portable across any host language.

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type Jurisdiction = "uk_ew" | "uk_sc" | "uk_ni" | "se";

export interface LegalPackContext {
  legal_pack: string;       // e.g. "uk_employment_england_wales"
  jurisdiction: Jurisdiction;
  ruleset: LegalPackRuleset;
}

export interface LegalPackRuleset {
  area_of_law_to_rule_ids: Record<string, string[]>;
  rules: Record<string, RuleDefinition>;
  forbidden_terms: { id: string; pattern: string; flags?: string }[];
  required_phrases_when_deadline_relevant: string[]; // any-of
  // jurisdiction-specific
  limitation_window_days: number;                    // e.g. 91 = 3 months less one day (UK)
  qualifying_service_months_unfair_dismissal: number; // e.g. 24 (UK)
  no_qualifying_service_areas: string[];             // e.g. ["discrimination", "whistleblowing"]
}

export interface RuleDefinition {
  id: string;
  description: string;
  predicate: RulePredicate;
  on_match: RuleAction[];
}

export type RulePredicate =
  | { kind: "fact_missing"; fact: string }
  | { kind: "fact_equals"; fact: string; value: string | number | boolean }
  | { kind: "fact_before_date"; fact: string; date_iso: string }
  | { kind: "fact_after_date"; fact: string; date_iso: string }
  | { kind: "service_months_lt"; start_fact: string; end_fact: string; months: number }
  | { kind: "elapsed_days_between"; fact: string; min_days: number; max_days: number };

export interface RuleAction {
  kind: "mark_missing_fact" | "rule_hit" | "warning" | "set_status" | "set_risk_level";
  value: string;
}

// ---------------------------------------------------------------------------
// ruleEngine
// ---------------------------------------------------------------------------

export interface RuleEngineInput {
  area_of_law: string;
  facts: Record<string, unknown>;
  now_iso?: string; // for determinism in tests; defaults to runtime now
}

export interface RuleEngineOutput {
  rule_hits: string[];
  missing_facts: string[];
  warnings: string[];
  status: "ok" | "needs_more_facts" | "high_risk_deadline";
  risk_level: "low" | "medium" | "high" | "critical" | "unknown";
}

// ---------------------------------------------------------------------------
// deadlineChecker
// ---------------------------------------------------------------------------

export interface DeadlineCheckerInput {
  jurisdiction: Jurisdiction;
  area_of_law: string;
  facts: Record<string, unknown>;
  now_iso?: string;
}

export interface DeadlineCheckerOutput {
  status: "ok" | "needs_more_facts" | "high_risk_deadline";
  risk_level: "low" | "medium" | "high" | "critical" | "unknown";
  missing_facts: string[];
  rule_hits: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// citationVerifier
// ---------------------------------------------------------------------------

export interface CitationInput {
  chunk_id: string;
  citation_label?: string;
  quote_text?: string;
}

export interface RetrievedChunk {
  chunk_id: string;
  source_type: string;
  citation_label?: string;
  chunk_text: string;
  authority_level: number;
}

export interface CitationVerifierInput {
  answer_text: string;
  citations: CitationInput[];
  retrieved_chunks: RetrievedChunk[];
}

export interface CitationVerifierOutput {
  pass: boolean;
  failures: string[];
  verified_chunk_ids: string[];
}

// ---------------------------------------------------------------------------
// policyGate
// ---------------------------------------------------------------------------

export interface PolicyGateInput {
  answer_text: string;
  classification: { area_of_law: string; requires_deadline_check: boolean };
  risk_check: { status: string; risk_level: string };
  has_citations: boolean;
}

export interface PolicyGateOutput {
  pass: boolean;
  blocked_terms: string[];
  failures: string[];
}

// ---------------------------------------------------------------------------
// sourceRanker
// ---------------------------------------------------------------------------

export interface SourceRankerResult {
  chunk_id: string;
  authority_level: number;
  source_type: string;
  title: string;
  chunk_text: string;
  effective_date?: string;
  score?: number; // optional incoming score; engine recomputes
  url?: string;
  section_reference?: string;
}

export interface SourceRankerInput {
  query: string;
  results: SourceRankerResult[];
}

export interface SourceRankerOutput {
  ranked_results: (SourceRankerResult & { ranker_score: number })[];
}

// ---------------------------------------------------------------------------
// piiRedactor
// ---------------------------------------------------------------------------

export type RedactionType = "email" | "phone" | "ni_number" | "postcode";

export interface Redaction {
  type: RedactionType;
  placeholder: string; // e.g. "[EMAIL_1]"
  start: number;
  end: number;
  original_length: number;
}

export interface PiiRedactorInput {
  text: string;
}

export interface PiiRedactorOutput {
  redacted_text: string;
  redactions: Redaction[];
}
