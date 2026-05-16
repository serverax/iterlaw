import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WASM_SANDBOX_MEMORY_LIMIT_KB,
  WasmSandboxPhase1Band,
} from "../coherentSystem/wasmSandboxPhase1.js";
import { Zone2WasmServiceStub } from "../coherentSystem/zone2WasmStub.js";
import { delegatingZone2Wasm } from "./helpers/zone2WasmTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql131 = readFileSync(join(__dirname, "../../db/migrations/131_sprint35_wasm_sandbox_phase1.sql"), "utf8");
const WASM_MAGIC = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

describe("migration 131_sprint35_wasm_sandbox_phase1.sql", () => {
  it("creates wasm_module_registry", () => {
    expect(sql131).toMatch(/CREATE TABLE IF NOT EXISTS public\.wasm_module_registry/i);
  });
  it("columns module_hash bytecode_size memory_limit_kb wasm_version", () => {
    expect(sql131).toMatch(/module_hash/i);
    expect(sql131).toMatch(/bytecode_size/i);
    expect(sql131).toMatch(/memory_limit_kb/i);
    expect(sql131).toMatch(/wasm_version/i);
  });
  it("indexes module_hash and wasm_version", () => {
    expect(sql131).toMatch(/idx_wasm_module_registry_hash/i);
    expect(sql131).toMatch(/idx_wasm_module_registry_version/i);
  });
  it("admin RLS policy", () => {
    expect(sql131).toMatch(/wasm_module_registry_sprint35_admin_all/i);
    expect(sql131).toMatch(/current_app_user_is_admin\(\)/i);
  });
  it("memory_limit_kb positive CHECK", () => {
    expect(sql131).toMatch(/CHECK \(memory_limit_kb > 0\)/i);
  });
  it("down drops policy", () => {
    const down = readFileSync(join(__dirname, "../../db/migrations/131_sprint35_wasm_sandbox_phase1.down.sql"), "utf8");
    expect(down).toMatch(/DROP POLICY IF EXISTS wasm_module_registry_sprint35_admin_all/i);
  });
});

describe("Sprint 35 — WASM_SANDBOX_MEMORY_LIMIT_KB", () => {
  it("is 64", () => {
    expect(WASM_SANDBOX_MEMORY_LIMIT_KB).toBe(64);
  });
});

describe("Sprint 35 — initializeSandbox", () => {
  it("returns isolated sandbox", () => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    const s = band.initializeSandbox();
    expect(s.isolated).toBe(true);
    expect(s.memoryLimitKb).toBe(64);
    expect(s.sandboxId).toMatch(/^[0-9a-f-]{36}$/i);
  });
  it("unique ids", () => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    const a = band.initializeSandbox();
    const b = band.initializeSandbox();
    expect(a.sandboxId).not.toBe(b.sandboxId);
  });
});

describe("Sprint 35 — setMemoryLimit", () => {
  it("caps above 64", () => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    const r = band.setMemoryLimit("sb-1", 128);
    expect(r.memoryLimitKb).toBe(64);
  });
  it("floors below 1 to 1", () => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    const r = band.setMemoryLimit("sb-2", 0);
    expect(r.memoryLimitKb).toBe(1);
  });
  it("getMemoryLimitKb", () => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    band.setMemoryLimit("sb-3", 32);
    expect(band.getMemoryLimitKb("sb-3")).toBe(32);
  });
});

describe("Sprint 35 — validateWasmBinary", () => {
  it("accepts wasm magic", async () => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    const r = await band.validateWasmBinary(WASM_MAGIC);
    expect(r.valid).toBe(true);
  });
  it("rejects bad magic", async () => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    const r = await band.validateWasmBinary(new Uint8Array([1, 2, 3, 4]));
    expect(r.valid).toBe(false);
  });
  it("spy zone2 validateWasmSignature", async () => {
    const spy = vi.fn(async (b: Uint8Array) => new Zone2WasmServiceStub().validateWasmSignature(b));
    const band = new WasmSandboxPhase1Band(delegatingZone2Wasm({ validateWasmSignature: spy }));
    await band.validateWasmBinary(WASM_MAGIC);
    expect(spy).toHaveBeenCalled();
  });
});

describe("Sprint 35 — moduleHash", () => {
  it("stable", () => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    const h = band.moduleHash(WASM_MAGIC);
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(band.moduleHash(WASM_MAGIC)).toBe(h);
  });
});

describe("Sprint 35 — wasmSandboxPhase1Band export", () => {
  it("from index", async () => {
    const { wasmSandboxPhase1Band } = await import("../coherentSystem/index.js");
    const s = wasmSandboxPhase1Band.initializeSandbox();
    expect(s.memoryLimitKb).toBe(64);
  });
});

describe("Sprint 35 — Zone2WasmServiceStub validateWasmSignature", () => {
  it("short bytecode", async () => {
    const z = new Zone2WasmServiceStub();
    const r = await z.validateWasmSignature(new Uint8Array([0]));
    expect(r.valid).toBe(false);
  });
});

describe("Sprint 35 — sandbox isolation map", () => {
  it("separate limits", () => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    band.setMemoryLimit("a", 10);
    band.setMemoryLimit("b", 20);
    expect(band.getMemoryLimitKb("a")).toBe(10);
    expect(band.getMemoryLimitKb("b")).toBe(20);
  });
});

describe("Sprint 35 — RLS ENABLE", () => {
  it("enabled", () => {
    expect(sql131).toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });
});

describe("Sprint 35 — bytecode_size CHECK", () => {
  it("non-negative", () => {
    expect(sql131).toMatch(/CHECK \(bytecode_size >= 0\)/i);
  });
});

describe("Sprint 35 — primary key uuid", () => {
  it("id column", () => {
    expect(sql131).toMatch(/id\s+UUID PRIMARY KEY/i);
  });
});

describe("Sprint 35 — initialize default limit", () => {
  it("custom within cap", () => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    const s = band.initializeSandbox(48);
    expect(s.memoryLimitKb).toBe(48);
  });
});

describe("Sprint 35 — validate oversized bytecode", () => {
  it("rejects huge payload", async () => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    const huge = new Uint8Array(WASM_MAGIC.length + WASM_SANDBOX_MEMORY_LIMIT_KB * 1024 * 5);
    huge.set(WASM_MAGIC, 0);
    const r = await band.validateWasmBinary(huge);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/budget/i);
  });
});

describe("Sprint 35 — delegating invalid signature", () => {
  it("override", async () => {
    const z = delegatingZone2Wasm({
      async validateWasmSignature() {
        return { valid: false, reason: "blocked" };
      },
    });
    const band = new WasmSandboxPhase1Band(z);
    const r = await band.validateWasmBinary(WASM_MAGIC);
    expect(r.reason).toBe("blocked");
  });
});

describe("Sprint 35 — FOR ALL policy", () => {
  it("uses FOR ALL", () => {
    expect(sql131).toMatch(/FOR ALL/i);
  });
});

describe("Sprint 35 — created_at default", () => {
  it("now()", () => {
    expect(sql131).toMatch(/created_at.*DEFAULT now\(\)/is);
  });
});

describe("Sprint 35 — unknown sandbox limit null", () => {
  it("missing id", () => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    expect(band.getMemoryLimitKb("missing")).toBeNull();
  });
});

describe("Sprint 35 — COMMENT ON TABLE", () => {
  it("comment", () => {
    expect(sql131).toMatch(/COMMENT ON TABLE/i);
  });
});

describe("Sprint 35 — memory limit grid", () => {
  it.each([1, 32, 64, 100, 200])("request %i kb", (kb) => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    const r = band.setMemoryLimit(`g-${kb}`, kb);
    expect(r.memoryLimitKb).toBe(Math.min(64, Math.max(1, kb)));
  });
});

describe("Sprint 35 — wasm magic bytes", () => {
  it("0x6d736100LE", () => {
    expect(WASM_MAGIC[0]).toBe(0x00);
    expect(WASM_MAGIC[1]).toBe(0x61);
    expect(WASM_MAGIC[2]).toBe(0x73);
    expect(WASM_MAGIC[3]).toBe(0x6d);
  });
});

describe("Sprint 35 — validate empty", () => {
  it("empty array", async () => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    const r = await band.validateWasmBinary(new Uint8Array());
    expect(r.valid).toBe(false);
  });
});

describe("Sprint 35 — moduleHash differs", () => {
  it("different bytecode", () => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    const a = band.moduleHash(new Uint8Array([1, 2, 3, 4]));
    const b = band.moduleHash(new Uint8Array([5, 6, 7, 8]));
    expect(a).not.toBe(b);
  });
});

describe("Sprint 35 — initializeSandbox isolated flag", () => {
  it("always true", () => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    expect(band.initializeSandbox(1).isolated).toBe(true);
  });
});

describe("Sprint 35 — setMemoryLimit returns same id", () => {
  it("passthrough", () => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    expect(band.setMemoryLimit("fixed-id", 12).sandboxId).toBe("fixed-id");
  });
});

describe("Sprint 35 — validateWasmBinary ok reason", () => {
  it("ok string", async () => {
    const band = new WasmSandboxPhase1Band(new Zone2WasmServiceStub());
    const r = await band.validateWasmBinary(WASM_MAGIC);
    expect(r.reason).toBe("ok");
  });
});
