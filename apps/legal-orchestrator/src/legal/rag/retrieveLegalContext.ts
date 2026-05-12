// retrieveLegalContext — placeholder for the canonical RAG retrieval
// path. Real retrieval will join `legal_chunks` (1-chain canonical
// schema, see docs/iterlaw/RAG_SCHEMA_CANONICAL_DECISION.md) and
// `legal_cases` and rank by authority + recency + temporal window.
//
// Until that path is wired this placeholder always returns
// `{ retrievalStatus: "not_wired", chunks: [], citations: [] }` so
// the orchestrator can safely route a `rag_grounded` decision
// without crashing or fabricating data.

import type { LegalCitation } from "../types/legalAnswer.types";

export interface RetrieveLegalContextResult {
  retrievalStatus: "not_wired" | "ok" | "no_match";
  chunks: ReadonlyArray<{
    chunkId: string;
    documentId: string;
    text: string;
    citationLabel?: string;
    sectionReference?: string;
    authorityScore?: number;
  }>;
  citations: ReadonlyArray<LegalCitation>;
}

export interface RetrieveLegalContextInput {
  normalizedQuestion: string;
  jurisdiction: string;
  applicableOn?: string;
  limit?: number;
}

export async function retrieveLegalContext(
  _input: RetrieveLegalContextInput
): Promise<RetrieveLegalContextResult> {
  return {
    retrievalStatus: "not_wired",
    chunks: [],
    citations: [],
  };
}
