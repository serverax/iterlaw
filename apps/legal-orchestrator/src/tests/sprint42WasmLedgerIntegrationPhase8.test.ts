import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WasmLedgerIntegrationPhase8Band } from "../coherentSystem/wasmLedgerIntegrationPhase8.js";
import { Zone2WasmServiceStub } from "../coherentSystem/zone2WasmStub.js";
import { delegatingZone2Wasm } from "./helpers/zone2WasmTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql138 = readFileSync(join(__dirname, "../../db/migrations/138_sprint42_wasm_ledger_sync_log.sql"), "utf8");
const ROOT = "a".repeat(64);
const PROOF = "zkp:ledger-proof";

describe("migration 138", () => {
  it("table", () => expect(sql138).toMatch(/wasm_ledger_sync_log/i));
  it("columns", () => {
    expect(sql138).toMatch(/ledger_id/i);
    expect(sql138).toMatch(/block_hash/i);
    expect(sql138).toMatch(/tx_hash/i);
    expect(sql138).toMatch(/proof_reference/i);
  });
  it("admin RLS", () => expect(sql138).toMatch(/wasm_ledger_sync_log_admin_all/i));
  it("indexes", () => {
    expect(sql138).toMatch(/idx_wasm_ledger_block/i);
    expect(sql138).toMatch(/idx_wasm_ledger_tx/i);
    expect(sql138).toMatch(/idx_wasm_ledger_synced_at/i);
  });
});

describe("Sprint 42 — syncProofToLedger", () => {
  it("returns sync record", async () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    const rec = await band.syncProofToLedger("ledger-1", ROOT, PROOF);
    expect(rec.proofReference).toBe(ROOT);
    expect(rec.txHash).toHaveLength(64);
  });
  it("idempotent same root", async () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    const a = await band.syncProofToLedger("l", ROOT, PROOF);
    const b = await band.syncProofToLedger("l", ROOT, PROOF);
    expect(a.txHash).toBe(b.txHash);
  });
});

describe("Sprint 42 — verifyLedgerCommitment", () => {
  it("true after sync", async () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    const rec = await band.syncProofToLedger("l", ROOT, PROOF);
    expect(await band.verifyLedgerCommitment(rec.blockHash, ROOT)).toBe(true);
  });
  it("false unknown block", async () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    expect(await band.verifyLedgerCommitment("0".repeat(64), ROOT)).toBe(false);
  });
});

describe("Sprint 42 — fetchBlockHash", () => {
  it("deterministic", async () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    const rec = await band.syncProofToLedger("l", ROOT, PROOF);
    expect(await band.fetchBlockHash(rec.txHash)).toBe(rec.blockHash);
  });
});

describe("Sprint 42 — immutability", () => {
  it("flag", () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    expect(band.isImmutable()).toBe(true);
  });
  it("stub block immutable", async () => {
    const z = new Zone2WasmServiceStub();
    const b = await z.fetchLedgerBlock("abc");
    expect(b.immutable).toBe(true);
  });
});

describe("Sprint 42 — proof reference integrity", () => {
  it("merkle root stored", async () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    const rec = await band.syncProofToLedger("l", ROOT, PROOF);
    expect(rec.proofReference).toBe(ROOT);
  });
});

describe("Sprint 42 — submitProofToLedger spy", () => {
  it("called once idempotent", async () => {
    const spy = vi.fn(async (m: string, p: string) => new Zone2WasmServiceStub().submitProofToLedger(m, p));
    const band = new WasmLedgerIntegrationPhase8Band(delegatingZone2Wasm({ submitProofToLedger: spy }));
    await band.syncProofToLedger("l", ROOT, PROOF);
    await band.syncProofToLedger("l", ROOT, PROOF);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("Sprint 42 — fetchLedgerBlock spy", () => {
  it("called on verify", async () => {
    const spy = vi.fn(async (h: string) => new Zone2WasmServiceStub().fetchLedgerBlock(h));
    const band = new WasmLedgerIntegrationPhase8Band(delegatingZone2Wasm({ fetchLedgerBlock: spy }));
    const rec = await band.syncProofToLedger("l", ROOT, PROOF);
    await band.verifyLedgerCommitment(rec.blockHash, ROOT);
    expect(spy).toHaveBeenCalled();
  });
});

describe("Sprint 42 — getChain", () => {
  it("grows", async () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    await band.syncProofToLedger("l", ROOT, PROOF);
    expect(band.getChain().length).toBeGreaterThan(0);
  });
});

describe("Sprint 42 — index export", () => {
  it("band", async () => {
    const idx = await import("../coherentSystem/index.js");
    expect(idx.wasmLedgerIntegrationPhase8Band).toBeDefined();
  });
});

describe("Sprint 42 — synced_at default", () => {
  it("sql", () => expect(sql138).toMatch(/synced_at.*DEFAULT now\(\)/is));
});

describe("Sprint 42 — down migration", () => {
  it("drops policy", () => {
    const down = readFileSync(join(__dirname, "../../db/migrations/138_sprint42_wasm_ledger_sync_log.down.sql"), "utf8");
    expect(down).toMatch(/DROP POLICY/i);
  });
});

describe("Sprint 42 — different roots different tx", () => {
  it("unique tx", async () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    const a = await band.syncProofToLedger("l", ROOT, PROOF);
    const b = await band.syncProofToLedger("l", "b".repeat(64), PROOF);
    expect(a.txHash).not.toBe(b.txHash);
  });
});

describe("Sprint 42 — logLedgerSync", () => {
  it("appends", async () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    const rec = await band.syncProofToLedger("l", ROOT, PROOF);
    const before = band.getChain().length;
    band.logLedgerSync(rec);
    expect(band.getChain().length).toBe(before + 1);
  });
});

describe("Sprint 42 — COMMENT", () => {
  it("present", () => expect(sql138).toMatch(/COMMENT ON TABLE/i));
});

describe("Sprint 42 — ledger_id text", () => {
  it("column", () => expect(sql138).toMatch(/ledger_id\s+TEXT NOT NULL/i));
});

describe("Sprint 42 — cannot modify chain flag", () => {
  it("immutable stays true", async () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    await band.syncProofToLedger("l", ROOT, PROOF);
    expect(band.isImmutable()).toBe(true);
  });
});

describe("Sprint 42 — block hash hex", () => {
  it("64 chars", async () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    const rec = await band.syncProofToLedger("l", ROOT, PROOF);
    expect(rec.blockHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("Sprint 42 — admin policy using", () => {
  it("admin fn", () => expect(sql138).toMatch(/current_app_user_is_admin/i));
});

describe("Sprint 42 — proof reference column", () => {
  it("not null", () => expect(sql138).toMatch(/proof_reference\s+TEXT NOT NULL/i));
});

describe("Sprint 42 — verify wrong root", () => {
  it("false", async () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    const rec = await band.syncProofToLedger("l", ROOT, PROOF);
    expect(await band.verifyLedgerCommitment(rec.blockHash, "c".repeat(64))).toBe(false);
  });
});

describe("Sprint 42 — block_hash index", () => {
  it("sql", () => expect(sql138).toMatch(/idx_wasm_ledger_block/i));
});

describe("Sprint 42 — tx_hash index", () => {
  it("sql", () => expect(sql138).toMatch(/idx_wasm_ledger_tx/i));
});

describe("Sprint 42 — synced_at index", () => {
  it("sql", () => expect(sql138).toMatch(/idx_wasm_ledger_synced_at/i));
});

describe("Sprint 42 — record id uuid", () => {
  it("format", async () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    const rec = await band.syncProofToLedger("l", ROOT, PROOF);
    expect(rec.id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("Sprint 42 — ledgerId preserved", () => {
  it("value", async () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    const rec = await band.syncProofToLedger("my-ledger", ROOT, PROOF);
    expect(rec.ledgerId).toBe("my-ledger");
  });
});

describe("Sprint 42 — syncedAtMs", () => {
  it("recent", async () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    const before = Date.now();
    const rec = await band.syncProofToLedger("l", ROOT, PROOF);
    expect(rec.syncedAtMs).toBeGreaterThanOrEqual(before - 5);
  });
});

describe("Sprint 42 — stub tx hash deterministic", () => {
  it("same inputs", async () => {
    const z = new Zone2WasmServiceStub();
    const a = await z.submitProofToLedger(ROOT, PROOF);
    const b = await z.submitProofToLedger(ROOT, PROOF);
    expect(a.txHash).toBe(b.txHash);
  });
});

describe("Sprint 42 — enable RLS", () => {
  it("sql", () => expect(sql138).toMatch(/ENABLE ROW LEVEL SECURITY/i));
});

describe("Sprint 42 — primary key", () => {
  it("uuid", () => expect(sql138).toMatch(/id\s+UUID PRIMARY KEY/i));
});

describe("Sprint 42 — two syncs two chain entries", () => {
  it("length", async () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    await band.syncProofToLedger("l", ROOT, PROOF);
    await band.syncProofToLedger("l", "b".repeat(64), PROOF);
    expect(band.getChain().length).toBeGreaterThanOrEqual(2);
  });
});

describe("Sprint 42 — fetchBlockHash changes with tx", () => {
  it("different", async () => {
    const band = new WasmLedgerIntegrationPhase8Band(new Zone2WasmServiceStub());
    const a = await band.syncProofToLedger("l", ROOT, PROOF);
    const b = await band.syncProofToLedger("l", "c".repeat(64), PROOF);
    expect(a.blockHash).not.toBe(b.blockHash);
  });
});

describe("Sprint 42 — stub fetch returns immutable", () => {
  it("true", async () => {
    const z = new Zone2WasmServiceStub();
    const sub = await z.submitProofToLedger(ROOT, PROOF);
    const block = await z.fetchLedgerBlock(sub.blockHash);
    expect(block.immutable).toBe(true);
  });
});

describe("Sprint 42 — proof reference not empty", () => {
  it("sql", () => expect(sql138).toMatch(/proof_reference\s+TEXT NOT NULL/i));
});
