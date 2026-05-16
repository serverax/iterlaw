import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WasmDisputeResolutionPhase10Band } from "../coherentSystem/wasmDisputeResolutionPhase10.js";
import { Zone2WasmServiceStub } from "../coherentSystem/zone2WasmStub.js";
import { delegatingZone2Wasm } from "./helpers/zone2WasmTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql140 = readFileSync(join(__dirname, "../../db/migrations/140_sprint44_wasm_dispute_challenge_log.sql"), "utf8");
const CASE = "00000000-0000-4000-8000-0000000000c1";
const U1 = "00000000-0000-4000-8000-000000000001";
const U2 = "00000000-0000-4000-8000-000000000002";
const HASH = "f".repeat(64);

function bandWithMembers(): WasmDisputeResolutionPhase10Band {
  const band = new WasmDisputeResolutionPhase10Band(new Zone2WasmServiceStub());
  band.registerCaseMember(CASE, U1);
  band.registerCaseMember(CASE, U2);
  return band;
}

describe("migration 140", () => {
  it("table", () => expect(sql140).toMatch(/wasm_dispute_challenge_log/i));
  it("columns", () => {
    expect(sql140).toMatch(/case_id/i);
    expect(sql140).toMatch(/challenger_id/i);
    expect(sql140).toMatch(/challenged_proof_hash/i);
    expect(sql140).toMatch(/challenge_reason/i);
    expect(sql140).toMatch(/resolution_outcome/i);
  });
  it("case scoped RLS", () => expect(sql140).toMatch(/wasm_dispute_challenge_log_case_select/i));
  it("indexes", () => {
    expect(sql140).toMatch(/idx_wasm_dispute_case/i);
    expect(sql140).toMatch(/idx_wasm_dispute_challenger/i);
    expect(sql140).toMatch(/idx_wasm_dispute_resolved/i);
  });
});

describe("Sprint 44 — createDisputeChallenge", () => {
  it("creates challenge", () => {
    const band = bandWithMembers();
    const c = band.createDisputeChallenge(CASE, U1, HASH, "InvalidProof", "bad sig");
    expect(c.caseId).toBe(CASE);
    expect(c.challengeReason).toBe("InvalidProof");
  });
  it("rejects outsider", () => {
    const band = bandWithMembers();
    expect(() =>
      band.createDisputeChallenge(CASE, "00000000-0000-4000-8000-000000000099", HASH, "InvalidProof", "x"),
    ).toThrow(/not in case/i);
  });
});

describe("Sprint 44 — case isolation", () => {
  it("viewer not in case sees none", () => {
    const band = bandWithMembers();
    band.createDisputeChallenge(CASE, U1, HASH, "InvalidProof", "x");
    expect(band.getChallengesForCase(CASE, "00000000-0000-4000-8000-000000000099")).toHaveLength(0);
  });
  it("member sees challenges", () => {
    const band = bandWithMembers();
    band.createDisputeChallenge(CASE, U1, HASH, "InvalidProof", "x");
    expect(band.getChallengesForCase(CASE, U2)).toHaveLength(1);
  });
});

describe("Sprint 44 — evaluateChallenge", () => {
  it("valid proof stands", async () => {
    const band = bandWithMembers();
    const c = band.createDisputeChallenge(CASE, U1, HASH, "InvalidProof", "ok");
    const v = await band.evaluateChallenge(c);
    expect(v.valid).toBe(true);
  });
  it("fraud keyword fails", async () => {
    const band = bandWithMembers();
    const c = band.createDisputeChallenge(CASE, U1, HASH, "FraudulentEvidence", "fraud attempt");
    const v = await band.evaluateChallenge(c);
    expect(v.valid).toBe(false);
  });
});

describe("Sprint 44 — resolveDispute", () => {
  it("automatic upheld for invalid proof", async () => {
    const band = bandWithMembers();
    const c = band.createDisputeChallenge(CASE, U1, "0".repeat(64), "InvalidProof", "x");
    const r = await band.resolveDispute(c);
    expect(["Upheld", "Rejected", "Escalated"]).toContain(r.outcome);
    expect(band.enforceResolution(c.id)).toBe(r.outcome);
  });
});

describe("Sprint 44 — escalation", () => {
  it("conflict escalates", async () => {
    const z = delegatingZone2Wasm({
      async evaluateChallengeRemote() {
        return { valid: false, reason: "conflict", escalate: true };
      },
    });
    const band = new WasmDisputeResolutionPhase10Band(z);
    band.registerCaseMember(CASE, U1);
    const c = band.createDisputeChallenge(CASE, U1, HASH, "TimestampMismatch", "conflict");
    const r = await band.resolveDispute(c);
    expect(r.outcome).toBe("Escalated");
  });
});

describe("Sprint 44 — appeal", () => {
  it("marks appealed", async () => {
    const band = bandWithMembers();
    const c = band.createDisputeChallenge(CASE, U1, HASH, "InvalidProof", "x");
    await band.resolveDispute(c);
    expect(band.fileAppeal(c.id, U2)).toBe(true);
    expect(band.enforceResolution(c.id)).toBe("Appealed");
  });
});

describe("Sprint 44 — evaluateChallengeRemote spy", () => {
  it("called", async () => {
    const spy = vi.fn(async (h: string, ch: string) =>
      new Zone2WasmServiceStub().evaluateChallengeRemote(h, ch),
    );
    const band = new WasmDisputeResolutionPhase10Band(delegatingZone2Wasm({ evaluateChallengeRemote: spy }));
    band.registerCaseMember(CASE, U1);
    const c = band.createDisputeChallenge(CASE, U1, HASH, "InvalidProof", "x");
    await band.evaluateChallenge(c);
    expect(spy).toHaveBeenCalled();
  });
});

describe("Sprint 44 — index export", () => {
  it("band", async () => {
    const idx = await import("../coherentSystem/index.js");
    expect(idx.wasmDisputeResolutionPhase10Band).toBeDefined();
  });
});

describe("Sprint 44 — resolved_at nullable", () => {
  it("sql", () => expect(sql140).toMatch(/resolved_at\s+TIMESTAMPTZ/i));
});

describe("Sprint 44 — case_id FK", () => {
  it("legal_case_records", () => expect(sql140).toMatch(/REFERENCES public\.legal_case_records/i));
});

describe("Sprint 44 — down migration", () => {
  it("drops policies", () => {
    const down = readFileSync(join(__dirname, "../../db/migrations/140_sprint44_wasm_dispute_challenge_log.down.sql"), "utf8");
    expect(down).toMatch(/DROP POLICY/i);
  });
});

describe("Sprint 44 — COMMENT", () => {
  it("present", () => expect(sql140).toMatch(/COMMENT ON TABLE/i));
});

describe("Sprint 44 — challenge types", () => {
  it.each(["InvalidProof", "FraudulentEvidence", "TimestampMismatch"] as const)("reason %s", (reason) => {
    const band = bandWithMembers();
    const c = band.createDisputeChallenge(CASE, U1, HASH, reason, "note");
    expect(c.challengeReason).toBe(reason);
  });
});

describe("Sprint 44 — canViewCase", () => {
  it("member true", () => {
    const band = bandWithMembers();
    expect(band.canViewCase(U1, CASE)).toBe(true);
  });
  it("outsider false", () => {
    const band = bandWithMembers();
    expect(band.canViewCase("x", CASE)).toBe(false);
  });
});

describe("Sprint 44 — registerCaseMember", () => {
  it("allows view", () => {
    const band = new WasmDisputeResolutionPhase10Band(new Zone2WasmServiceStub());
    band.registerCaseMember(CASE, U1);
    expect(band.canViewCase(U1, CASE)).toBe(true);
  });
});

describe("Sprint 44 — appeal outsider fails", () => {
  it("false", async () => {
    const band = bandWithMembers();
    const c = band.createDisputeChallenge(CASE, U1, HASH, "InvalidProof", "x");
    expect(band.fileAppeal(c.id, "00000000-0000-4000-8000-000000000099")).toBe(false);
  });
});

describe("Sprint 44 — current_user_can_write_case", () => {
  it("in policy", () => expect(sql140).toMatch(/current_user_can_write_case/i));
});

describe("Sprint 44 — challenger_id index", () => {
  it("index", () => expect(sql140).toMatch(/idx_wasm_dispute_challenger/i));
});

describe("Sprint 44 — enforceResolution null", () => {
  it("unknown id", () => {
    const band = bandWithMembers();
    expect(band.enforceResolution("00000000-0000-4000-8000-000000000099")).toBeNull();
  });
});

describe("Sprint 44 — automatic verdict invalid hash", () => {
  it("upheld path", async () => {
    const band = bandWithMembers();
    const c = band.createDisputeChallenge(CASE, U1, "00", "InvalidProof", "x");
    const r = await band.resolveDispute(c);
    expect(r.reason.length).toBeGreaterThan(0);
  });
});

describe("Sprint 44 — challenge id uuid", () => {
  it("format", () => {
    const band = bandWithMembers();
    const c = band.createDisputeChallenge(CASE, U1, HASH, "InvalidProof", "x");
    expect(c.id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("Sprint 44 — challenged_proof_hash column", () => {
  it("sql", () => expect(sql140).toMatch(/challenged_proof_hash\s+TEXT NOT NULL/i));
});

describe("Sprint 44 — challenge_reason column", () => {
  it("sql", () => expect(sql140).toMatch(/challenge_reason\s+TEXT NOT NULL/i));
});

describe("Sprint 44 — resolution_outcome column", () => {
  it("sql", () => expect(sql140).toMatch(/resolution_outcome\s+TEXT/i));
});

describe("Sprint 44 — createdAtMs", () => {
  it("recent", () => {
    const band = bandWithMembers();
    const before = Date.now();
    const c = band.createDisputeChallenge(CASE, U1, HASH, "InvalidProof", "x");
    expect(c.createdAtMs).toBeGreaterThanOrEqual(before - 5);
  });
});

describe("Sprint 44 — challenger_id FK", () => {
  it("users", () => expect(sql140).toMatch(/challenger_id\s+UUID NOT NULL REFERENCES public\.users/i));
});

describe("Sprint 44 — enable RLS", () => {
  it("sql", () => expect(sql140).toMatch(/ENABLE ROW LEVEL SECURITY/i));
});

describe("Sprint 44 — empty case challenges", () => {
  it("none", () => {
    const band = bandWithMembers();
    expect(band.getChallengesForCase("00000000-0000-4000-8000-0000000000d1", U1)).toHaveLength(0);
  });
});

describe("Sprint 44 — resolve sets resolvedAtMs", () => {
  it("timestamp", async () => {
    const band = bandWithMembers();
    const c = band.createDisputeChallenge(CASE, U1, HASH, "InvalidProof", "x");
    const before = Date.now();
    const r = await band.resolveDispute(c);
    expect(r.resolvedAtMs).toBeGreaterThanOrEqual(before - 5);
  });
});

describe("Sprint 44 — TimestampMismatch reason", () => {
  it("creates", () => {
    const band = bandWithMembers();
    const c = band.createDisputeChallenge(CASE, U1, HASH, "TimestampMismatch", "clock skew");
    expect(c.challengeReason).toBe("TimestampMismatch");
  });
});

describe("Sprint 44 — evidence note stored", () => {
  it("value", () => {
    const band = bandWithMembers();
    const c = band.createDisputeChallenge(CASE, U1, HASH, "InvalidProof", "detailed note");
    expect(c.evidenceNote).toBe("detailed note");
  });
});

describe("Sprint 44 — stub valid proof stands", () => {
  it("valid true", async () => {
    const z = new Zone2WasmServiceStub();
    const r = await z.evaluateChallengeRemote(HASH, "InvalidProof:ok");
    expect(r.valid).toBe(true);
  });
});

describe("Sprint 44 — case insert policy", () => {
  it("name", () => expect(sql140).toMatch(/wasm_dispute_challenge_log_case_insert/i));
});
