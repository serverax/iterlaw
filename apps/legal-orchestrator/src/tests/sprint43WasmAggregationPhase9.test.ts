import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WasmAggregationPhase9Band } from "../coherentSystem/wasmAggregationPhase9.js";
import { Zone2WasmServiceStub } from "../coherentSystem/zone2WasmStub.js";
import { delegatingZone2Wasm } from "./helpers/zone2WasmTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql139 = readFileSync(join(__dirname, "../../db/migrations/139_sprint43_wasm_aggregated_proof_pack.sql"), "utf8");
const U1 = "00000000-0000-4000-8000-000000000001";

function proofs(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `proof-${i}-${"x".repeat(8)}`);
}

describe("migration 139", () => {
  it("table", () => expect(sql139).toMatch(/wasm_aggregated_proof_pack/i));
  it("columns", () => {
    expect(sql139).toMatch(/original_proofs_count/i);
    expect(sql139).toMatch(/aggregated_root/i);
    expect(sql139).toMatch(/size_reduction_percent/i);
  });
  it("user RLS", () => expect(sql139).toMatch(/wasm_aggregated_proof_pack_self_select/i));
  it("indexes", () => {
    expect(sql139).toMatch(/idx_wasm_agg_user/i);
    expect(sql139).toMatch(/idx_wasm_agg_at/i);
  });
});

describe("Sprint 43 — aggregateProofs", () => {
  it("aggregates 100 proofs", async () => {
    const band = new WasmAggregationPhase9Band(new Zone2WasmServiceStub());
    const pack = await band.aggregateProofs(U1, proofs(100));
    expect(pack.originalProofs).toHaveLength(100);
    expect(pack.aggregatedRoot).toHaveLength(64);
  });
  it("rejects empty", async () => {
    const band = new WasmAggregationPhase9Band(new Zone2WasmServiceStub());
    await expect(band.aggregateProofs(U1, [])).rejects.toThrow(/no proofs/i);
  });
});

describe("Sprint 43 — size reduction", () => {
  it("between 40 and 60 percent", async () => {
    const band = new WasmAggregationPhase9Band(new Zone2WasmServiceStub());
    const pack = await band.aggregateProofs(U1, proofs(50));
    expect(pack.sizeReductionPercent).toBeGreaterThanOrEqual(40);
    expect(pack.sizeReductionPercent).toBeLessThanOrEqual(60);
  });
});

describe("Sprint 43 — decompressProofs", () => {
  it("lossless", async () => {
    const band = new WasmAggregationPhase9Band(new Zone2WasmServiceStub());
    const input = proofs(10);
    const pack = await band.aggregateProofs(U1, input);
    const out = band.decompressProofs(pack);
    expect(out.every((p, i) => p === input[i])).toBe(true);
  });
});

describe("Sprint 43 — computeAggregatedRoot", () => {
  it("deterministic", () => {
    const band = new WasmAggregationPhase9Band(new Zone2WasmServiceStub());
    const p = proofs(5);
    expect(band.computeAggregatedRoot(p)).toBe(band.computeAggregatedRoot(p));
  });
});

describe("Sprint 43 — optimizeProofSize", () => {
  it("ratio under 1", async () => {
    const band = new WasmAggregationPhase9Band(new Zone2WasmServiceStub());
    const ratio = await band.optimizeProofSize("x".repeat(200));
    expect(ratio).toBeLessThan(1);
  });
});

describe("Sprint 43 — aggregateRemote spy", () => {
  it("called", async () => {
    const spy = vi.fn(async (p: readonly string[]) => new Zone2WasmServiceStub().aggregateRemote(p));
    const band = new WasmAggregationPhase9Band(delegatingZone2Wasm({ aggregateRemote: spy }));
    await band.aggregateProofs(U1, proofs(3));
    expect(spy).toHaveBeenCalled();
  });
});

describe("Sprint 43 — index export", () => {
  it("band", async () => {
    const idx = await import("../coherentSystem/index.js");
    expect(idx.wasmAggregationPhase9Band).toBeDefined();
  });
});

describe("Sprint 43 — aggregated_at default", () => {
  it("sql", () => expect(sql139).toMatch(/aggregated_at.*DEFAULT now\(\)/is));
});

describe("Sprint 43 — size_reduction CHECK", () => {
  it("0-100", () => expect(sql139).toMatch(/size_reduction_percent >= 0 AND size_reduction_percent <= 100/i));
});

describe("Sprint 43 — encode decode", () => {
  it("round trip", () => {
    const band = new WasmAggregationPhase9Band(new Zone2WasmServiceStub());
    const p = proofs(4);
    const payload = band.encodePayload(p);
    expect(band.decodePayload(payload)).toEqual(p);
  });
});

describe("Sprint 43 — root matches remote", () => {
  it("stub root", async () => {
    const z = new Zone2WasmServiceStub();
    const band = new WasmAggregationPhase9Band(z);
    const p = proofs(2);
    const remote = await z.aggregateRemote(p);
    const pack = await band.aggregateProofs(U1, p);
    expect(pack.aggregatedRoot).toBe(remote.aggregatedRoot);
  });
});

describe("Sprint 43 — user_id FK", () => {
  it("users", () => expect(sql139).toMatch(/REFERENCES public\.users/i));
});

describe("Sprint 43 — down migration", () => {
  it("drops policies", () => {
    const down = readFileSync(join(__dirname, "../../db/migrations/139_sprint43_wasm_aggregated_proof_pack.down.sql"), "utf8");
    expect(down).toMatch(/DROP POLICY/i);
  });
});

describe("Sprint 43 — COMMENT", () => {
  it("present", () => expect(sql139).toMatch(/COMMENT ON TABLE/i));
});

describe("Sprint 43 — completeness 100 proofs", () => {
  it("all recoverable", async () => {
    const band = new WasmAggregationPhase9Band(new Zone2WasmServiceStub());
    const input = proofs(100);
    const pack = await band.aggregateProofs(U1, input);
    expect(band.decompressProofs(pack)).toHaveLength(100);
  });
});

describe("Sprint 43 — compressed smaller", () => {
  it("payload shorter than raw", async () => {
    const band = new WasmAggregationPhase9Band(new Zone2WasmServiceStub());
    const input = proofs(20);
    const pack = await band.aggregateProofs(U1, input);
    expect(pack.compressedPayload.length).toBeLessThan(band.encodePayload(input).length);
  });
});

describe("Sprint 43 — optimizeProofSize spy", () => {
  it("called", async () => {
    const spy = vi.fn(async (p: string) => new Zone2WasmServiceStub().optimizeProofSize(p));
    const band = new WasmAggregationPhase9Band(delegatingZone2Wasm({ optimizeProofSize: spy }));
    await band.aggregateProofs(U1, proofs(2));
    expect(spy).toHaveBeenCalled();
  });
});

describe("Sprint 43 — original_proofs_count CHECK", () => {
  it("positive", () => expect(sql139).toMatch(/original_proofs_count > 0/i));
});

describe("Sprint 43 — user scoped insert", () => {
  it("policy", () => expect(sql139).toMatch(/self_insert/i));
});

describe("Sprint 43 — different proof sets", () => {
  it("different roots", async () => {
    const band = new WasmAggregationPhase9Band(new Zone2WasmServiceStub());
    const a = await band.aggregateProofs(U1, proofs(3));
    const b = await band.aggregateProofs(U1, proofs(4));
    expect(a.aggregatedRoot).not.toBe(b.aggregatedRoot);
  });
});

describe("Sprint 43 — pack userId", () => {
  it("set", async () => {
    const band = new WasmAggregationPhase9Band(new Zone2WasmServiceStub());
    const pack = await band.aggregateProofs(U1, proofs(1));
    expect(pack.userId).toBe(U1);
  });
});

describe("Sprint 43 — stub compression ratio", () => {
  it("about 0.55", async () => {
    const z = new Zone2WasmServiceStub();
    const r = await z.optimizeProofSize("a".repeat(100));
    expect(r.ratio).toBeCloseTo(0.55, 1);
  });
});

describe("Sprint 43 — aggregated_root column", () => {
  it("sql", () => expect(sql139).toMatch(/aggregated_root\s+TEXT NOT NULL/i));
});

describe("Sprint 43 — original_proofs_count column", () => {
  it("sql", () => expect(sql139).toMatch(/original_proofs_count\s+INT NOT NULL/i));
});

describe("Sprint 43 — pack id uuid", () => {
  it("format", async () => {
    const band = new WasmAggregationPhase9Band(new Zone2WasmServiceStub());
    const pack = await band.aggregateProofs(U1, proofs(2));
    expect(pack.id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("Sprint 43 — aggregatedAtMs", () => {
  it("recent", async () => {
    const band = new WasmAggregationPhase9Band(new Zone2WasmServiceStub());
    const before = Date.now();
    const pack = await band.aggregateProofs(U1, proofs(2));
    expect(pack.aggregatedAtMs).toBeGreaterThanOrEqual(before - 5);
  });
});

describe("Sprint 43 — enable RLS", () => {
  it("sql", () => expect(sql139).toMatch(/ENABLE ROW LEVEL SECURITY/i));
});

describe("Sprint 43 — single proof aggregate", () => {
  it("count 1", async () => {
    const band = new WasmAggregationPhase9Band(new Zone2WasmServiceStub());
    const pack = await band.aggregateProofs(U1, proofs(1));
    expect(pack.originalProofs).toHaveLength(1);
  });
});

describe("Sprint 43 — remote originalCount", () => {
  it("matches", async () => {
    const z = new Zone2WasmServiceStub();
    const p = proofs(7);
    const remote = await z.aggregateRemote(p);
    expect(remote.originalCount).toBe(7);
  });
});

describe("Sprint 43 — compute root matches aggregate", () => {
  it("same", async () => {
    const band = new WasmAggregationPhase9Band(new Zone2WasmServiceStub());
    const p = proofs(3);
    const pack = await band.aggregateProofs(U1, p);
    expect(pack.aggregatedRoot).toBe(band.computeAggregatedRoot(p));
  });
});

describe("Sprint 43 — admin not required policy", () => {
  it("user select", () => expect(sql139).toMatch(/self_select/i));
});

describe("Sprint 43 — lossless order preserved", () => {
  it("order", async () => {
    const band = new WasmAggregationPhase9Band(new Zone2WasmServiceStub());
    const input = ["z", "y", "x"];
    const pack = await band.aggregateProofs(U1, input);
    expect([...band.decompressProofs(pack)]).toEqual(input);
  });
});

describe("Sprint 43 — compressed payload non-empty", () => {
  it("length", async () => {
    const band = new WasmAggregationPhase9Band(new Zone2WasmServiceStub());
    const pack = await band.aggregateProofs(U1, proofs(5));
    expect(pack.compressedPayload.length).toBeGreaterThan(0);
  });
});

describe("Sprint 43 — stub aggregated root hex", () => {
  it("64", async () => {
    const z = new Zone2WasmServiceStub();
    const r = await z.aggregateRemote(proofs(2));
    expect(r.aggregatedRoot).toMatch(/^[a-f0-9]{64}$/);
  });
});
