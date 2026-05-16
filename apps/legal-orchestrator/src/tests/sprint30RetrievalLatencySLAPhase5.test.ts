import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computePercentilesMs,
  RetrievalLatencySLAPhase5Band,
} from "../coherentSystem/retrievalLatencySLAPhase5.js";
import { Zone2RetrievalServiceStub } from "../coherentSystem/zone2RetrievalStub.js";
import { delegatingZone2Retrieval } from "./helpers/zone2RetrievalTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql126 = readFileSync(join(__dirname, "../../db/migrations/126_sprint30_retrieval_latency_metrics.sql"), "utf8");
const Q1 = "00000000-0000-4000-8000-000000000001";

describe("migration 126_sprint30_retrieval_latency_metrics.sql", () => {
  it("creates retrieval_latency_metrics", () => {
    expect(sql126).toMatch(/CREATE TABLE IF NOT EXISTS public\.retrieval_latency_metrics/i);
  });
  it("columns include p50 p99 p999 sla", () => {
    expect(sql126).toMatch(/p50_ms/i);
    expect(sql126).toMatch(/p99_ms/i);
    expect(sql126).toMatch(/p999_ms/i);
    expect(sql126).toMatch(/sla_target_ms/i);
    expect(sql126).toMatch(/sla_met/i);
    expect(sql126).toMatch(/query_id/i);
  });
  it("indexes measured_at and sla_met", () => {
    expect(sql126).toMatch(/idx_retrieval_latency_measured/i);
    expect(sql126).toMatch(/idx_retrieval_latency_sla_met/i);
  });
  it("admin RLS", () => {
    expect(sql126).toMatch(/retrieval_latency_metrics_admin_all/i);
    expect(sql126).toMatch(/current_app_user_is_admin\(\)/i);
  });
  it("CHECK non-negative latencies", () => {
    expect(sql126).toMatch(/CHECK \(p50_ms >= 0\)/i);
  });
  it("down drops table", () => {
    const down = readFileSync(join(__dirname, "../../db/migrations/126_sprint30_retrieval_latency_metrics.down.sql"), "utf8");
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.retrieval_latency_metrics/i);
  });
});

describe("Sprint 30 — computePercentilesMs", () => {
  it("singleton", () => {
    expect(computePercentilesMs([42])).toEqual({ p50: 42, p99: 42, p999: 42 });
  });
  it("two points p50 midpoint", () => {
    const p = computePercentilesMs([10, 20]);
    expect(p.p50).toBe(15);
  });
  it("sorted ten p99 high", () => {
    const s = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
    const p = computePercentilesMs(s);
    expect(p.p99).toBeGreaterThan(90);
  });
  it("empty yields zeros", () => {
    expect(computePercentilesMs([])).toEqual({ p50: 0, p99: 0, p999: 0 });
  });
  it("uniform grid", () => {
    const s = Array.from({ length: 100 }, (_, i) => i + 1);
    const p = computePercentilesMs(s);
    expect(p.p50).toBeCloseTo(50.5, 5);
  });
  it("p999 between p99 and max", () => {
    const s = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10_000];
    const p = computePercentilesMs(s);
    expect(p.p999).toBeGreaterThanOrEqual(p.p99);
    expect(p.p999).toBeLessThanOrEqual(10_000);
  });
});

describe("Sprint 30 — checkSLACompliance", () => {
  it("pass when p99 below target", () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalLatencySLAPhase5Band(z);
    expect(band.checkSLACompliance(100, 500)).toBe(true);
  });
  it("fail when p99 equals target", () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalLatencySLAPhase5Band(z);
    expect(band.checkSLACompliance(500, 500)).toBe(false);
  });
  it("fail when p99 above target", () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalLatencySLAPhase5Band(z);
    expect(band.checkSLACompliance(600, 500)).toBe(false);
  });
});

describe("Sprint 30 — measureQueryLatency", () => {
  it("slaMet true for fast samples", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalLatencySLAPhase5Band(z);
    const m = await band.measureQueryLatency({
      queryId: Q1,
      requestSize: 10,
      samplesMs: [10, 12, 11, 13, 9],
    });
    expect(m.slaMet).toBe(true);
    expect(m.p99Ms).toBeLessThan(m.slaTargetMs);
  });
  it("uses zone2 budget", async () => {
    const spy = vi.fn(async (n: number) => ({ slaTargetMs: 400 }));
    const z = delegatingZone2Retrieval({ computeLatencyBudget: spy });
    const band = new RetrievalLatencySLAPhase5Band(z);
    await band.measureQueryLatency({ queryId: Q1, requestSize: 99, samplesMs: [1, 2, 3] });
    expect(spy).toHaveBeenCalledWith(99);
  });
  it("slaMet false when samples slow", async () => {
    const z = delegatingZone2Retrieval({
      async computeLatencyBudget() {
        return { slaTargetMs: 100 };
      },
    });
    const band = new RetrievalLatencySLAPhase5Band(z);
    const m = await band.measureQueryLatency({
      queryId: Q1,
      requestSize: 1,
      samplesMs: Array.from({ length: 50 }, () => 200),
    });
    expect(m.slaMet).toBe(false);
  });
});

describe("Sprint 30 — serializeMetricRow", () => {
  it("maps keys", () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalLatencySLAPhase5Band(z);
    const snap = {
      queryId: Q1,
      p50Ms: 1,
      p99Ms: 2,
      p999Ms: 3,
      slaTargetMs: 500,
      slaMet: true,
      measuredAtMs: 1_700_000_000_000,
    };
    const row = band.serializeMetricRow(snap, "00000000-0000-4000-8000-000000000099");
    expect(row.sla_met).toBe(true);
    expect(row.p99_ms).toBe(2);
    expect(row.query_id).toBe(Q1);
  });
});

describe("Sprint 30 — Zone2RetrievalServiceStub computeLatencyBudget", () => {
  it("bounds 250..500", async () => {
    const z = new Zone2RetrievalServiceStub();
    const a = await z.computeLatencyBudget(0);
    const b = await z.computeLatencyBudget(1_000_000);
    expect(a.slaTargetMs).toBe(500);
    expect(b.slaTargetMs).toBe(250);
  });
  it("decreases with size", async () => {
    const z = new Zone2RetrievalServiceStub();
    const lo = await z.computeLatencyBudget(100);
    const hi = await z.computeLatencyBudget(10_000);
    expect(hi.slaTargetMs).toBeLessThanOrEqual(lo.slaTargetMs);
  });
});

describe("Sprint 30 — retrievalLatencySLAPhase5Band export", () => {
  it("default band", async () => {
    const { retrievalLatencySLAPhase5Band } = await import("../coherentSystem/index.js");
    const m = await retrievalLatencySLAPhase5Band.measureQueryLatency({
      queryId: "00000000-0000-4000-8000-000000000002",
      requestSize: 5,
      samplesMs: [30, 31, 32],
    });
    expect(m.queryId).toContain("00000000");
  });
});

describe("Sprint 30 — percentile edge p100 clamp", () => {
  it("single max", () => {
    const p = computePercentilesMs([5, 5, 5, 100]);
    expect(p.p99).toBeLessThanOrEqual(100);
  });
});

describe("Sprint 30 — migration sla_target CHECK", () => {
  it("positive target", () => {
    expect(sql126).toMatch(/CHECK \(sla_target_ms > 0\)/i);
  });
});

describe("Sprint 30 — measureQueryLatency preserves queryId", () => {
  it.each([
    "00000000-0000-4000-8000-000000000010",
    "00000000-0000-4000-8000-000000000011",
  ])("id %s", async (id) => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalLatencySLAPhase5Band(z);
    const m = await band.measureQueryLatency({ queryId: id, requestSize: 0, samplesMs: [1] });
    expect(m.queryId).toBe(id);
  });
});

describe("Sprint 30 — measuredAtMs present", () => {
  it("timestamp", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalLatencySLAPhase5Band(z);
    const before = Date.now();
    const m = await band.measureQueryLatency({ queryId: Q1, requestSize: 0, samplesMs: [1] });
    expect(m.measuredAtMs).toBeGreaterThanOrEqual(before - 1);
  });
});

describe("Sprint 30 — p50 ordering", () => {
  it("out of order input", () => {
    expect(computePercentilesMs([9, 1, 5]).p50).toBe(5);
  });
});

describe("Sprint 30 — serialize ISO date", () => {
  it("measured_at string", () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalLatencySLAPhase5Band(z);
    const row = band.serializeMetricRow(
      {
        queryId: Q1,
        p50Ms: 1,
        p99Ms: 2,
        p999Ms: 3,
        slaTargetMs: 400,
        slaMet: false,
        measuredAtMs: Date.UTC(2026, 0, 1, 0, 0, 0),
      },
      "00000000-0000-4000-8000-0000000000aa",
    );
    expect(String(row.measured_at)).toContain("2026");
  });
});

describe("Sprint 30 — request size grid", () => {
  it.each([0, 50, 200, 4000])("size %i budget finite", async (size) => {
    const z = new Zone2RetrievalServiceStub();
    const b = await z.computeLatencyBudget(size);
    expect(b.slaTargetMs).toBeGreaterThan(0);
  });
});

describe("Sprint 30 — latency samples monotonic percentiles", () => {
  it("p50 lte p99", () => {
    const p = computePercentilesMs([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(p.p50).toBeLessThanOrEqual(p.p99);
  });
});

describe("Sprint 30 — RLS ENABLE", () => {
  it("rls on", () => {
    expect(sql126).toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });
});

describe("Sprint 30 — FOR ALL policy", () => {
  it("policy uses FOR ALL", () => {
    expect(sql126).toMatch(/FOR ALL/i);
  });
});

describe("Sprint 30 — import path smoke", () => {
  it("computePercentilesMs export", () => {
    expect(typeof computePercentilesMs).toBe("function");
  });
});

describe("Sprint 30 — large uniform sample", () => {
  it("p999 picks tail outlier", () => {
    const s = Array.from({ length: 200 }, () => 100);
    s[199] = 800;
    const p = computePercentilesMs(s);
    expect(p.p999).toBeGreaterThan(100);
  });
});

describe("Sprint 30 — checkSLA boundary minus epsilon", () => {
  it("499 vs 500", () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalLatencySLAPhase5Band(z);
    expect(band.checkSLACompliance(499, 500)).toBe(true);
  });
});

describe("Sprint 30 — stub NaN requestSize", () => {
  it("treats as zero floor", async () => {
    const z = new Zone2RetrievalServiceStub();
    const a = await z.computeLatencyBudget(Number.NaN);
    const b = await z.computeLatencyBudget(0);
    expect(a.slaTargetMs).toBe(b.slaTargetMs);
  });
});

describe("Sprint 30 — duplicate sample values", () => {
  it("percentiles stable", () => {
    const p = computePercentilesMs([5, 5, 5, 5, 5]);
    expect(p.p50).toBe(5);
    expect(p.p99).toBe(5);
  });
});

describe("Sprint 30 — migration primary key id", () => {
  it("uuid pk", () => {
    expect(sql126).toMatch(/id\s+UUID PRIMARY KEY/i);
  });
});

describe("Sprint 30 — serialize row id passthrough", () => {
  it("id field", () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalLatencySLAPhase5Band(z);
    const rid = "00000000-0000-4000-8000-0000000000bb";
    const row = band.serializeMetricRow(
      {
        queryId: Q1,
        p50Ms: 1,
        p99Ms: 2,
        p999Ms: 3,
        slaTargetMs: 500,
        slaMet: true,
        measuredAtMs: 0,
      },
      rid,
    );
    expect(row.id).toBe(rid);
  });
});

describe("Sprint 30 — sample size one SLA", () => {
  it("single sample vs budget", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalLatencySLAPhase5Band(z);
    const m = await band.measureQueryLatency({ queryId: Q1, requestSize: 0, samplesMs: [600] });
    expect(m.slaMet).toBe(false);
  });
});

describe("Sprint 30 — p99 grid", () => {
  it("caps at max element small set", () => {
    const p = computePercentilesMs([1, 2, 3, 100]);
    expect(p.p99).toBeLessThanOrEqual(100);
  });
  it("uniform small", () => {
    const p = computePercentilesMs([1, 2, 3, 4, 5]);
    expect(p.p99).toBeLessThanOrEqual(5);
  });
});
