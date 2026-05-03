/**
 * Ingestion service — enqueue chunk indexing (embeddings + vector store later).
 * Phase 1: interface + mock only — no live scraping.
 */

import type { RagChunk, IngestionJob } from "./rag.types";

export interface IngestionService {
  /** Register a chunk for future embedding/indexing. Returns job id. */
  enqueueChunk(chunk: Omit<RagChunk, "chunkId">): Promise<IngestionJob>;
  getJob(jobId: string): Promise<IngestionJob | null>;
}

let jobSeq = 0;
const jobs = new Map<string, IngestionJob>();

export class MockIngestionService implements IngestionService {
  async enqueueChunk(chunk: Omit<RagChunk, "chunkId">): Promise<IngestionJob> {
    const jobId = `ing_${++jobSeq}_${Date.now().toString(36)}`;
    const job: IngestionJob = {
      jobId,
      sourceId: chunk.sourceId,
      status: "completed",
    };
    jobs.set(jobId, job);
    return job;
  }

  async getJob(jobId: string): Promise<IngestionJob | null> {
    return jobs.get(jobId) ?? null;
  }
}
