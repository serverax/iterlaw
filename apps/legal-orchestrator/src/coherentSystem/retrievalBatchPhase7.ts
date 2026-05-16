import { randomUUID } from "node:crypto";
import type { Zone2BatchRemoteRow, Zone2RetrievalService } from "./zone2RetrievalTypes.js";

export interface BatchJobQueued {
  readonly jobId: string;
  readonly userId: string;
  readonly batchSize: number;
  readonly status: "queued";
  readonly startedAtMs: number;
}

/**
 * Sprint 32 — Batch queue + parallel remote execution (stub) + aggregation.
 */
export class RetrievalBatchPhase7Band {
  constructor(private readonly zone2: Zone2RetrievalService) {}

  queueBatchQueries(userId: string, queries: readonly string[]): BatchJobQueued {
    if (queries.length === 0) {
      throw new RangeError("queueBatchQueries requires at least one query");
    }
    return {
      jobId: randomUUID(),
      userId,
      batchSize: queries.length,
      status: "queued",
      startedAtMs: Date.now(),
    };
  }

  async processBatchParallel(queries: readonly string[]): Promise<readonly Zone2BatchRemoteRow[]> {
    return this.zone2.processBatchRemote(queries);
  }

  aggregateBatchResults(rows: readonly Zone2BatchRemoteRow[]): { readonly joined: string; readonly count: number } {
    return { joined: rows.map((r) => r.summary).join("|"), count: rows.length };
  }
}
