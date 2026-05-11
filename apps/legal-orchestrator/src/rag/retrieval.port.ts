// RetrievalPort — the adapter-side contract for legal source retrieval.
//
// `rag.types.ts` defines the *wire-level* types every caller agrees on
// (LegalChunk, RetrievalQuery, RetrievalResult). Adapters return a
// superset that carries display fields (title, url, citation_label) so
// the orchestrator can rank by title and build user-visible citations
// without a second DB hop.

import type { LegalChunk, RetrievalQuery } from "./rag.types";

/**
 * Adapter-level chunk: a `LegalChunk` plus optional display fields.
 * Returned by adapters that JOIN onto legal_documents / legal_sources.
 * Assignable to `LegalChunk[]` because every additional field is optional.
 */
export interface RetrievedLegalChunk extends LegalChunk {
  /** Document title; surfaced to keyword-overlap ranking. */
  title?: string;
  /** Public URL of the source if available. */
  url?: string;
  /** Human-readable label (e.g. "ERA 1996 s.95(1)(a)"). */
  citation_label?: string;
}

export interface RetrievalPortResult {
  chunks: RetrievedLegalChunk[];
  /** Non-authoritative diagnostics: ranking strategy, fallback hits, etc. */
  retrieval_notes?: string[];
}

/**
 * A RetrievalPort:
 *  - is async,
 *  - MUST honour the filters in RetrievalQuery (legal_pack, jurisdiction,
 *    topic, source_types, limit),
 *  - MUST NOT log or echo the raw query_text outside redaction-safe
 *    paths (the caller is expected to have run piiRedactor already),
 *  - MUST NOT throw with the database connection string or other secrets
 *    in the error message,
 *  - MAY return `{ chunks: [], retrieval_notes: ["..."] }` to signal a
 *    safe empty result (e.g. when DATABASE_URL is unset).
 */
export interface RetrievalPort {
  search(input: RetrievalQuery): Promise<RetrievalPortResult>;
}
