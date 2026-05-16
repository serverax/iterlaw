import { streamingChunksOrdered } from "./retrievalBand.js";
import { RetrievalOllamaPhase2Band } from "./retrievalOllamaPhase2.js";
import type { Zone2RetrievalService } from "./zone2RetrievalTypes.js";

export interface StreamedChunk {
  readonly chunkSequence: number;
  readonly chunkText: string;
}

export interface StreamingBundle {
  readonly chunks: readonly StreamedChunk[];
  readonly mergedTtlMs: number;
}

export interface ChunkCaptureMeta {
  readonly requestId: string;
  readonly sliceCount: number;
  readonly contiguous: boolean;
}

/**
 * Sprint 28 — Streaming: Zone 2 stub chunks + Phase 2 merged TTL context.
 */
export class RetrievalStreamingPhase3Band {
  constructor(
    private readonly zone2: Zone2RetrievalService,
    private readonly ollamaPhase2: RetrievalOllamaPhase2Band,
  ) {}

  async streamResponseChunks(params: {
    readonly model: string;
    readonly query: string;
    readonly requestId: string;
  }): Promise<StreamingBundle> {
    const ttl = await this.ollamaPhase2.planCacheTtl(params.model);
    const raw = await this.zone2.streamOllamaResponseChunked(params.query);
    const chunks = raw.map((c) => ({ chunkSequence: c.seq, chunkText: c.text }));
    return { chunks, mergedTtlMs: ttl.mergedTtlMs };
  }

  captureChunkMetadata(chunks: readonly StreamedChunk[], requestId: string): ChunkCaptureMeta {
    return {
      requestId,
      sliceCount: chunks.length,
      contiguous: streamingChunksOrdered(chunks.map((c) => ({ seq: c.chunkSequence }))),
    };
  }
}
