/**
 * Shared Axiom / triple-agent types (Phase 0 Step 6b).
 * Central contracts for AEE (extraction), ART (reasoning), ADA (documents).
 */

export type CaseState =
  | 'intake'
  | 'facts_review'
  | 'reasoning'
  | 'drafting'
  | 'complete'
  | 'escalated';

export interface LegalFact {
  id: string;
  label: string;
  value: string;
  /** Model-estimated certainty for the extracted span (0–1). */
  confidence: number;
  /** Optional verbatim excerpt from the source document. */
  sourceSpan?: string;
  /** User confirmation in Fact Review UI. */
  userConfirmed?: boolean;
}

export interface ReasoningStep {
  step: number;
  title: string;
  summary: string;
  /** Short citation or anchor text injected from the legal library. */
  statutoryAnchor?: string;
}

export interface AxiomTrace {
  caseId: string;
  steps: ReasoningStep[];
  /** 0–100 heuristic merit score from structured reasoning. */
  meritScore: number;
  jurisdiction: 'england_wales' | 'scotland' | 'ni';
  generatedAt: string;
}

export interface DocumentDraft {
  id: string;
  title: string;
  body: string;
  format: 'plain' | 'markdown';
}

export interface ExtractPhaseResult {
  caseId: string;
  facts: LegalFact[];
  previousState: CaseState;
  nextState: CaseState;
  extractionConfidence: number;
}

export interface ReasonPhaseResult {
  caseId: string;
  trace: AxiomTrace;
  document: DocumentDraft;
  previousState: CaseState;
  nextState: CaseState;
}

export interface PersistResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}
