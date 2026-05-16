import { createHash, randomUUID } from "node:crypto";
import type { Zone2WasmService } from "./zone2WasmTypes.js";

export interface LedgerSyncRecord {
  readonly id: string;
  readonly ledgerId: string;
  readonly blockHash: string;
  readonly txHash: string;
  readonly proofReference: string;
  readonly syncedAtMs: number;
}

/**
 * Sprint 42 — Immutable ledger sync stub (Merkle root references).
 */
export class WasmLedgerIntegrationPhase8Band {
  private readonly chain: LedgerSyncRecord[] = [];
  private readonly txByRoot = new Map<string, string>();

  constructor(private readonly zone2: Zone2WasmService) {}

  async syncProofToLedger(ledgerId: string, merkleRoot: string, proof: string): Promise<LedgerSyncRecord> {
    const existing = this.txByRoot.get(merkleRoot);
    const submission = existing
      ? { txHash: existing, blockHash: createHash("sha256").update(`block|${existing}`).digest("hex") }
      : await this.zone2.submitProofToLedger(merkleRoot, proof);
    if (!existing) {
      this.txByRoot.set(merkleRoot, submission.txHash);
    }
    const record: LedgerSyncRecord = {
      id: randomUUID(),
      ledgerId,
      blockHash: submission.blockHash,
      txHash: submission.txHash,
      proofReference: merkleRoot,
      syncedAtMs: Date.now(),
    };
    this.chain.push(record);
    return record;
  }

  async verifyLedgerCommitment(blockHash: string, merkleRoot: string): Promise<boolean> {
    const rec = this.chain.find((c) => c.blockHash === blockHash && c.proofReference === merkleRoot);
    if (!rec) {
      return false;
    }
    const block = await this.zone2.fetchLedgerBlock(blockHash);
    return block.immutable;
  }

  async fetchBlockHash(txHash: string): Promise<string> {
    return createHash("sha256").update(`block|${txHash}`).digest("hex");
  }

  logLedgerSync(record: LedgerSyncRecord): void {
    this.chain.push(record);
  }

  getChain(): readonly LedgerSyncRecord[] {
    return [...this.chain];
  }

  isImmutable(): boolean {
    return true;
  }
}
