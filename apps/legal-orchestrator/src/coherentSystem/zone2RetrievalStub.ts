import type { HnswBuildParams, Zone2HnswBuildSpec, Zone2RetrievalService } from "./zone2RetrievalTypes.js";

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
}
