import type { RagCitation } from "../rag/rag.types";

export type ClaimFamily =
  | "unfair-dismissal"
  | "discrimination"
  | "whistleblowing"
  | "wages"
  | "redundancy"
  | "unknown";

/** Tribunal-style structured reasoning (Phase 2). */
export interface LegalReasoningOutput {
  claimType: ClaimFamily;
  legalTest: string;
  satisfiedElements: string[];
  missingElements: string[];
  evidenceNeeded: string[];
  employerDefences: string[];
  claimantWeaknesses: string[];
  tribunalRisk: "low" | "medium" | "high" | "critical";
  reasoningSummary: string;
  citations: RagCitation[];
}
