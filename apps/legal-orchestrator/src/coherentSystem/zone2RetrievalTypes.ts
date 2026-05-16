/** Sprint 26 — Zone 2 retrieval contract (Milvus / remote HNSW; stubbed). */

export type HnswDistance = "cosine" | "l2" | "ip";

export interface HnswBuildParams {
  readonly laneId: string;
  readonly indexName: string;
  readonly dimensions: number;
  readonly distance: HnswDistance;
  readonly lists: number;
  readonly m: number;
  readonly efConstruction: number;
}

export interface Zone2HnswBuildSpec {
  readonly remoteIndexId: string;
  /** Zone 2 suggested lists hint for Zone 1 ef_search tuning (not always a PG index param). */
  readonly recommendedLists: number;
}

export interface Zone2OllamaTtlHint {
  readonly ttlMs: number;
}

export interface Zone2StreamChunk {
  readonly seq: number;
  readonly text: string;
}

/** Sprint 29 — mock draft model output. */
export interface Zone2SpeculativeDraft {
  readonly draftTokens: readonly string[];
}

/** Sprint 29 — mock verifier acceptance. */
export interface Zone2SpeculativeVerify {
  readonly acceptanceRate: number;
}

/** Sprint 30 — mock SLA budget from request size. */
export interface Zone2LatencyBudget {
  readonly slaTargetMs: number;
}

/** Sprint 31 — mock optimized remote plan. */
export interface Zone2OptimizedQueryPlan {
  readonly fingerprint: string;
  readonly executionPlan: Readonly<Record<string, unknown>>;
  readonly estRows: number;
}

/** Sprint 32 — one row from remote batch execution (stub). */
export interface Zone2BatchRemoteRow {
  readonly queryIndex: number;
  readonly summary: string;
}

/** Sprint 33 — mock invalidation TTL for a cache type key. */
export interface Zone2InvalidationTtlHint {
  readonly ttlSeconds: number;
}

export interface Zone2RetrievalService {
  suggestRemoteHnswBuild(params: HnswBuildParams): Promise<Zone2HnswBuildSpec>;
  /** Zone 2 Ollama cache TTL suggestion (stub until remote policy service exists). */
  suggestOllamaCacheTtl(model: string): Promise<Zone2OllamaTtlHint>;
  /** Zone 2 chunked Ollama-style response (stub). */
  streamOllamaResponseChunked(query: string): Promise<readonly Zone2StreamChunk[]>;
  /** Sprint 29 — speculative draft tokens (stub). */
  speculativeDecodeDraft(query: string): Promise<Zone2SpeculativeDraft>;
  /** Sprint 29 — draft vs verifier acceptance rate (stub). */
  verifyDraftAgainstVerifier(draft: readonly string[], verifier: string): Promise<Zone2SpeculativeVerify>;
  /** Sprint 30 — latency SLA budget hint from logical request size (stub). */
  computeLatencyBudget(requestSize: number): Promise<Zone2LatencyBudget>;
  /** Sprint 31 — remote query plan optimization (stub). */
  optimizeQueryRemote(query: string): Promise<Zone2OptimizedQueryPlan>;
  /** Sprint 32 — remote batch query execution (stub). */
  processBatchRemote(queries: readonly string[]): Promise<readonly Zone2BatchRemoteRow[]>;
  /** Sprint 33 — cache invalidation TTL recommendation (stub). */
  suggestInvalidationTtl(cacheType: string): Promise<Zone2InvalidationTtlHint>;
}
