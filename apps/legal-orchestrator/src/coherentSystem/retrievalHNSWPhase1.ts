import { hnswEfSearchDefault } from "./retrievalBand.js";
import type { HnswBuildParams, HnswDistance, Zone2RetrievalService } from "./zone2RetrievalTypes.js";

export type { HnswBuildParams, HnswDistance } from "./zone2RetrievalTypes.js";
export type { Zone2HnswBuildSpec, Zone2RetrievalService } from "./zone2RetrievalTypes.js";

export function vectorOpClassFor(distance: HnswDistance): string {
  if (distance === "cosine") return "vector_cosine_ops";
  if (distance === "l2") return "vector_l2_ops";
  return "vector_ip_ops";
}

/** SQL template for pgvector HNSW (Zone 1 operator DDL hint; not executed here). */
export function buildHnswCreateIndexSql(args: {
  indexName: string;
  tableQualified: string;
  column: string;
  distance: HnswDistance;
  m: number;
  efConstruction: number;
}): string {
  const op = vectorOpClassFor(args.distance);
  return `CREATE INDEX IF NOT EXISTS ${args.indexName} ON ${args.tableQualified} USING hnsw (${args.column} ${op}) WITH (m = ${args.m}, ef_construction = ${args.efConstruction});`;
}

/** Strip obvious email-like tokens before crossing the Zone 2 boundary. */
export function anonymizeRetrievalQueryHint(q: string): string {
  return q.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL]");
}

export interface RetrievalHnswMergePlan {
  readonly zone1Lists: number;
  readonly zone2RecommendedLists: number;
  readonly mergedListsForEfSearch: number;
  readonly efSearch: number;
  readonly remoteIndexId: string;
  readonly createIndexSqlHint: string;
}

/**
 * Sprint 26 — HNSW Phase 1: merge Zone 1 build params with Zone 2 stub hints.
 */
export class RetrievalHNSWPhase1Band {
  constructor(private readonly zone2: Zone2RetrievalService) {}

  async planBuild(params: HnswBuildParams): Promise<RetrievalHnswMergePlan> {
    const remote = await this.zone2.suggestRemoteHnswBuild(params);
    const mergedListsForEfSearch = Math.max(params.lists, remote.recommendedLists);
    return {
      zone1Lists: params.lists,
      zone2RecommendedLists: remote.recommendedLists,
      mergedListsForEfSearch,
      efSearch: hnswEfSearchDefault(mergedListsForEfSearch),
      remoteIndexId: remote.remoteIndexId,
      createIndexSqlHint: buildHnswCreateIndexSql({
        indexName: params.indexName,
        tableQualified: "public.legal_chunks",
        column: "embedding",
        distance: params.distance,
        m: params.m,
        efConstruction: params.efConstruction,
      }),
    };
  }
}
