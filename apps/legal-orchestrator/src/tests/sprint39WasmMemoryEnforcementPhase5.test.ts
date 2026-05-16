import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WASM_SANDBOX_MEMORY_LIMIT_KB } from "../coherentSystem/wasmSandboxPhase1.js";
import { WasmMemoryEnforcementPhase5Band } from "../coherentSystem/wasmMemoryEnforcementPhase5.js";
import { Zone2WasmServiceStub } from "../coherentSystem/zone2WasmStub.js";
import { delegatingZone2Wasm } from "./helpers/zone2WasmTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql135 = readFileSync(join(__dirname, "../../db/migrations/135_sprint39_wasm_memory_audit_log.sql"), "utf8");

describe("migration 135", () => {
  it("creates wasm_memory_audit_log", () => {
    expect(sql135).toMatch(/wasm_memory_audit_log/i);
  });
  it("columns", () => {
    expect(sql135).toMatch(/execution_id/i);
    expect(sql135).toMatch(/memory_allocated_kb/i);
    expect(sql135).toMatch(/memory_peak_kb/i);
    expect(sql135).toMatch(/oom_triggered/i);
    expect(sql135).toMatch(/audited_at/i);
  });
  it("indexes", () => {
    expect(sql135).toMatch(/idx_wasm_memory_audit_execution/i);
    expect(sql135).toMatch(/idx_wasm_memory_audit_oom/i);
  });
  it("admin RLS", () => {
    expect(sql135).toMatch(/wasm_memory_audit_log_admin_all/i);
  });
  it("down", () => {
    const d = readFileSync(join(__dirname, "../../db/migrations/135_sprint39_wasm_memory_audit_log.down.sql"), "utf8");
    expect(d).toMatch(/DROP TABLE/i);
  });
});

describe("Sprint 39 — enforceMemoryLimit", () => {
  it("caps at 64", () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    expect(band.enforceMemoryLimit(200)).toBe(64);
  });
  it("floors negative", () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    expect(band.enforceMemoryLimit(-1)).toBe(0);
  });
});

describe("Sprint 39 — trackMemoryUsage", () => {
  it("gas from zone2", async () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    const s = await band.trackMemoryUsage("exec-1", 32, 5);
    expect(s.gasRemaining).toBe(50);
    expect(s.memoryLimitKb).toBe(64);
  });
  it("spy computeGasBudget", async () => {
    const spy = vi.fn(async (n: number) => new Zone2WasmServiceStub().computeGasBudget(n));
    const band = new WasmMemoryEnforcementPhase5Band(delegatingZone2Wasm({ computeGasBudget: spy }));
    await band.trackMemoryUsage("e", 10, 3);
    expect(spy).toHaveBeenCalledWith(3);
  });
});

describe("Sprint 39 — detectOutOfMemory", () => {
  it("true over limit", () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    expect(band.detectOutOfMemory(65)).toBe(true);
  });
  it("false at limit", () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    expect(band.detectOutOfMemory(64)).toBe(false);
  });
});

describe("Sprint 39 — consumeGas", () => {
  it("halts at zero", async () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    const s = await band.trackMemoryUsage("e", 1, 1);
    const after = band.consumeGas(s, s.gasRemaining);
    expect(after.halted).toBe(true);
    expect(after.gasRemaining).toBe(0);
  });
});

describe("Sprint 39 — auditMemoryAccess", () => {
  it("row shape", async () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    const s = await band.trackMemoryUsage(band.newExecutionId(), 48, 2);
    const row = band.auditMemoryAccess(s);
    expect(row.execution_id).toBe(s.executionId);
    expect(row.oom_triggered).toBe(false);
  });
});

describe("Sprint 39 — export", () => {
  it("index", async () => {
    const { wasmMemoryEnforcementPhase5Band } = await import("../coherentSystem/index.js");
    expect(wasmMemoryEnforcementPhase5Band.enforceMemoryLimit(64)).toBe(64);
  });
});

describe("Sprint 39 — WASM_SANDBOX_MEMORY_LIMIT_KB", () => {
  it("64", () => expect(WASM_SANDBOX_MEMORY_LIMIT_KB).toBe(64));
});

describe("Sprint 39 — newExecutionId", () => {
  it("uuid", () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    expect(band.newExecutionId()).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("Sprint 39 — gas countdown", () => {
  it("decrements", async () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    const s = await band.trackMemoryUsage("e", 8, 10);
    const mid = band.consumeGas(s, 20);
    expect(mid.gasRemaining).toBe(s.gasRemaining - 20);
  });
});

describe("Sprint 39 — oom in audit", () => {
  it("oom true", async () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    const s = await band.trackMemoryUsage("e", 64, 1);
    const high = { ...s, memoryPeakKb: 128 };
    const row = band.auditMemoryAccess(high);
    expect(row.oom_triggered).toBe(true);
  });
});

describe("Sprint 39 — RLS ENABLE", () => {
  it("on", () => expect(sql135).toMatch(/ENABLE ROW LEVEL SECURITY/i));
});

describe("Sprint 39 — CHECK non-negative memory", () => {
  it("allocated", () => expect(sql135).toMatch(/CHECK \(memory_allocated_kb >= 0\)/i));
});

describe("Sprint 39 — execution_id uuid", () => {
  it("uuid column", () => expect(sql135).toMatch(/execution_id\s+UUID NOT NULL/i));
});

describe("Sprint 39 — consumeGas no negative gas", () => {
  it("floor", async () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    const s = await band.trackMemoryUsage("e", 1, 1);
    const after = band.consumeGas(s, -5);
    expect(after.gasRemaining).toBe(s.gasRemaining);
  });
});

describe("Sprint 39 — alloc capped", () => {
  it("over request capped", async () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    const s = await band.trackMemoryUsage("e", 999, 1);
    expect(s.memoryAllocatedKb).toBe(64);
  });
});

describe("Sprint 39 — FOR ALL admin", () => {
  it("policy", () => expect(sql135).toMatch(/FOR ALL/i));
});

describe("Sprint 39 — gas budget override", () => {
  it("custom", async () => {
    const z = delegatingZone2Wasm({
      async computeGasBudget() {
        return { gasUnits: 3 };
      },
    });
    const band = new WasmMemoryEnforcementPhase5Band(z);
    const s = await band.trackMemoryUsage("e", 1, 100);
    expect(s.gasRemaining).toBe(3);
  });
});

describe("Sprint 39 — halted flag in audit", () => {
  it("propagates", async () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    const s = await band.trackMemoryUsage("e", 1, 1);
    const drained = band.consumeGas(s, 999);
    const row = band.auditMemoryAccess(drained);
    expect(row.halted).toBe(true);
  });
});

describe("Sprint 39 — peak equals alloc in track", () => {
  it("initial", async () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    const s = await band.trackMemoryUsage("e", 20, 2);
    expect(s.memoryPeakKb).toBe(20);
  });
});

describe("Sprint 39 — oom index", () => {
  it("oom_triggered in index", () => expect(sql135).toMatch(/idx_wasm_memory_audit_oom[\s\S]*oom_triggered/i));
});

describe("Sprint 39 — audited_at default", () => {
  it("now", () => expect(sql135).toMatch(/audited_at.*DEFAULT now\(\)/is));
});

describe("Sprint 39 — COMMENT", () => {
  it("comment", () => expect(sql135).toMatch(/COMMENT ON TABLE/i));
});

describe("Sprint 39 — partial gas not halted", () => {
  it("still running", async () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    const s = await band.trackMemoryUsage("e", 4, 5);
    const mid = band.consumeGas(s, 1);
    expect(mid.halted).toBe(false);
    expect(mid.gasRemaining).toBeGreaterThan(0);
  });
});

describe("Sprint 39 — memory peak CHECK", () => {
  it("peak non-negative", () => expect(sql135).toMatch(/CHECK \(memory_peak_kb >= 0\)/i));
});

describe("Sprint 39 — boolean oom column", () => {
  it("boolean", () => expect(sql135).toMatch(/oom_triggered\s+BOOLEAN NOT NULL/i));
});

describe("Sprint 39 — enforce zero", () => {
  it("zero kb", () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    expect(band.enforceMemoryLimit(0)).toBe(0);
  });
});

describe("Sprint 39 — gas_remaining in audit", () => {
  it("numeric", async () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    const s = await band.trackMemoryUsage("e", 1, 2);
    const row = band.auditMemoryAccess(s);
    expect(typeof row.gas_remaining).toBe("number");
  });
});

describe("Sprint 39 — execution_id index", () => {
  it("index", () => expect(sql135).toMatch(/idx_wasm_memory_audit_execution/i));
});

describe("Sprint 39 — oom index name", () => {
  it("index", () => expect(sql135).toMatch(/idx_wasm_memory_audit_oom/i));
});

describe("Sprint 39 — memory_allocated_kb column", () => {
  it("integer", () => expect(sql135).toMatch(/memory_allocated_kb\s+INT NOT NULL/i));
});

describe("Sprint 39 — detect OOM at limit", () => {
  it("at ceiling", () => {
    const band = new WasmMemoryEnforcementPhase5Band(new Zone2WasmServiceStub());
    expect(band.detectOutOfMemory(65)).toBe(true);
  });
});

describe("Sprint 39 — computeGasBudget stub", () => {
  it("positive", async () => {
    const z = new Zone2WasmServiceStub();
    const budget = await z.computeGasBudget(100);
    expect(budget.gasUnits).toBeGreaterThan(0);
  });
});
