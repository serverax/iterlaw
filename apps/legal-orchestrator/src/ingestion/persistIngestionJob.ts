import type { TextChunk } from "./types";

export interface PersistIngestionConfig {
  dryRun: boolean;
  writeChunks: boolean;
}

export interface PersistenceSink {
  persistJob(payload: {
    jobId: string;
    canonicalUrl: string;
    versionHash: string;
  }): Promise<void>;
  persistChunks(payload: { jobId: string; chunks: TextChunk[] }): Promise<void>;
}

export const noOpPersistenceSink: PersistenceSink = {
  async persistJob() {},
  async persistChunks() {},
};

export interface PersistOutcome {
  jobSaved: boolean;
  chunksWritten: number;
}

/**
 * Persists ingestion outcomes. In `dryRun`, performs no I/O on the sink.
 * When not dry-run and `writeChunks` is false, only job metadata is written.
 */
export async function persistIngestionJob(
  input: {
    jobId: string;
    canonicalUrl: string;
    versionHash: string;
    chunks: TextChunk[];
  },
  config: PersistIngestionConfig,
  sink: PersistenceSink = noOpPersistenceSink
): Promise<PersistOutcome> {
  if (config.dryRun) {
    return { jobSaved: false, chunksWritten: 0 };
  }

  await sink.persistJob({
    jobId: input.jobId,
    canonicalUrl: input.canonicalUrl,
    versionHash: input.versionHash,
  });

  if (!config.writeChunks || input.chunks.length === 0) {
    return { jobSaved: true, chunksWritten: 0 };
  }

  await sink.persistChunks({ jobId: input.jobId, chunks: input.chunks });
  return { jobSaved: true, chunksWritten: input.chunks.length };
}
