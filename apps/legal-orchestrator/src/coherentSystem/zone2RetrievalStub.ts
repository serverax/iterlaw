import type {
  HnswBuildParams,
  Zone2HnswBuildSpec,
  Zone2OllamaTtlHint,
  Zone2RetrievalService,
  Zone2StreamChunk,
} from "./zone2RetrievalTypes.js";
import { ollamaCacheTtlMs } from "./retrievalBand.js";

/**
 * Deterministic Zone 2 retrieval stub — no network I/O.
 * Slightly raises lists floor so Zone 1 can merge with `hnswEfSearchDefault`.
 */
export class Zone2RetrievalServiceStub implements Zone2RetrievalService {
  async suggestRemoteHnswBuild(params: HnswBuildParams): Promise<Zone2HnswBuildSpec> {
    const recommendedLists = Math.min(128, Math.max(16, params.lists + 8));
    const safeLane = params.laneId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeIdx = params.indexName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const remoteIndexId = `milvus-stub-${safeLane}-${safeIdx}`.slice(0, 120);
    return { remoteIndexId, recommendedLists };
  }

  /**
   * Shorter TTL than Zone 1 baseline so merged TTL uses conservative `min(zone1, zone2)`.
   */
  async suggestOllamaCacheTtl(model: string): Promise<Zone2OllamaTtlHint> {
    const base = ollamaCacheTtlMs(model);
    const ttlMs = Math.max(60_000, base - 3_600_000);
    return { ttlMs };
  }

  async streamOllamaResponseChunked(query: string): Promise<readonly Zone2StreamChunk[]> {
    const q = query.trim();
    const words = q ? q.split(/\s+/).filter(Boolean) : [];
    if (words.length === 0) {
      return [{ seq: 0, text: "[noop]" }];
    }
    return words.map((w, i) => ({ seq: i, text: w }));
  }
}
