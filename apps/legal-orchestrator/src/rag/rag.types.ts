// RAG adapter contracts for the next sprint. Types only — no retrieval logic.

export type CorpusSourceType =
  | "legislation"
  | "gov_guidance"
  | "tribunal_case"
  | "acas_guidance"
  | "hmcts"
  | "ehrc"
  | "internal_template";

export interface LegalCorpusDocument {
  document_id: string;
  corpus_id: string;
  source_type: CorpusSourceType;
  title: string;
  canonical_url?: string;
  jurisdiction?: string;
  effective_from?: string;
  effective_to?: string;
  /** Opaque hash for cache-busting / provenance (implementation-defined). */
  content_hash?: string;
}

export interface LegalChunk {
  chunk_id: string;
  document_id: string;
  source_type: CorpusSourceType;
  chunk_index: number;
  chunk_text: string;
  token_count_estimate?: number;
  section_reference?: string;
  paragraph_reference?: string;
  authority_level: number;
  embedding_model?: string;
  /** ISO date (YYYY-MM-DD) when this chunk’s text is in force, if known. */
  effective_date?: string;
  /** ISO date (YYYY-MM-DD) last day this version applies, inclusive; null = open-ended. */
  applicable_to?: string;
}

export interface LegalCitation {
  chunk_id: string;
  document_id: string;
  source_type: CorpusSourceType;
  quote_text?: string;
  section_reference?: string;
  /** Normalised citation string for UI (e.g. "ERA 1996 s.98"). */
  display_label?: string;
}

export interface RetrievalQuery {
  legal_pack: string;
  /** Redacted / safe query text only. */
  query_text: string;
  topic?: string;
  jurisdiction?: string;
  limit: number;
  /** Optional filters for corpus slices. */
  source_types?: CorpusSourceType[];
  /** Optional temporal filter: ISO date (YYYY-MM-DD) “law as at” selection. */
  filters?: {
    applicable_on?: string;
  };
}

export interface RetrievalResult {
  chunks: LegalChunk[];
  /** Diagnostics for ranking / truncation (non-authoritative). */
  retrieval_notes?: string[];
}
