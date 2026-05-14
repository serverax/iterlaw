// Sprint 19B — Postgres retrieval adapters for the multi-tier retrieval engine.
//
// Bridges between the existing `RetrievalPort` (rag/retrieval.port.ts) used by
// the legacy answer path and the new dependency-injected `FullTextSearch` /
// `VectorSearch` interfaces consumed by `planAndExecuteMultiTier`.
//
// Safety contract:
//   - Mock-safe by design: if no port is provided, both adapters return an
//     empty candidate array (the planner records this as `no_results`).
//   - All thrown errors from the underlying port are swallowed and converted
//     into an empty candidate array — the planner never sees a leaked DB
//     connection string.
//   - This module performs no network or DB call itself. It only ADAPTS a
//     RetrievalPort that the caller already constructed (typically
//     `PostgresRetrieval` from rag/postgresRetrieval.ts).
//   - The vector adapter never executes a real pgvector search in this sprint;
//     the underlying `PostgresRetrieval` is FTS-only. The adapter therefore
//     ALWAYS returns an empty array for vector mode and the planner records
//     `vector_tier_empty` — this is honest. A future sprint can add a
//     `vectorSearch` capability to the port.

import type { RetrievalPort, RetrievalPortResult, RetrievedLegalChunk } from "../rag/retrieval.port";
import type { CorpusSourceType } from "../rag/rag.types";
import type { RetrievalCandidate, RetrievalSource } from "../intelligence/intelligence.types";
import type { FullTextSearch } from "./fullTextTier";
import type { VectorSearch } from "./vectorTier";

export interface PostgresAdapterOptions {
  /**
   * Legal pack the orchestrator scopes every retrieval call to. Required
   * because the underlying `RetrievalQuery` mandates it.
   */
  readonly legalPack: string;
  /**
   * Optional jurisdiction filter (e.g. "UK_ENGLAND_WALES").
   */
  readonly jurisdiction?: string;
  /**
   * Optional topic / law-area filter.
   */
  readonly topic?: string;
  /**
   * Maximum results to ask the port for. Hard cap; the tier-level limit
   * overrides this only downward.
   */
  readonly hardLimit?: number;
}

function mapCorpusSourceType(s: CorpusSourceType): RetrievalSource {
  switch (s) {
    case "legislation":
      return "statutory_source";
    case "gov_guidance":
      return "govuk_guidance";
    case "tribunal_case":
      return "tribunal_case";
    case "acas_guidance":
      return "acas_guidance";
    case "hmcts":
      return "tribunal_case";
    case "ehrc":
      return "govuk_guidance";
    case "internal_template":
      return "approved_output";
    default:
      return "approved_output";
  }
}

function mapChunkToCandidate(
  chunk: RetrievedLegalChunk,
  rank: number,
): RetrievalCandidate {
  return {
    candidate_id: chunk.chunk_id,
    source_type: mapCorpusSourceType(chunk.source_type),
    source_id: chunk.document_id,
    source_title: chunk.title ?? null,
    source_url: chunk.url ?? null,
    text: chunk.chunk_text,
    effective_from: chunk.effective_date ?? null,
    effective_to: chunk.applicable_to ?? null,
    last_verified_at: null,
    superseded_by: null,
    qa_status: "approved",
    authority_level: chunk.authority_level,
    keyword_rank: rank,
    vector_rank: null,
    reason_codes: ["postgres_full_text_adapter"],
  };
}

/**
 * Build a `FullTextSearch` function that delegates to the provided
 * `RetrievalPort`. When `port` is undefined or its search throws, the adapter
 * returns an empty array safely.
 */
export function createPostgresFullTextSearch(
  port: RetrievalPort | undefined,
  options: PostgresAdapterOptions,
): FullTextSearch {
  return async (question, { limit }) => {
    if (!port) return [];
    const effectiveLimit = Math.min(
      limit,
      options.hardLimit ?? Number.POSITIVE_INFINITY,
    );
    let portResult: RetrievalPortResult;
    try {
      portResult = await port.search({
        legal_pack: options.legalPack,
        query_text: question,
        jurisdiction: options.jurisdiction,
        topic: options.topic,
        limit: effectiveLimit,
      });
    } catch {
      // Swallow port errors deliberately — connection strings, DB names, and
      // any other secret-shaped detail must never reach the caller.
      return [];
    }
    const chunks = portResult.chunks ?? [];
    if (chunks.length === 0) return [];
    return chunks.slice(0, effectiveLimit).map((c, i) => mapChunkToCandidate(c, i + 1));
  };
}

/**
 * Build a `VectorSearch` function. The current Postgres adapter is FTS-only;
 * this function always returns an empty array so the planner records
 * `vector_tier_empty` honestly. A future sprint can wire pgvector here.
 */
export function createPostgresVectorSearch(
  _port: RetrievalPort | undefined,
  _options: PostgresAdapterOptions,
): VectorSearch {
  return async () => {
    // Intentionally empty — no pgvector search wired in this sprint.
    return [];
  };
}

/**
 * Convenience factory: builds both adapters from a single port + options.
 */
export function createPostgresRetrievalAdapters(
  port: RetrievalPort | undefined,
  options: PostgresAdapterOptions,
): { fullTextSearch: FullTextSearch; vectorSearch: VectorSearch } {
  return {
    fullTextSearch: createPostgresFullTextSearch(port, options),
    vectorSearch: createPostgresVectorSearch(port, options),
  };
}
