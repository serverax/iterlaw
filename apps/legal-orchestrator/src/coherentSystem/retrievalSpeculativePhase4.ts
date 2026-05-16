import { createHash } from "node:crypto";
import { RetrievalOllamaPhase2Band } from "./retrievalOllamaPhase2.js";
import { RetrievalStreamingPhase3Band } from "./retrievalStreamingPhase3.js";
import type { Zone2RetrievalService } from "./zone2RetrievalTypes.js";

export function speculativeQueryHash(query: string, verifier: string): string {
  return createHash("sha256").update(`${query}\0${verifier}`).digest("hex").slice(0, 40);
}

export interface SpeculativeRowProjection {
  readonly queryHash: string;
  readonly draftTokens: readonly string[];
  readonly verifierTokens: readonly string[];
  readonly acceptanceRate: number;
  readonly mergedTtlMs: number;
  readonly streamChunkCount: number;
}

/**
 * Sprint 29 — Speculative decoding: Zone 2 draft/verify stubs plus Phase 2 TTL and Phase 3 chunk counts.
 */
export class RetrievalSpeculativePhase4Band {
  constructor(
    private readonly zone2: Zone2RetrievalService,
    private readonly ollamaPhase2: RetrievalOllamaPhase2Band,
    private readonly streamingPhase3: RetrievalStreamingPhase3Band,
  ) {}

  async computeDraftModel(query: string) {
    return this.zone2.speculativeDecodeDraft(query);
  }

  async verifyDraftTokens(draft: readonly string[], verifier: string) {
    return this.zone2.verifyDraftAgainstVerifier(draft, verifier);
  }

  async cacheSpeculativeResult(
    query: string,
    verifier: string,
    ctx: { readonly model: string; readonly requestId: string },
  ): Promise<SpeculativeRowProjection> {
    const draft = await this.computeDraftModel(query);
    const verified = await this.verifyDraftTokens(draft.draftTokens, verifier);
    const ttl = await this.ollamaPhase2.planCacheTtl(ctx.model);
    const stream = await this.streamingPhase3.streamResponseChunks({
      model: ctx.model,
      query,
      requestId: ctx.requestId,
    });
    const trimmed = verifier.trim();
    const verifierTokens = trimmed.length === 0 ? ["[empty-verifier]"] : trimmed.split(/\s+/).filter(Boolean);
    return {
      queryHash: speculativeQueryHash(query, verifier),
      draftTokens: draft.draftTokens,
      verifierTokens,
      acceptanceRate: verified.acceptanceRate,
      mergedTtlMs: ttl.mergedTtlMs,
      streamChunkCount: stream.chunks.length,
    };
  }

  computeSpeculativeCacheHitRate(hits: number, total: number): number {
    if (!Number.isFinite(hits) || !Number.isFinite(total) || total <= 0) {
      return 0;
    }
    return Math.min(1, Math.max(0, hits / total));
  }
}
