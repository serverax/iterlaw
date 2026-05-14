// Sprint 32 — pgvector VectorSearch adapter.
//
// Foundation. Takes a query embedding (number[]) plus an injected
// `PgvectorClient` and returns mapped `RetrievalCandidate[]`. The adapter
// is mock-safe: with no client it returns []; with a client that errors
// it swallows the error and returns []. DATABASE_URL is never read,
// printed, or echoed in this file — the upstream client owns it.
//
// Pure adapter. No production DB. No external LLM.

import type { RetrievalCandidate, RetrievalSource } from "../intelligence/intelligence.types";
import type { CorpusSourceType } from "../rag/rag.types";

export interface PgvectorSearchOptions {
  readonly limit: number;
  readonly jurisdiction?: string;
  readonly lawArea?: string;
  /** Optional ISO date — rejects candidates whose `effective_to < this` if present. */
  readonly effectiveAtIsoDate?: string;
  /** Optional minimum source-tier rank (1 = highest authority). */
  readonly minAuthorityLevel?: number;
}

/**
 * Row shape the adapter expects from the underlying pgvector query. Designed
 * to match what `legal_chunks JOIN legal_documents JOIN legal_sources` would
 * return ordered by `embedding <=> $query` ASC.
 */
export interface PgvectorRow {
  readonly chunk_id: string;
  readonly document_id: string;
  readonly source_type: string;
  readonly chunk_text: string;
  readonly title?: string | null;
  readonly url?: string | null;
  readonly authority_level?: number | null;
  readonly effective_date?: string | null;
  readonly applicable_to?: string | null;
  /** Distance returned by `embedding <=> $query` — lower is closer. */
  readonly distance?: number | null;
}

export interface PgvectorClient {
  searchByEmbedding(
    embedding: ReadonlyArray<number>,
    options: PgvectorSearchOptions,
  ): Promise<ReadonlyArray<PgvectorRow>> | ReadonlyArray<PgvectorRow>;
}

const KNOWN_SOURCE_MAP: Record<string, RetrievalSource> = {
  legislation: "statutory_source",
  gov_guidance: "govuk_guidance",
  tribunal_case: "tribunal_case",
  acas_guidance: "acas_guidance",
  hmcts: "tribunal_case",
  ehrc: "govuk_guidance",
  internal_template: "approved_output",
};

function mapSourceType(s: string): RetrievalSource {
  return (KNOWN_SOURCE_MAP[s as CorpusSourceType] as RetrievalSource | undefined) ?? "approved_output";
}

function rowToCandidate(row: PgvectorRow, rank: number): RetrievalCandidate {
  return {
    candidate_id: row.chunk_id,
    source_type: mapSourceType(row.source_type),
    source_id: row.document_id,
    source_title: row.title ?? null,
    source_url: row.url ?? null,
    text: row.chunk_text,
    effective_from: row.effective_date ?? null,
    effective_to: row.applicable_to ?? null,
    last_verified_at: null,
    superseded_by: null,
    qa_status: "approved",
    authority_level: row.authority_level ?? null,
    keyword_rank: null,
    vector_rank: rank,
    reason_codes: ["pgvector_adapter"],
  };
}

export interface PgvectorAdapterOptions {
  readonly client?: PgvectorClient;
  readonly hardLimit?: number;
}

/**
 * Build a search function that takes a `(embedding, options)` pair and
 * returns mapped candidates. Mock-safe — with no client returns [];
 * with a client that throws returns [].
 */
export function createPgvectorSearch(
  adapterOptions: PgvectorAdapterOptions,
): (embedding: ReadonlyArray<number>, opts: PgvectorSearchOptions) => Promise<ReadonlyArray<RetrievalCandidate>> {
  return async (embedding, opts) => {
    if (!adapterOptions.client) return [];
    if (!embedding || embedding.length === 0) return [];
    const effectiveLimit = Math.min(opts.limit, adapterOptions.hardLimit ?? Number.POSITIVE_INFINITY);
    let rows: ReadonlyArray<PgvectorRow>;
    try {
      rows = await Promise.resolve(adapterOptions.client.searchByEmbedding(embedding, { ...opts, limit: effectiveLimit }));
    } catch {
      return [];
    }
    if (!rows || rows.length === 0) return [];
    return rows.slice(0, effectiveLimit).map((r, i) => rowToCandidate(r, i + 1));
  };
}

/**
 * Bridge to the planner's `VectorSearch` interface, which receives a question
 * string. Requires an injected `embedder` (e.g. ONNX / Ollama embed call).
 * When no embedder is supplied, returns []. No external LLM call is made here;
 * the embedder is the caller's responsibility.
 */
export interface QuestionToEmbedding {
  (question: string): ReadonlyArray<number> | Promise<ReadonlyArray<number>>;
}

export function createPgvectorSearchFromEmbedder(
  client: PgvectorClient | undefined,
  embedder: QuestionToEmbedding | undefined,
  adapterOptions: PgvectorAdapterOptions = {},
): (question: string, opts: { limit: number }) => Promise<RetrievalCandidate[]> {
  const search = createPgvectorSearch({ ...adapterOptions, client: client ?? adapterOptions.client });
  return async (question, opts) => {
    if (!embedder) return [];
    let emb: ReadonlyArray<number>;
    try {
      emb = await Promise.resolve(embedder(question));
    } catch {
      return [];
    }
    const out = await search(emb, { limit: opts.limit });
    return out.slice() as RetrievalCandidate[];
  };
}
