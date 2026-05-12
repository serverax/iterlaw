import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  WasmRunner,
  WasmRunnerError,
  createDefaultWasmRunner,
  clearAuditRing,
  getAuditTail,
} from "../wasmRunner";
import { deadlineCalculator } from "../rules/deadlineCalculator";
import { redundancyCalculator } from "../rules/redundancyCalculator";
import { ventoBandSelector } from "../rules/ventoBandSelector";
import type { LegalRuleModule } from "../ruleModule.types";

beforeEach(() => clearAuditRing());

describe("deadlineCalculator", () => {
  it("returns a limitation warning when within 14 days of expiry", async () => {
    const runner = createDefaultWasmRunner();
    const trigger = new Date();
    trigger.setUTCDate(trigger.getUTCDate() - 85); // 6 days remain in a 91d window
    const { output, audit } = await runner.run("deadline_calculator", {
      jurisdiction: "uk_ew",
      trigger_date_iso: trigger.toISOString().slice(0, 10),
    });
    expect(output.status).toBe("imminent");
    expect(output.warning).toMatch(/imminent/i);
    expect(output.limitation_window_days).toBe(91);
    expect(audit.external_llm_used).toBe(false);
    expect(audit.module_id).toBe("deadline_calculator");
  });

  it("flags expired when past the window", async () => {
    const runner = createDefaultWasmRunner();
    const out = await runner.run("deadline_calculator", {
      jurisdiction: "uk_ew",
      trigger_date_iso: "2024-01-01",
      now_iso: "2025-01-01",
    });
    expect(out.output.status).toBe("expired");
    expect(out.output.days_remaining).toBeLessThan(0);
  });
});

describe("redundancyCalculator", () => {
  it("rejects input missing required fields", async () => {
    const runner = createDefaultWasmRunner();
    await expect(
      runner.run("redundancy_calculator", {
        date_of_birth_iso: "1980-01-01",
        // employment_start_iso missing
        effective_date_iso: "2024-06-01",
        gross_weekly_pay: 500,
      })
    ).rejects.toThrow(/missing required input 'employment_start_iso'/);
  });

  it("computes weeks and capped weekly pay", async () => {
    const runner = createDefaultWasmRunner();
    const { output } = await runner.run("redundancy_calculator", {
      date_of_birth_iso: "1980-01-01",
      employment_start_iso: "2010-01-01",
      effective_date_iso: "2025-01-01",
      gross_weekly_pay: 1000,
      weekly_pay_cap: 700,
    });
    expect(output.capped_weekly_pay).toBe(700);
    expect(output.years_counted).toBe(15);
    expect(output.weeks_due).toBeGreaterThan(0);
    expect(output.total_payable).toBe(output.weeks_due * 700);
  });
});

describe("ventoBandSelector", () => {
  it("chooses the band whose effective range contains event_date_iso", async () => {
    const runner = createDefaultWasmRunner();
    const a = await runner.run("vento_band_selector", {
      event_date_iso: "2024-10-01",
      severity: "middle",
    });
    expect(a.output.effective_band.effective_from_iso).toBe("2024-04-06");

    const b = await runner.run("vento_band_selector", {
      event_date_iso: "2025-09-01",
      severity: "upper",
    });
    expect(b.output.effective_band.effective_from_iso).toBe("2025-04-06");
    expect(b.output.range_min).toBe(36400);
    expect(b.output.range_max).toBe(60700);
  });

  it("returns null upper bound for exceptional severity", async () => {
    const runner = createDefaultWasmRunner();
    const r = await runner.run("vento_band_selector", {
      event_date_iso: "2025-06-01",
      severity: "exceptional",
    });
    expect(r.output.range_max).toBeNull();
    expect(r.output.range_min).toBe(60700);
  });
});

describe("wasmRunner — safety", () => {
  it("rejects an unknown module id", async () => {
    const runner = createDefaultWasmRunner();
    await expect(runner.run("not_a_real_module", {})).rejects.toThrow(
      /Unknown module id/
    );
  });

  it("rejects a module registered with an unsafe wasmPath", () => {
    const evil: LegalRuleModule = {
      id: "deadline_calculator",
      wasmPath: "../../../etc/passwd",
      validateInput: (i) => i as Record<string, unknown>,
      fallback: () => ({}),
      summarise: () => "evil",
    };
    const runner = new WasmRunner([evil]);
    return expect(
      runner.run("deadline_calculator", { x: 1 })
    ).rejects.toThrow(/Unsafe wasmPath rejected/);
  });

  it("rejects construction with an out-of-allow-list module id", () => {
    expect(
      () =>
        new WasmRunner([
          {
            id: "not_allowed" as never,
            validateInput: (i) => i as Record<string, unknown>,
            fallback: () => ({}),
            summarise: () => "",
          },
        ])
    ).toThrow(WasmRunnerError);
  });

  it("times out safely when the fallback takes too long", async () => {
    const slow: LegalRuleModule = {
      id: "chunk_scorer",
      validateInput: (i) => i as Record<string, unknown>,
      fallback: async () => {
        await new Promise((r) => setTimeout(r, 200));
        return { ok: true };
      },
      summarise: () => "slow",
    };
    const runner = new WasmRunner([slow]);
    const start = Date.now();
    await expect(
      runner.run("chunk_scorer", {}, { timeoutMs: 25 })
    ).rejects.toThrow(/timed out/);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(180);

    const tail = getAuditTail(1);
    expect(tail.length).toBe(1);
    expect(tail[0].timed_out).toBe(true);
    expect(tail[0].external_llm_used).toBe(false);
  });

  it("uses the TypeScript fallback when no .wasm binary is present", async () => {
    const wasmPath = deadlineCalculator.wasmPath;
    if (wasmPath) {
      const abs = path.resolve(__dirname, "..", "rules", wasmPath);
      expect(fs.existsSync(abs)).toBe(false);
    }
    const runner = createDefaultWasmRunner();
    const { audit, output } = await runner.run("deadline_calculator", {
      jurisdiction: "uk_ew",
      trigger_date_iso: "2026-04-01",
      now_iso: "2026-04-10",
    });
    expect(audit.backend).toBe("fallback_ts");
    expect(output.deadline_iso).toBe("2026-07-01");
  });
});

describe("wasmRunner — no external LLM call introduced", () => {
  it("contains no LLM or network imports in the wasm sources", () => {
    const dir = path.resolve(__dirname, "..");
    const files: string[] = [];
    function walk(p: string) {
      for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
        if (entry.name === "__tests__") continue;
        const full = path.join(p, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(full);
      }
    }
    walk(dir);
    expect(files.length).toBeGreaterThan(0);
    const banned = [
      /from\s+["'](node:)?http["']/,
      /from\s+["'](node:)?https["']/,
      /from\s+["']node-fetch["']/,
      /from\s+["']undici["']/,
      /from\s+["']axios["']/,
      /from\s+["']openai["']/,
      /from\s+["']ollama["']/,
      /from\s+["']anthropic["']/,
      /from\s+["']@anthropic-ai\/sdk["']/,
      /from\s+["']ioredis["']/,
      /from\s+["']redis["']/,
      /\bfetch\s*\(/,
    ];
    for (const f of files) {
      const text = fs.readFileSync(f, "utf8");
      for (const re of banned) {
        expect(re.test(text), `${path.basename(f)} matched ${re}`).toBe(false);
      }
    }
  });

  it("audit entries record external_llm_used=false", async () => {
    const runner = createDefaultWasmRunner();
    await runner.run("deadline_calculator", {
      jurisdiction: "uk_ew",
      trigger_date_iso: "2026-04-01",
    });
    const tail = getAuditTail(10);
    expect(tail.length).toBeGreaterThan(0);
    for (const a of tail) expect(a.external_llm_used).toBe(false);
  });
});
