import type { RagCitation } from "../rag/rag.types";
import type { LegalReasoningOutput } from "../reasoning/reasoning.types";
import type { CompensationEstimateOutput } from "../compensation/compensation.types";
import type { SafetyEnvelope } from "../safety/review-safety";

export interface ClaimSummary {
  family: string;
  label: string;
}

/** POST /api/review success body — Phase 4 integrated response. */
export interface LegalReviewApiResponse extends SafetyEnvelope {
  module: string;
  facts: string[];
  claims: ClaimSummary[];
  legalReasoning: LegalReasoningOutput;
  risk: {
    level: string;
    score: number;
    reasons: string[];
    urgentFlags: string[];
  };
  compensation: CompensationEstimateOutput;
  citations: RagCitation[];
  evidenceGaps: string[];
  nextSteps: string[];
  documentsToGenerate: string[];
}
