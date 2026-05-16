/** Sprint 35+ — Zone 2 WASM contract (stubbed). */

export interface Zone2WasmSignatureValidation {
  readonly valid: boolean;
  readonly reason: string;
}

export interface Zone2ProofVerification {
  readonly verified: boolean;
  readonly resultHash: string;
}

export interface Zone2ProofTemplate {
  readonly templateId: string;
  readonly skeleton: Readonly<Record<string, unknown>>;
}

export interface Zone2SignedPackage {
  readonly packageHash: string;
  readonly signature: string;
}

export interface Zone2SignatureVerification {
  readonly valid: boolean;
}

export interface Zone2GasBudget {
  readonly gasUnits: number;
}

export interface Zone2WasmService {
  validateWasmSignature(bytecode: Uint8Array): Promise<Zone2WasmSignatureValidation>;
  verifyProofRemote(proof: string, evidence: string): Promise<Zone2ProofVerification>;
  generateProofTemplate(evidenceType: string): Promise<Zone2ProofTemplate>;
  signPackageRemote(packageHash: string, keyId: string): Promise<Zone2SignedPackage>;
  verifySignatureRemote(packageHash: string, signature: string, keyId: string): Promise<Zone2SignatureVerification>;
  computeGasBudget(operationCount: number): Promise<Zone2GasBudget>;
}
