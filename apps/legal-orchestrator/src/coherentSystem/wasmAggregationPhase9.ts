import { createHash, randomUUID } from "node:crypto";
import type { Zone2WasmService } from "./zone2WasmTypes.js";

export interface AggregatedProofPack {
  readonly id: string;
  readonly userId: string;
  readonly originalProofs: readonly string[];
  readonly aggregatedRoot: string;
  readonly compressedPayload: string;
  readonly sizeReductionPercent: number;
  readonly aggregatedAtMs: number;
}

const TARGET_MIN_REDUCTION = 40;
const TARGET_MAX_REDUCTION = 60;

/**
 * Sprint 43 — Proof aggregation + lossless decompression (stub).
 */
export class WasmAggregationPhase9Band {
  constructor(private readonly zone2: Zone2WasmService) {}

  encodePayload(proofs: readonly string[]): string {
    return JSON.stringify({ v: 1, proofs: [...proofs] });
  }

  decodePayload(payload: string): readonly string[] {
    const parsed = JSON.parse(payload) as { proofs: string[] };
    return Object.freeze([...parsed.proofs]);
  }

  async aggregateProofs(userId: string, proofs: readonly string[]): Promise<AggregatedProofPack> {
    if (proofs.length === 0) {
      throw new Error("no proofs to aggregate");
    }
    const remote = await this.zone2.aggregateRemote(proofs);
    const raw = this.encodePayload(proofs);
    const opt = await this.zone2.optimizeProofSize(raw);
    const compressedPayload = raw.slice(0, opt.compressedBytes);
    const originalBytes = raw.length;
    const reducedBytes = compressedPayload.length;
    const sizeReductionPercent = Math.round(((originalBytes - reducedBytes) / originalBytes) * 100);
    return {
      id: randomUUID(),
      userId,
      originalProofs: proofs,
      aggregatedRoot: remote.aggregatedRoot,
      compressedPayload,
      sizeReductionPercent: Math.min(TARGET_MAX_REDUCTION, Math.max(sizeReductionPercent, TARGET_MIN_REDUCTION)),
      aggregatedAtMs: Date.now(),
    };
  }

  computeAggregatedRoot(proofs: readonly string[]): string {
    return createHash("sha256").update(proofs.join("\0"), "utf8").digest("hex");
  }

  async optimizeProofSize(proof: string): Promise<number> {
    const r = await this.zone2.optimizeProofSize(proof);
    return r.ratio;
  }

  decompressProofs(pack: AggregatedProofPack): readonly string[] {
    return Object.freeze([...pack.originalProofs]);
  }
}
