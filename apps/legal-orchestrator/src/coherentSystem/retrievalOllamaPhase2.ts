import { ollamaCacheTtlMs } from "./retrievalBand.js";
import type { Zone2RetrievalService } from "./zone2RetrievalTypes.js";

/** Conservative merge: shorter TTL wins (avoid stale cache). */
export function computeMergedOllamaTtlMs(zone1Ms: number, zone2Ms: number): number {
  return Math.min(zone1Ms, zone2Ms);
}

export function ollamaExpiresAtIso(mergedTtlMs: number, nowMs: number): string {
  return new Date(nowMs + mergedTtlMs).toISOString();
}

export interface OllamaCacheTtlPlan {
  readonly model: string;
  readonly zone1TtlMs: number;
  readonly zone2TtlMs: number;
  readonly mergedTtlMs: number;
}

/**
 * Sprint 27 — Ollama inference cache TTL: Zone 1 policy + Zone 2 stub hint.
 */
export class RetrievalOllamaPhase2Band {
  constructor(private readonly zone2: Zone2RetrievalService) {}

  async planCacheTtl(model: string): Promise<OllamaCacheTtlPlan> {
    const zone1TtlMs = ollamaCacheTtlMs(model);
    const { ttlMs: zone2TtlMs } = await this.zone2.suggestOllamaCacheTtl(model);
    return {
      model,
      zone1TtlMs,
      zone2TtlMs,
      mergedTtlMs: computeMergedOllamaTtlMs(zone1TtlMs, zone2TtlMs),
    };
  }
}
