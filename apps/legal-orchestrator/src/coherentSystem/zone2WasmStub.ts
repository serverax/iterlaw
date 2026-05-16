import { createHash } from "node:crypto";
import type {
  Zone2GasBudget,
  Zone2ProofTemplate,
  Zone2ProofVerification,
  Zone2SignedPackage,
  Zone2SignatureVerification,
  Zone2WasmService,
  Zone2WasmSignatureValidation,
} from "./zone2WasmTypes.js";

const WASM_MAGIC = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);

/**
 * Deterministic Zone 2 WASM stub — no network I/O.
 */
export class Zone2WasmServiceStub implements Zone2WasmService {
  async validateWasmSignature(bytecode: Uint8Array): Promise<Zone2WasmSignatureValidation> {
    if (bytecode.length < 4) {
      return { valid: false, reason: "bytecode too short" };
    }
    const ok =
      bytecode[0] === WASM_MAGIC[0] &&
      bytecode[1] === WASM_MAGIC[1] &&
      bytecode[2] === WASM_MAGIC[2] &&
      bytecode[3] === WASM_MAGIC[3];
    return { valid: ok, reason: ok ? "ok" : "bad magic" };
  }

  async verifyProofRemote(proof: string, evidence: string): Promise<Zone2ProofVerification> {
    const digest = createHash("sha256").update(`${proof}\0${evidence}`).digest("hex");
    const verified = proof.trim().length > 0 && evidence.trim().length > 0 && proof !== evidence;
    return { verified, resultHash: digest };
  }

  async generateProofTemplate(evidenceType: string): Promise<Zone2ProofTemplate> {
    const t = evidenceType.trim() || "generic";
    return {
      templateId: `tpl-${t}`,
      skeleton: { evidenceType: t, version: 1, fields: ["claim", "hash"] },
    };
  }

  async signPackageRemote(packageHash: string, keyId: string): Promise<Zone2SignedPackage> {
    const sig = createHash("sha256").update(`${packageHash}|${keyId}|sign`).digest("hex");
    return { packageHash, signature: `ed25519-stub:${sig.slice(0, 32)}` };
  }

  async verifySignatureRemote(
    packageHash: string,
    signature: string,
    keyId: string,
  ): Promise<Zone2SignatureVerification> {
    const expected = await this.signPackageRemote(packageHash, keyId);
    return { valid: signature === expected.signature };
  }

  async computeGasBudget(operationCount: number): Promise<Zone2GasBudget> {
    const n = Number.isFinite(operationCount) ? Math.max(0, operationCount) : 0;
    return { gasUnits: Math.max(1, n * 10) };
  }
}
