import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WASM_MERKLE_MAX_DEPTH,
  WASM_MERKLE_MAX_LEAVES,
  WasmMerkleCommitmentPhase6Band,
} from "../coherentSystem/wasmMerkleCommitmentPhase6.js";
import { Zone2WasmServiceStub } from "../coherentSystem/zone2WasmStub.js";
import { delegatingZone2Wasm } from "./helpers/zone2WasmTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql136 = readFileSync(join(__dirname, "../../db/migrations/136_sprint40_wasm_merkle_evidence_tree.sql"), "utf8");
const U1 = "00000000-0000-4000-8000-000000000001";

describe("migration 136_sprint40_wasm_merkle_evidence_tree.sql", () => {
  it("creates wasm_merkle_evidence_tree", () => {
    expect(sql136).toMatch(/CREATE TABLE IF NOT EXISTS public\.wasm_merkle_evidence_tree/i);
  });
  it("columns", () => {
    expect(sql136).toMatch(/evidence_hash/i);
    expect(sql136).toMatch(/merkle_root/i);
    expect(sql136).toMatch(/tree_depth/i);
    expect(sql136).toMatch(/leaf_count/i);
    expect(sql136).toMatch(/committed_at/i);
  });
  it("user scoped RLS", () => {
    expect(sql136).toMatch(/wasm_merkle_evidence_tree_self_select/i);
    expect(sql136).toMatch(/current_app_user_id\(\)/i);
  });
  it("indexes user merkle_root committed_at", () => {
    expect(sql136).toMatch(/idx_wasm_merkle_user/i);
    expect(sql136).toMatch(/idx_wasm_merkle_root/i);
    expect(sql136).toMatch(/idx_wasm_merkle_committed_at/i);
  });
  it("tree_depth max 16", () => {
    expect(sql136).toMatch(/tree_depth <= 16/i);
  });
  it("down drops policies", () => {
    const down = readFileSync(join(__dirname, "../../db/migrations/136_sprint40_wasm_merkle_evidence_tree.down.sql"), "utf8");
    expect(down).toMatch(/DROP POLICY/i);
  });
});

describe("Sprint 40 — constants", () => {
  it("max depth 16", () => expect(WASM_MERKLE_MAX_DEPTH).toBe(16));
  it("max leaves 65536", () => expect(WASM_MERKLE_MAX_LEAVES).toBe(65_536));
});

describe("Sprint 40 — buildEvidenceMerkleTree", () => {
  it("single leaf root equals leaf hash", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const tree = band.buildEvidenceMerkleTree(["a"]);
    expect(tree.root).toBe(tree.leaves[0]);
    expect(tree.depth).toBe(0);
  });
  it("two leaves depth 1", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const tree = band.buildEvidenceMerkleTree(["a", "b"]);
    expect(tree.leaves).toHaveLength(2);
    expect(tree.depth).toBe(1);
  });
  it("rejects empty", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    expect(() => band.buildEvidenceMerkleTree([])).toThrow(/empty/i);
  });
  it("deterministic root", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const items = ["e1", "e2", "e3", "e4"];
    expect(band.computeMerkleRoot(items)).toBe(band.computeMerkleRoot(items));
  });
});

describe("Sprint 40 — 100 leaf tree", () => {
  it("builds and verifies leaf 0", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const items = Array.from({ length: 100 }, (_, i) => `ev-${i}`);
    const tree = band.buildEvidenceMerkleTree(items);
    const path = band.generateProofPath(tree, 0);
    expect(band.verifyLeafInTree(tree.leaves[0]!, path, tree.root, 0)).toBe(true);
    expect(path.length).toBe(Math.ceil(Math.log2(100)));
  });
});

describe("Sprint 40 — 10000 leaf stress", () => {
  it("builds under max depth", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const items = Array.from({ length: 10_000 }, (_, i) => `bulk-${i}`);
    const tree = band.buildEvidenceMerkleTree(items);
    expect(tree.leaves).toHaveLength(10_000);
    expect(tree.depth).toBeLessThanOrEqual(WASM_MERKLE_MAX_DEPTH);
    const mid = 5000;
    const path = band.generateProofPath(tree, mid);
    expect(band.verifyLeafInTree(tree.leaves[mid]!, path, tree.root, mid)).toBe(true);
  });
});

describe("Sprint 40 — proof path length", () => {
  it("equals tree depth for power-of-two leaves", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const tree = band.buildEvidenceMerkleTree(["a", "b", "c", "d"]);
    const path = band.generateProofPath(tree, 2);
    expect(path.length).toBe(tree.depth);
  });
});

describe("Sprint 40 — verifyLeafInTree", () => {
  it("rejects tampered leaf", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const tree = band.buildEvidenceMerkleTree(["x", "y"]);
    const path = band.generateProofPath(tree, 0);
    expect(band.verifyLeafInTree("0".repeat(64), path, tree.root, 0)).toBe(false);
  });
  it("invalid leaf index throws", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const tree = band.buildEvidenceMerkleTree(["a"]);
    expect(() => band.generateProofPath(tree, 5)).toThrow(/invalid leaf/i);
  });
});

describe("Sprint 40 — hashEvidence", () => {
  it("sha256 hex length 64", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    expect(band.hashEvidence("doc")).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("Sprint 40 — commitTree", () => {
  it("calls zone2 commitMerkleRoot", async () => {
    const spy = vi.fn(async (r: string, d: number) => new Zone2WasmServiceStub().commitMerkleRoot(r, d));
    const band = new WasmMerkleCommitmentPhase6Band(delegatingZone2Wasm({ commitMerkleRoot: spy }));
    await band.commitTree(U1, ["a", "b"]);
    expect(spy).toHaveBeenCalled();
  });
  it("returns commitment record", async () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const rec = await band.commitTree(U1, ["ev"]);
    expect(rec.leafCount).toBe(1);
    expect(rec.merkleRoot).toHaveLength(64);
    expect(rec.userId).toBe(U1);
  });
});

describe("Sprint 40 — index export", () => {
  it("exports wasmMerkleCommitmentPhase6Band", async () => {
    const idx = await import("../coherentSystem/index.js");
    expect(idx.wasmMerkleCommitmentPhase6Band).toBeDefined();
  });
});

describe("Sprint 40 — odd leaf count", () => {
  it("verifies last leaf", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const tree = band.buildEvidenceMerkleTree(["a", "b", "c"]);
    const idx = 2;
    const path = band.generateProofPath(tree, idx);
    expect(band.verifyLeafInTree(tree.leaves[idx]!, path, tree.root, idx)).toBe(true);
  });
});

describe("Sprint 40 — exceeds max leaves", () => {
  it("throws", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const huge = Array.from({ length: WASM_MERKLE_MAX_LEAVES + 1 }, (_, i) => `${i}`);
    expect(() => band.buildEvidenceMerkleTree(huge)).toThrow(/exceeds/i);
  });
});

describe("Sprint 40 — evidenceSetHash", () => {
  it("stable", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    expect(band.evidenceSetHash(["a", "b"])).toBe(band.evidenceSetHash(["a", "b"]));
  });
});

describe("Sprint 40 — zone2 commitMerkleRoot stub", () => {
  it("committed when root valid", async () => {
    const z = new Zone2WasmServiceStub();
    const tree = new WasmMerkleCommitmentPhase6Band(z).buildEvidenceMerkleTree(["x"]);
    const r = await z.commitMerkleRoot(tree.root, tree.depth);
    expect(r.committed).toBe(true);
    expect(r.commitmentId).toMatch(/^merkle-commit:/);
  });
});

describe("Sprint 40 — leaf order matters", () => {
  it("different roots", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const r1 = band.computeMerkleRoot(["a", "b"]);
    const r2 = band.computeMerkleRoot(["b", "a"]);
    expect(r1).not.toBe(r2);
  });
});

describe("Sprint 40 — committed_at default", () => {
  it("sql default", () => expect(sql136).toMatch(/committed_at.*DEFAULT now\(\)/is));
});

describe("Sprint 40 — user_id FK", () => {
  it("references users", () => expect(sql136).toMatch(/REFERENCES public\.users/i));
});

describe("Sprint 40 — proof path siblings differ", () => {
  it("non-empty path for multi leaf", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const tree = band.buildEvidenceMerkleTree(["a", "b", "c", "d", "e"]);
    const path = band.generateProofPath(tree, 1);
    expect(path.length).toBeGreaterThan(0);
    path.forEach((h) => expect(h).toMatch(/^[a-f0-9]{64}$/));
  });
});

describe("Sprint 40 — eight leaves depth 3", () => {
  it("depth", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const items = ["1", "2", "3", "4", "5", "6", "7", "8"];
    expect(band.buildEvidenceMerkleTree(items).depth).toBe(3);
  });
});

describe("Sprint 40 — verify all leaves small tree", () => {
  it.each([0, 1, 2, 3])("leaf %i", (leafIndex) => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const tree = band.buildEvidenceMerkleTree(["a", "b", "c", "d"]);
    const path = band.generateProofPath(tree, leafIndex);
    expect(band.verifyLeafInTree(tree.leaves[leafIndex]!, path, tree.root, leafIndex)).toBe(true);
  });
});

describe("Sprint 40 — leaf_count column", () => {
  it("sql", () => expect(sql136).toMatch(/leaf_count\s+INT NOT NULL/i));
});

describe("Sprint 40 — evidence_hash column", () => {
  it("sql", () => expect(sql136).toMatch(/evidence_hash\s+TEXT NOT NULL/i));
});

describe("Sprint 40 — merkle_root column", () => {
  it("sql", () => expect(sql136).toMatch(/merkle_root\s+TEXT NOT NULL/i));
});

describe("Sprint 40 — admin delete policy", () => {
  it("sql", () => expect(sql136).toMatch(/wasm_merkle_evidence_tree_admin_delete/i));
});

describe("Sprint 40 — levels array", () => {
  it("has root level", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const tree = band.buildEvidenceMerkleTree(["a", "b"]);
    expect(tree.levels.at(-1)?.[0]).toBe(tree.root);
  });
});

describe("Sprint 40 — commit record leafCount", () => {
  it("matches items", async () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const rec = await band.commitTree(U1, ["a", "b", "c"]);
    expect(rec.leafCount).toBe(3);
  });
});

describe("Sprint 40 — wrong proof path length", () => {
  it("fails verify", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const tree = band.buildEvidenceMerkleTree(["a", "b", "c", "d"]);
    expect(band.verifyLeafInTree(tree.leaves[0]!, [], tree.root, 0)).toBe(false);
  });
});

describe("Sprint 40 — 16 leaf tree depth 4", () => {
  it("depth", () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const items = Array.from({ length: 16 }, (_, i) => `${i}`);
    expect(band.buildEvidenceMerkleTree(items).depth).toBe(4);
  });
});

describe("Sprint 40 — commitmentId from stub", () => {
  it("format", async () => {
    const z = new Zone2WasmServiceStub();
    const tree = new WasmMerkleCommitmentPhase6Band(z).buildEvidenceMerkleTree(["z"]);
    const c = await z.commitMerkleRoot(tree.root, tree.depth);
    expect(c.commitmentId).toMatch(/^merkle-commit:/);
  });
});

describe("Sprint 40 — tree_depth on record", () => {
  it("matches tree", async () => {
    const band = new WasmMerkleCommitmentPhase6Band(new Zone2WasmServiceStub());
    const rec = await band.commitTree(U1, ["a", "b", "c", "d"]);
    expect(rec.treeDepth).toBe(2);
  });
});
