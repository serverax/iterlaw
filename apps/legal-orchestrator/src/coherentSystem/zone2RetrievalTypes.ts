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

export interface Zone2RetrievalService {
  suggestRemoteHnswBuild(params: HnswBuildParams): Promise<Zone2HnswBuildSpec>;
  /** Zone 2 Ollama cache TTL suggestion (stub until remote policy service exists). */
  suggestOllamaCacheTtl(model: string): Promise<Zone2OllamaTtlHint>;
  /** Zone 2 chunked Ollama-style response (stub). */
  streamOllamaResponseChunked(query: string): Promise<readonly Zone2StreamChunk[]>;
}
