import { createHash, randomUUID } from "node:crypto";
import type { Zone2WasmService } from "./zone2WasmTypes.js";

/** Max Merkle depth (16 levels → 65,536 leaves). */
export const WASM_MERKLE_MAX_DEPTH = 16;
export const WASM_MERKLE_MAX_LEAVES = 65_536;

export interface MerkleTree {
  readonly leaves: readonly string[];
  readonly root: string;
  readonly depth: number;
  readonly levels: readonly (readonly string[])[];
}

export interface MerkleCommitmentRecord {
  readonly id: string;
  readonly userId: string;
  readonly evidenceHash: string;
  readonly merkleRoot: string;
  readonly treeDepth: number;
  readonly leafCount: number;
  readonly committedAtMs: number;
}

function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hashPair(left: string, right: string): string {
  return sha256Utf8(`${left}${right}`);
}

/**
 * Sprint 40 — Merkle tree evidence commitment (SHA-256).
 */
export class WasmMerkleCommitmentPhase6Band {
  constructor(private readonly zone2: Zone2WasmService) {}

  hashEvidence(evidenceUtf8: string): string {
    return sha256Utf8(evidenceUtf8);
  }

  buildEvidenceMerkleTree(evidenceItems: readonly string[]): MerkleTree {
    if (evidenceItems.length === 0) {
      throw new Error("empty evidence set");
    }
    if (evidenceItems.length > WASM_MERKLE_MAX_LEAVES) {
      throw new Error("leaf count exceeds WASM_MERKLE_MAX_LEAVES");
    }
    const leaves = evidenceItems.map((e) => this.hashEvidence(e));
    const levels: string[][] = [leaves];
    let current = [...leaves];
    while (current.length > 1) {
      if (levels.length >= WASM_MERKLE_MAX_DEPTH) {
        throw new Error("merkle depth exceeds WASM_MERKLE_MAX_DEPTH");
      }
      const next: string[] = [];
      for (let i = 0; i < current.length; i += 2) {
        const left = current[i]!;
        const right = i + 1 < current.length ? current[i + 1]! : left;
        next.push(hashPair(left, right));
      }
      levels.push(next);
      current = next;
    }
    return { leaves, root: current[0]!, depth: levels.length - 1, levels };
  }

  computeMerkleRoot(evidenceItems: readonly string[]): string {
    return this.buildEvidenceMerkleTree(evidenceItems).root;
  }

  generateProofPath(tree: MerkleTree, leafIndex: number): readonly string[] {
    if (leafIndex < 0 || leafIndex >= tree.leaves.length) {
      throw new Error("invalid leaf index");
    }
    const path: string[] = [];
    let idx = leafIndex;
    for (let level = 0; level < tree.levels.length - 1; level++) {
      const nodes = tree.levels[level]!;
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      const sibling = siblingIdx < nodes.length ? nodes[siblingIdx]! : nodes[idx]!;
      path.push(sibling);
      idx = Math.floor(idx / 2);
    }
    return path;
  }

  verifyLeafInTree(
    leafHash: string,
    proofPath: readonly string[],
    merkleRoot: string,
    leafIndex: number,
  ): boolean {
    let idx = leafIndex;
    let computed = leafHash;
    for (const sibling of proofPath) {
      computed = idx % 2 === 0 ? hashPair(computed, sibling) : hashPair(sibling, computed);
      idx = Math.floor(idx / 2);
    }
    return computed === merkleRoot;
  }

  evidenceSetHash(evidenceItems: readonly string[]): string {
    return sha256Utf8(evidenceItems.join("\0"));
  }

  async commitTree(userId: string, evidenceItems: readonly string[]): Promise<MerkleCommitmentRecord> {
    const tree = this.buildEvidenceMerkleTree(evidenceItems);
    await this.zone2.commitMerkleRoot(tree.root, tree.depth);
    return {
      id: randomUUID(),
      userId,
      evidenceHash: this.evidenceSetHash(evidenceItems),
      merkleRoot: tree.root,
      treeDepth: tree.depth,
      leafCount: tree.leaves.length,
      committedAtMs: Date.now(),
    };
  }
}
