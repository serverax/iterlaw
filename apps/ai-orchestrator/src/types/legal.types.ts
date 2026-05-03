/** Law modules supported by the mock pipeline (extend later). */
export type LawModule =
  | "employment-law"
  | "housing-law"
  | "immigration-law"
  | "benefits-law"
  | "debt-law";

/** POST /api/review body (after validation). */
export interface ReviewRequestInput {
  text: string;
  documents?: unknown[];
  module?: LawModule;
}

/** AEE structured extraction (mock). */
export interface AeeResult {
  facts: string[];
  datesMentioned: string[];
  employerGuess: string | null;
  employeeRoleGuess: string | null;
  issueTypeGuess: string | null;
}

/** ART tribunal-style reasoning (mock). */
export interface ArtResult {
  issues: string[];
  legalTests: string[];
  weaknesses: string[];
}

/** Risk engine output. */
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskResult {
  riskLevel: RiskLevel;
  riskScore: number;
  reasons: string[];
  urgentFlags: string[];
}

/** LVC valuation layer (mock). */
export interface LvcResult {
  compensationRange: string;
  remedies: string[];
  documents: string[];
  suggestedActions: string[];
  nextSteps: string[];
}

/** @deprecated Prefer `LegalReviewApiResponse` in `src/types/review-api.types.ts` (Phase 4+). */
export interface LegalReviewOutput {
  module: string;
  facts: string[];
  issues: string[];
  legalTests: string[];
  risk: {
    level: string;
    score: number;
    reasons: string[];
    urgentFlags: string[];
  };
  actions: string[];
  compensation: {
    estimate: string;
    range: string;
    notes: string[];
  };
  documents: string[];
  weaknesses: string[];
  nextSteps: string[];
}
