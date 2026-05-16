import { createHash, randomUUID } from "node:crypto";
import type { Zone2WasmService } from "./zone2WasmTypes.js";

export interface SignedPackageRecord {
  readonly id: string;
  readonly userId: string;
  readonly packageHash: string;
  readonly signature: string;
  readonly publicKeyId: string;
  readonly signedAtMs: number;
}

/**
 * Sprint 38 — Sign / verify evidence packages via Zone 2 stub (EdDSA-style).
 */
export class WasmSignedPackagePhase4Band {
  private readonly store = new Map<string, SignedPackageRecord>();

  constructor(private readonly zone2: Zone2WasmService) {}

  packageHash(payloadUtf8: string): string {
    return createHash("sha256").update(payloadUtf8, "utf8").digest("hex");
  }

  async signEvidencePackage(
    userId: string,
    payloadUtf8: string,
    publicKeyId: string,
  ): Promise<SignedPackageRecord> {
    const packageHash = this.packageHash(payloadUtf8);
    const signed = await this.zone2.signPackageRemote(packageHash, publicKeyId);
    return {
      id: randomUUID(),
      userId,
      packageHash: signed.packageHash,
      signature: signed.signature,
      publicKeyId,
      signedAtMs: Date.now(),
    };
  }

  async verifySignature(record: SignedPackageRecord): Promise<boolean> {
    const v = await this.zone2.verifySignatureRemote(record.packageHash, record.signature, record.publicKeyId);
    return v.valid;
  }

  storeSignedPackage(record: SignedPackageRecord): void {
    this.store.set(record.id, record);
  }

  getStoredPackage(id: string): SignedPackageRecord | null {
    return this.store.get(id) ?? null;
  }

  detectTamper(record: SignedPackageRecord, payloadUtf8: string): boolean {
    return this.packageHash(payloadUtf8) !== record.packageHash;
  }
}
