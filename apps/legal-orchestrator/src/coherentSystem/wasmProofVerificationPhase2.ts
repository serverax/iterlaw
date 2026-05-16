import { createHash } from "node:crypto";
import type { Zone2WasmService } from "./zone2WasmTypes.js";

export const WASM_PROOF_MAX_GAS = 1_000_000;

export function computeProofHash(proof: string, evidence: string): string {
  return createHash("sha256").update(`${proof}\0${evidence}`, "utf8").digest("hex");
}

/**
 * Sprint 36 — Deterministic proof verification + gas bounds.
 */
export class WasmProofVerificationPhase2Band {
  constructor(private readonly zone2: Zone2WasmService) {}

  async verifyProofDeterministic(
    proof: string,
    evidence: string,
  ): Promise<{ readonly verified: boolean; readonly resultHash: string; readonly executionHash: string }> {
    const executionHash = computeProofHash(proof, evidence);
    const remote = await this.zone2.verifyProofRemote(proof, evidence);
    const resultHash = remote.resultHash;
    const verified = remote.verified && resultHash === executionHash;
    return { verified, resultHash, executionHash };
  }

  checkGasUsage(gasUsed: number): { readonly withinBounds: boolean; readonly gasUsed: number } {
    const g = Number.isFinite(gasUsed) ? Math.max(0, Math.floor(gasUsed)) : 0;
    return { withinBounds: g <= WASM_PROOF_MAX_GAS, gasUsed: g };
  }
}
