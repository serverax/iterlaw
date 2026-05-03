/**
 * RAG types — Phase 1. Embeddings + pgvector / Supabase later.
 */

export type JurisdictionCode = "UK" | "EW" | "SCT" | "NI";

export type RagSourceCategory =
  | "legislation"
  | "guidance"
  | "acas"
  | "tribunal"
  | "appeal-court";

/** Registered knowledge source (curated catalogue — not scraped). */
export interface RagSourceRecord {
  sourceId: string;
  title: string;
  url: string;
  jurisdiction: JurisdictionCode;
  /** ISO publication / last-known amendment date */
  date?: string;
  version?: string;
  paragraphRef?: string;
  category: RagSourceCategory;
}

/** Stored chunk (section / paragraph aligned). */
export interface RagChunk {
  chunkId: string;
  sourceId: string;
  /** Full chunk body for internal use / embeddings later */
  text: string;
  title: string;
  url: string;
  jurisdiction: JurisdictionCode;
  date?: string;
  version?: string;
  paragraphRef?: string;
  /** Short plain-language summary for UI / API */
  summary: string;
  category?: RagSourceCategory;
}

/**
 * Citation attached to legal output — every retrieved hit includes
 * title, url, jurisdiction, date, paragraphRef, summary.
 */
export interface RagCitation {
  chunkId: string;
  sourceId: string;
  title: string;
  url: string;
  jurisdiction: JurisdictionCode;
  /** ISO date when known */
  date?: string;
  paragraphRef?: string;
  summary: string;
}

export interface RetrievalQuery {
  queryText: string;
  module?: string;
  topK?: number;
}

export interface RetrievalResult {
  chunks: RagChunk[];
  citations: RagCitation[];
}

export interface IngestionJob {
  jobId: string;
  sourceId: string;
  status: "queued" | "processing" | "completed" | "failed";
}
