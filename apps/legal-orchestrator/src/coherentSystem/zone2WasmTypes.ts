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

export interface Zone2MerkleCommitment {
  readonly committed: boolean;
  readonly commitmentId: string;
}

export interface Zone2ZkProofVerification {
  readonly valid: boolean;
  readonly reason: string;
}

export interface Zone2LedgerSubmission {
  readonly txHash: string;
  readonly blockHash: string;
}

export interface Zone2LedgerBlock {
  readonly blockHash: string;
  readonly transactions: readonly string[];
  readonly immutable: boolean;
}

export interface Zone2ProofAggregation {
  readonly aggregatedRoot: string;
  readonly originalCount: number;
  readonly compressedSize: number;
}

export interface Zone2ProofCompression {
  readonly compressedBytes: number;
  readonly ratio: number;
}

export interface Zone2ChallengeVerdict {
  readonly valid: boolean;
  readonly reason: string;
  readonly escalate: boolean;
}

export interface Zone2WasmService {
  validateWasmSignature(bytecode: Uint8Array): Promise<Zone2WasmSignatureValidation>;
  verifyProofRemote(proof: string, evidence: string): Promise<Zone2ProofVerification>;
  generateProofTemplate(evidenceType: string): Promise<Zone2ProofTemplate>;
  signPackageRemote(packageHash: string, keyId: string): Promise<Zone2SignedPackage>;
  verifySignatureRemote(packageHash: string, signature: string, keyId: string): Promise<Zone2SignatureVerification>;
  computeGasBudget(operationCount: number): Promise<Zone2GasBudget>;
  commitMerkleRoot(root: string, depth: number): Promise<Zone2MerkleCommitment>;
  verifyZkProofRemote(statement: string, proof: string, publicKey: string): Promise<Zone2ZkProofVerification>;
  submitProofToLedger(merkleRoot: string, proof: string): Promise<Zone2LedgerSubmission>;
  fetchLedgerBlock(blockHash: string): Promise<Zone2LedgerBlock>;
  aggregateRemote(proofs: readonly string[]): Promise<Zone2ProofAggregation>;
  optimizeProofSize(proof: string): Promise<Zone2ProofCompression>;
  evaluateChallengeRemote(proofHash: string, challenge: string): Promise<Zone2ChallengeVerdict>;
}
