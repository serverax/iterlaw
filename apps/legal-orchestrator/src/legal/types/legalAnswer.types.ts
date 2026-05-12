// Public answer envelope returned by handleEmploymentLawQuestion.
// Every field here is allowed to surface to the caller. No PII.

import type { AnswerStatus } from "./legalRag.types";
import type { SourceType } from "./legalSource.types";

export interface LegalCitation {
  title: string;
  sourceType: SourceType;
  sourceUrl: string;
  sectionReference?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface LegalAnswer {
  answerStatus: AnswerStatus;
  summary: string;
  legalPosition?: string;
  missingFacts: string[];
  citations: LegalCitation[];
  practicalSteps: string[];
  deadlines: string[];
  riskFlags: string[];
  confidenceScore: number;
  sourceQualityScore: number;
  ragRunId?: string;
}
