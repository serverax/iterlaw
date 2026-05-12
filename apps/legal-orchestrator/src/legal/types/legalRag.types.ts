// RAG run + verification types. Rows in `rag_runs`,
// `source_update_log`, `answer_verification_log`,
// `verified_answers_cache`.

import type { LegalArea, LegalCase, LegalChunk } from "./legalDocument.types";

export type LegalIssueType =
  | "unfair_dismissal"
  | "constructive_dismissal"
  | "redundancy"
  | "discrimination"
  | "whistleblowing"
  | "wages"
  | "holiday_pay"
  | "working_time"
  | "maternity_paternity"
  | "settlement_agreement"
  | "tribunal_procedure"
  | "limitation_deadline"
  | "remedy_compensation"
  | "unknown";

export type AnswerStatus =
  | "answered"
  | "needs_more_facts"
  | "high_risk"
  | "insufficient_sources"
  | "verification_failed";

export type RetrievalMode =
  | "cache_hit"
  | "vector"
  | "lexical"
  | "hybrid"
  | "none";

export interface RagRunRecord {
  id: string;
  userQuestion: string;
  normalizedQuestion?: string;
  jurisdiction: string;
  legalArea?: LegalArea;
  issueType?: LegalIssueType[];
  retrievalMode?: RetrievalMode;
  sourcesUsed: Array<{
    documentId: string;
    chunkId?: string;
    relevance?: number;
  }>;
  confidenceScore?: number;
  answerStatus: AnswerStatus;
  riskFlags?: string[];
  createdAt: string;
}

export interface SourceUpdateLogEntry {
  id: string;
  sourceId?: string;
  documentId?: string;
  sourceUrl: string;
  previousHash?: string;
  newHash?: string;
  updateType: "created" | "amended" | "superseded" | "withdrawn" | "rechecked";
  createdAt: string;
}

export interface AnswerVerificationLogEntry {
  id: string;
  ragRunId?: string;
  answerCacheId?: string;
  verificationStatus: "pass" | "fail" | "partial" | "skipped";
  failedChecks?: string[];
  verifierNotes: Record<string, unknown>;
  createdAt: string;
}

/** Result envelope for one retrieval call. */
export interface RagRetrievalResult {
  chunks: LegalChunk[];
  cases: LegalCase[];
  mode: RetrievalMode;
  notes: string[];
}
