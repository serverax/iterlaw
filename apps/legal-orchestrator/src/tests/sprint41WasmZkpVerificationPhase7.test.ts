import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WasmZkpVerificationPhase7Band } from "../coherentSystem/wasmZkpVerificationPhase7.js";
import { Zone2WasmServiceStub } from "../coherentSystem/zone2WasmStub.js";
import { delegatingZone2Wasm } from "./helpers/zone2WasmTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql137 = readFileSync(join(__dirname, "../../db/migrations/137_sprint41_wasm_zkp_statement_log.sql"), "utf8");
const U1 = "00000000-0000-4000-8000-000000000001";
const PK = "pk-user-abc-12345";
const STMT = "hasValidEmploymentEvidence";

function proofFor(band: WasmZkpVerificationPhase7Band, statement: string): string {
  return band.formatNonInteractiveProof(band.statementHash(statement), "witness-redacted");
}

describe("migration 137", () => {
  it("table", () => expect(sql137).toMatch(/wasm_zkp_statement_log/i));
  it("columns", () => {
    expect(sql137).toMatch(/statement_hash/i);
    expect(sql137).toMatch(/proof_hash/i);
    expect(sql137).toMatch(/prover_public_key/i);
  });
  it("user RLS", () => expect(sql137).toMatch(/wasm_zkp_statement_log_self_select/i));
  it("indexes", () => {
    expect(sql137).toMatch(/idx_wasm_zkp_user/i);
    expect(sql137).toMatch(/idx_wasm_zkp_statement/i);
    expect(sql137).toMatch(/idx_wasm_zkp_verified_at/i);
  });
});

describe("Sprint 41 — verifyZkProof", () => {
  it("valid proof passes", async () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    const proof = proofFor(band, STMT);
    expect(await band.verifyZkProof(STMT, proof, PK)).toBe(true);
  });
  it("invalid proof rejected", async () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    expect(await band.verifyZkProof(STMT, "bad", PK)).toBe(false);
  });
});

describe("Sprint 41 — checkProverKey", () => {
  it("valid key", () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    expect(band.checkProverKey(PK)).toBe(true);
  });
  it("revoked rejected", () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    expect(band.checkProverKey("revoked-key-xyz")).toBe(false);
  });
});

describe("Sprint 41 — validateStatementProof", () => {
  it("requires zkp prefix", async () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    expect(await band.validateStatementProof(STMT, "nope", PK)).toBe(false);
  });
  it("valid", async () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    expect(await band.validateStatementProof(STMT, proofFor(band, STMT), PK)).toBe(true);
  });
});

describe("Sprint 41 — logProofVerification", () => {
  it("logs record", async () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    const rec = await band.logProofVerification(U1, STMT, proofFor(band, STMT), PK);
    expect(rec.userId).toBe(U1);
    expect(band.getLogForUser(U1)).toHaveLength(1);
  });
  it("throws on bad proof", async () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    await expect(band.logProofVerification(U1, STMT, "not-zkp-proof", PK)).rejects.toThrow();
  });
});

describe("Sprint 41 — statement hash", () => {
  it("64 hex", () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    expect(band.statementHash(STMT)).toMatch(/^[a-f0-9]{64}$/);
  });
  it("stable", () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    expect(band.statementHash(STMT)).toBe(band.statementHash(STMT));
  });
});

describe("Sprint 41 — zero knowledge", () => {
  it("proof does not contain witness", () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    const proof = proofFor(band, STMT);
    expect(proof).not.toContain("witness-redacted");
  });
});

describe("Sprint 41 — remote spy", () => {
  it("verifyZkProofRemote called", async () => {
    const spy = vi.fn(async (s: string, p: string, k: string) =>
      new Zone2WasmServiceStub().verifyZkProofRemote(s, p, k),
    );
    const band = new WasmZkpVerificationPhase7Band(delegatingZone2Wasm({ verifyZkProofRemote: spy }));
    await band.verifyZkProof(STMT, proofFor(band, STMT), PK);
    expect(spy).toHaveBeenCalled();
  });
});

describe("Sprint 41 — non-interactive format", () => {
  it("zkp:fs prefix", () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    expect(proofFor(band, STMT)).toMatch(/^zkp:fs:/);
  });
});

describe("Sprint 41 — verified_at default", () => {
  it("sql", () => expect(sql137).toMatch(/verified_at.*DEFAULT now\(\)/is));
});

describe("Sprint 41 — proof hash", () => {
  it("differs from statement hash", () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    const p = proofFor(band, STMT);
    expect(band.proofHash(STMT, "w")).not.toBe(band.statementHash(STMT));
    expect(p.length).toBeGreaterThan(10);
  });
});

describe("Sprint 41 — index export", () => {
  it("wasmZkpVerificationPhase7Band", async () => {
    const idx = await import("../coherentSystem/index.js");
    expect(idx.wasmZkpVerificationPhase7Band).toBeDefined();
  });
});

describe("Sprint 41 — different statements", () => {
  it("different hashes", () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    expect(band.statementHash("a")).not.toBe(band.statementHash("b"));
  });
});

describe("Sprint 41 — empty public key", () => {
  it("fails check", () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    expect(band.checkProverKey("")).toBe(false);
  });
});

describe("Sprint 41 — user scoped insert", () => {
  it("policy", () => expect(sql137).toMatch(/self_insert/i));
});

describe("Sprint 41 — down migration", () => {
  it("drops policies", () => {
    const down = readFileSync(join(__dirname, "../../db/migrations/137_sprint41_wasm_zkp_statement_log.down.sql"), "utf8");
    expect(down).toMatch(/DROP POLICY/i);
  });
});

describe("Sprint 41 — fiat shamir stub reason", () => {
  it("ok reason", async () => {
    const z = new Zone2WasmServiceStub();
    const r = await z.verifyZkProofRemote(STMT, proofFor(new WasmZkpVerificationPhase7Band(z), STMT), PK);
    expect(r.reason).toBe("fiat-shamir-ok");
  });
});

describe("Sprint 41 — log isolation per user", () => {
  it("U1 only", async () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    await band.logProofVerification(U1, STMT, proofFor(band, STMT), PK);
    expect(band.getLogForUser("other-user")).toHaveLength(0);
  });
});

describe("Sprint 41 — COMMENT", () => {
  it("present", () => expect(sql137).toMatch(/COMMENT ON TABLE/i));
});

describe("Sprint 41 — user_id FK", () => {
  it("users", () => expect(sql137).toMatch(/REFERENCES public\.users/i));
});

describe("Sprint 41 — reject empty statement remote", () => {
  it("invalid", async () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    expect(await band.verifyZkProof("", proofFor(band, STMT), PK)).toBe(false);
  });
});

describe("Sprint 41 — proofHash stable", () => {
  it("same witness", () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    expect(band.proofHash(STMT, "w")).toBe(band.proofHash(STMT, "w"));
  });
});

describe("Sprint 41 — statement_hash column", () => {
  it("sql", () => expect(sql137).toMatch(/statement_hash\s+TEXT NOT NULL/i));
});

describe("Sprint 41 — proof_hash column", () => {
  it("sql", () => expect(sql137).toMatch(/proof_hash\s+TEXT NOT NULL/i));
});

describe("Sprint 41 — prover_public_key column", () => {
  it("sql", () => expect(sql137).toMatch(/prover_public_key\s+TEXT NOT NULL/i));
});

describe("Sprint 41 — log record proofHash", () => {
  it("64 hex", async () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    const rec = await band.logProofVerification(U1, STMT, proofFor(band, STMT), PK);
    expect(rec.proofHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("Sprint 41 — log record statementHash", () => {
  it("matches", async () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    const rec = await band.logProofVerification(U1, STMT, proofFor(band, STMT), PK);
    expect(rec.statementHash).toBe(band.statementHash(STMT));
  });
});

describe("Sprint 41 — short public key", () => {
  it("fails check", () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    expect(band.checkProverKey("short")).toBe(false);
  });
});

describe("Sprint 41 — validate rejects empty proof", () => {
  it("false", async () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    expect(await band.validateStatementProof(STMT, "", PK)).toBe(false);
  });
});

describe("Sprint 41 — witness changes proof", () => {
  it("different proof hash", () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    expect(band.proofHash(STMT, "w1")).not.toBe(band.proofHash(STMT, "w2"));
  });
});

describe("Sprint 41 — verifiedAtMs", () => {
  it("recent", async () => {
    const band = new WasmZkpVerificationPhase7Band(new Zone2WasmServiceStub());
    const before = Date.now();
    const rec = await band.logProofVerification(U1, STMT, proofFor(band, STMT), PK);
    expect(rec.verifiedAtMs).toBeGreaterThanOrEqual(before - 5);
  });
});

describe("Sprint 41 — enable RLS", () => {
  it("sql", () => expect(sql137).toMatch(/ENABLE ROW LEVEL SECURITY/i));
});
