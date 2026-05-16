import { createHash } from "node:crypto";
import type { Zone2WasmService } from "./zone2WasmTypes.js";

export interface ClientProofRecord {
  readonly userId: string;
  readonly proofHash: string;
  readonly generatedAtMs: number;
  readonly expiresAtMs: number;
  readonly payload: Readonly<Record<string, unknown>>;
}

/**
 * Sprint 37 — Local proof generation + transport serialization + in-memory cache.
 */
export class WasmClientProofPhase3Band {
  private readonly cache = new Map<string, ClientProofRecord>();

  constructor(private readonly zone2: Zone2WasmService) {}

  async generateProofLocally(userId: string, evidenceType: string, claim: string): Promise<ClientProofRecord> {
    const template = await this.zone2.generateProofTemplate(evidenceType);
    const proofHash = createHash("sha256")
      .update(`${userId}|${evidenceType}|${claim}|${template.templateId}`)
      .digest("hex");
    const now = Date.now();
    const record: ClientProofRecord = {
      userId,
      proofHash,
      generatedAtMs: now,
      expiresAtMs: now + 3_600_000,
      payload: { ...template.skeleton, claim, proofHash },
    };
    return record;
  }

  serializeProofForTransport(record: ClientProofRecord): string {
    return JSON.stringify({
      proofHash: record.proofHash,
      generatedAt: record.generatedAtMs,
      expiresAt: record.expiresAtMs,
      payload: record.payload,
    });
  }

  cacheProofResult(record: ClientProofRecord): void {
    this.cache.set(`${record.userId}:${record.proofHash}`, record);
  }

  getCachedProof(userId: string, proofHash: string, nowMs = Date.now()): ClientProofRecord | null {
    const rec = this.cache.get(`${userId}:${proofHash}`);
    if (!rec) {
      return null;
    }
    if (rec.expiresAtMs <= nowMs) {
      this.cache.delete(`${userId}:${proofHash}`);
      return null;
    }
    return rec;
  }

  isExpired(record: ClientProofRecord, nowMs = Date.now()): boolean {
    return record.expiresAtMs <= nowMs;
  }
}
