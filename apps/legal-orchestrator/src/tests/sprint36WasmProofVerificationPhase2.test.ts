import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WASM_PROOF_MAX_GAS,
  WasmProofVerificationPhase2Band,
  computeProofHash,
} from "../coherentSystem/wasmProofVerificationPhase2.js";
import { Zone2WasmServiceStub } from "../coherentSystem/zone2WasmStub.js";
import { delegatingZone2Wasm } from "./helpers/zone2WasmTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql132 = readFileSync(join(__dirname, "../../db/migrations/132_sprint36_wasm_proof_execution_log.sql"), "utf8");
const PID = "00000000-0000-4000-8000-000000000001";

describe("migration 132_sprint36_wasm_proof_execution_log.sql", () => {
  it("creates wasm_proof_execution_log", () => {
    expect(sql132).toMatch(/CREATE TABLE IF NOT EXISTS public\.wasm_proof_execution_log/i);
  });
  it("columns proof_id execution_hash result_hash gas_used verified_at", () => {
    expect(sql132).toMatch(/proof_id/i);
    expect(sql132).toMatch(/execution_hash/i);
    expect(sql132).toMatch(/result_hash/i);
    expect(sql132).toMatch(/gas_used/i);
    expect(sql132).toMatch(/verified_at/i);
  });
  it("indexes proof_id and verified_at", () => {
    expect(sql132).toMatch(/idx_wasm_proof_log_proof_id/i);
    expect(sql132).toMatch(/idx_wasm_proof_log_verified_at/i);
  });
  it("admin RLS", () => {
    expect(sql132).toMatch(/wasm_proof_execution_log_admin_all/i);
  });
  it("gas_used CHECK", () => {
    expect(sql132).toMatch(/CHECK \(gas_used >= 0\)/i);
  });
  it("down drops", () => {
    const down = readFileSync(join(__dirname, "../../db/migrations/132_sprint36_wasm_proof_execution_log.down.sql"), "utf8");
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.wasm_proof_execution_log/i);
  });
});

describe("Sprint 36 — computeProofHash", () => {
  it("stable", () => {
    expect(computeProofHash("p", "e")).toBe(computeProofHash("p", "e"));
  });
  it("differs when evidence changes", () => {
    expect(computeProofHash("p", "a")).not.toBe(computeProofHash("p", "b"));
  });
  it("64 hex chars", () => {
    expect(computeProofHash("x", "y")).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("Sprint 36 — verifyProofDeterministic", () => {
  it("passes when proof differs from evidence", async () => {
    const band = new WasmProofVerificationPhase2Band(new Zone2WasmServiceStub());
    const r = await band.verifyProofDeterministic("proof-body", "evidence-body");
    expect(r.verified).toBe(true);
    expect(r.resultHash).toBe(r.executionHash);
  });
  it("rejects match", async () => {
    const band = new WasmProofVerificationPhase2Band(new Zone2WasmServiceStub());
    const r = await band.verifyProofDeterministic("same", "same");
    expect(r.verified).toBe(false);
  });
  it("spy verifyProofRemote", async () => {
    const spy = vi.fn(async (p: string, e: string) => new Zone2WasmServiceStub().verifyProofRemote(p, e));
    const band = new WasmProofVerificationPhase2Band(delegatingZone2Wasm({ verifyProofRemote: spy }));
    await band.verifyProofDeterministic("a", "b");
    expect(spy).toHaveBeenCalledWith("a", "b");
  });
});

describe("Sprint 36 — checkGasUsage", () => {
  it("within max", () => {
    const band = new WasmProofVerificationPhase2Band(new Zone2WasmServiceStub());
    expect(band.checkGasUsage(1000).withinBounds).toBe(true);
  });
  it("over max", () => {
    const band = new WasmProofVerificationPhase2Band(new Zone2WasmServiceStub());
    expect(band.checkGasUsage(WASM_PROOF_MAX_GAS + 1).withinBounds).toBe(false);
  });
  it("NaN becomes zero", () => {
    const band = new WasmProofVerificationPhase2Band(new Zone2WasmServiceStub());
    expect(band.checkGasUsage(Number.NaN).gasUsed).toBe(0);
  });
});

describe("Sprint 36 — WASM_PROOF_MAX_GAS", () => {
  it("1_000_000", () => {
    expect(WASM_PROOF_MAX_GAS).toBe(1_000_000);
  });
});

describe("Sprint 36 — wasmProofVerificationPhase2Band export", () => {
  it("index", async () => {
    const { wasmProofVerificationPhase2Band } = await import("../coherentSystem/index.js");
    const r = await wasmProofVerificationPhase2Band.verifyProofDeterministic("p", "e");
    expect(r.executionHash).toHaveLength(64);
  });
});

describe("Sprint 36 — deterministic repeat", () => {
  it("same output twice", async () => {
    const band = new WasmProofVerificationPhase2Band(new Zone2WasmServiceStub());
    const a = await band.verifyProofDeterministic("p1", "e1");
    const b = await band.verifyProofDeterministic("p1", "e1");
    expect(a).toEqual(b);
  });
});

describe("Sprint 36 — RLS ENABLE", () => {
  it("enabled", () => {
    expect(sql132).toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });
});

describe("Sprint 36 — empty proof rejected", () => {
  it("blank proof", async () => {
    const band = new WasmProofVerificationPhase2Band(new Zone2WasmServiceStub());
    const r = await band.verifyProofDeterministic("  ", "evidence");
    expect(r.verified).toBe(false);
  });
});

describe("Sprint 36 — delegating override", () => {
  it("force unverified", async () => {
    const z = delegatingZone2Wasm({
      async verifyProofRemote() {
        return { verified: false, resultHash: "deadbeef".repeat(8) };
      },
    });
    const band = new WasmProofVerificationPhase2Band(z);
    const r = await band.verifyProofDeterministic("a", "b");
    expect(r.verified).toBe(false);
  });
});

describe("Sprint 36 — gas at boundary", () => {
  it("exact max ok", () => {
    const band = new WasmProofVerificationPhase2Band(new Zone2WasmServiceStub());
    expect(band.checkGasUsage(WASM_PROOF_MAX_GAS).withinBounds).toBe(true);
  });
});

describe("Sprint 36 — proof_id column uuid", () => {
  it("proof_id type", () => {
    expect(sql132).toMatch(/proof_id\s+UUID NOT NULL/i);
  });
});

describe("Sprint 36 — serialize row shape", () => {
  it("hashes for log projection", async () => {
    const band = new WasmProofVerificationPhase2Band(new Zone2WasmServiceStub());
    const r = await band.verifyProofDeterministic("log-p", "log-e");
    const row = {
      proof_id: PID,
      execution_hash: r.executionHash,
      result_hash: r.resultHash,
      gas_used: 100,
    };
    expect(row.proof_id).toBe(PID);
    expect(band.checkGasUsage(row.gas_used).withinBounds).toBe(true);
  });
});

describe("Sprint 36 — FOR ALL policy", () => {
  it("FOR ALL", () => {
    expect(sql132).toMatch(/FOR ALL/i);
  });
});

describe("Sprint 36 — verified_at default", () => {
  it("now()", () => {
    expect(sql132).toMatch(/verified_at.*DEFAULT now\(\)/is);
  });
});

describe("Sprint 36 — hash mismatch rejection", () => {
  it("remote hash mismatch", async () => {
    const z = delegatingZone2Wasm({
      async verifyProofRemote() {
        return { verified: true, resultHash: "0".repeat(64) };
      },
    });
    const band = new WasmProofVerificationPhase2Band(z);
    const r = await band.verifyProofDeterministic("a", "b");
    expect(r.verified).toBe(false);
  });
});

describe("Sprint 36 — negative gas clamped", () => {
  it("negative", () => {
    const band = new WasmProofVerificationPhase2Band(new Zone2WasmServiceStub());
    expect(band.checkGasUsage(-5).gasUsed).toBe(0);
  });
});

describe("Sprint 36 — computeProofHash empty strings", () => {
  it("still hashes", () => {
    expect(computeProofHash("", "")).toHaveLength(64);
  });
});

describe("Sprint 36 — COMMENT ON TABLE", () => {
  it("comment", () => {
    expect(sql132).toMatch(/COMMENT ON TABLE/i);
  });
});

describe("Sprint 36 — verifyProofDeterministic hash length", () => {
  it("executionHash 64", async () => {
    const band = new WasmProofVerificationPhase2Band(new Zone2WasmServiceStub());
    const r = await band.verifyProofDeterministic("h", "e");
    expect(r.executionHash).toHaveLength(64);
  });
});

describe("Sprint 36 — checkGasUsage returns gasUsed", () => {
  it("floor float", () => {
    const band = new WasmProofVerificationPhase2Band(new Zone2WasmServiceStub());
    expect(band.checkGasUsage(12.9).gasUsed).toBe(12);
  });
});

describe("Sprint 36 — primary key", () => {
  it("uuid id", () => {
    expect(sql132).toMatch(/id\s+UUID PRIMARY KEY/i);
  });
});

describe("Sprint 36 — proof rejection whitespace", () => {
  it("empty evidence", async () => {
    const band = new WasmProofVerificationPhase2Band(new Zone2WasmServiceStub());
    const r = await band.verifyProofDeterministic("proof", "   ");
    expect(r.verified).toBe(false);
  });
});

describe("Sprint 36 — gas grid", () => {
  it.each([0, 1, 500_000, WASM_PROOF_MAX_GAS])("gas %i in bounds", (g) => {
    const band = new WasmProofVerificationPhase2Band(new Zone2WasmServiceStub());
    expect(band.checkGasUsage(g).withinBounds).toBe(true);
  });
});

describe("Sprint 36 — computeProofHash proof order", () => {
  it("order sensitive", () => {
    expect(computeProofHash("ab", "c")).not.toBe(computeProofHash("a", "bc"));
  });
});

describe("Sprint 36 — verified requires hash match", () => {
  it("stub aligns hashes on success", async () => {
    const band = new WasmProofVerificationPhase2Band(new Zone2WasmServiceStub());
    const r = await band.verifyProofDeterministic("alpha", "beta");
    expect(r.verified).toBe(true);
    expect(r.resultHash).toBe(r.executionHash);
  });
});

describe("Sprint 36 — admin policy check", () => {
  it("admin function", () => {
    expect(sql132).toMatch(/current_app_user_is_admin\(\)/i);
  });
});

describe("Sprint 36 — execution_hash text", () => {
  it("text column", () => {
    expect(sql132).toMatch(/execution_hash\s+TEXT NOT NULL/i);
  });
});

describe("Sprint 36 — result_hash text", () => {
  it("text column", () => {
    expect(sql132).toMatch(/result_hash\s+TEXT NOT NULL/i);
  });
});
