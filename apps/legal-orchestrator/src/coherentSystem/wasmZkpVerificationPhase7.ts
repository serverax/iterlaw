import { createHash, randomUUID } from "node:crypto";
import type { Zone2WasmService } from "./zone2WasmTypes.js";

export interface ZkpStatementRecord {
  readonly id: string;
  readonly userId: string;
  readonly statementHash: string;
  readonly proofHash: string;
  readonly proverPublicKey: string;
  readonly verifiedAtMs: number;
}

/**
 * Sprint 41 — Fiat-Shamir style non-interactive ZKP verification (stub).
 */
export class WasmZkpVerificationPhase7Band {
  private readonly log: ZkpStatementRecord[] = [];

  constructor(private readonly zone2: Zone2WasmService) {}

  statementHash(statement: string): string {
    return createHash("sha256").update(statement, "utf8").digest("hex");
  }

  proofHash(statement: string, witnessFingerprint: string): string {
    return createHash("sha256").update(`${statement}|${witnessFingerprint}`, "utf8").digest("hex");
  }

  formatNonInteractiveProof(statementHash: string, witnessFingerprint: string): string {
    const challenge = createHash("sha256").update(`${statementHash}|${witnessFingerprint}`).digest("hex");
    return `zkp:fs:${challenge.slice(0, 32)}`;
  }

  async verifyZkProof(statement: string, proof: string, publicKey: string): Promise<boolean> {
    const remote = await this.zone2.verifyZkProofRemote(statement, proof, publicKey);
    return remote.valid;
  }

  async validateStatementProof(statement: string, proof: string, publicKey: string): Promise<boolean> {
    if (!proof.startsWith("zkp:")) {
      return false;
    }
    return this.verifyZkProof(statement, proof, publicKey);
  }

  checkProverKey(publicKey: string): boolean {
    return publicKey.trim().length >= 8 && !publicKey.includes("revoked");
  }

  async logProofVerification(
    userId: string,
    statement: string,
    proof: string,
    publicKey: string,
  ): Promise<ZkpStatementRecord> {
    const valid = this.checkProverKey(publicKey) && (await this.verifyZkProof(statement, proof, publicKey));
    if (!valid) {
      throw new Error("zkp verification failed");
    }
    const record: ZkpStatementRecord = {
      id: randomUUID(),
      userId,
      statementHash: this.statementHash(statement),
      proofHash: createHash("sha256").update(proof, "utf8").digest("hex"),
      proverPublicKey: publicKey,
      verifiedAtMs: Date.now(),
    };
    this.log.push(record);
    return record;
  }

  getLogForUser(userId: string): readonly ZkpStatementRecord[] {
    return this.log.filter((r) => r.userId === userId);
  }
}
