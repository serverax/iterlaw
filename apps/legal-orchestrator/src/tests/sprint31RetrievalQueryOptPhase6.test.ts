import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RetrievalQueryOptPhase6Band } from "../coherentSystem/retrievalQueryOptPhase6.js";
import { Zone2RetrievalServiceStub } from "../coherentSystem/zone2RetrievalStub.js";
import { delegatingZone2Retrieval } from "./helpers/zone2RetrievalTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql127 = readFileSync(join(__dirname, "../../db/migrations/127_sprint31_retrieval_query_plan_cache.sql"), "utf8");

describe("migration 127_sprint31_retrieval_query_plan_cache.sql", () => {
  it("creates retrieval_query_plan_cache", () => {
    expect(sql127).toMatch(/CREATE TABLE IF NOT EXISTS public\.retrieval_query_plan_cache/i);
  });
  it("columns fingerprint plan est actual", () => {
    expect(sql127).toMatch(/query_fingerprint/i);
    expect(sql127).toMatch(/execution_plan/i);
    expect(sql127).toMatch(/est_rows/i);
    expect(sql127).toMatch(/actual_rows/i);
    expect(sql127).toMatch(/plan_created_at/i);
  });
  it("index on query_fingerprint", () => {
    expect(sql127).toMatch(/idx_retrieval_query_plan_fingerprint/i);
  });
  it("admin RLS", () => {
    expect(sql127).toMatch(/retrieval_query_plan_cache_admin_all/i);
    expect(sql127).toMatch(/current_app_user_is_admin\(\)/i);
  });
  it("CHECK non-negative rows", () => {
    expect(sql127).toMatch(/CHECK \(est_rows >= 0\)/i);
    expect(sql127).toMatch(/CHECK \(actual_rows >= 0\)/i);
  });
  it("down drops", () => {
    const down = readFileSync(join(__dirname, "../../db/migrations/127_sprint31_retrieval_query_plan_cache.down.sql"), "utf8");
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.retrieval_query_plan_cache/i);
  });
});

describe("Sprint 31 — Zone2RetrievalServiceStub optimizeQueryRemote", () => {
  it("fingerprint length 24 hex", async () => {
    const z = new Zone2RetrievalServiceStub();
    const p = await z.optimizeQueryRemote("hello");
    expect(p.fingerprint).toMatch(/^[a-f0-9]{24}$/);
  });
  it("estRows scales with length", async () => {
    const z = new Zone2RetrievalServiceStub();
    const a = await z.optimizeQueryRemote("a");
    const b = await z.optimizeQueryRemote("abcd");
    expect(b.estRows).toBeGreaterThan(a.estRows);
  });
  it("executionPlan has op", async () => {
    const z = new Zone2RetrievalServiceStub();
    const p = await z.optimizeQueryRemote("x");
    expect(p.executionPlan.op).toBe("seq_scan");
  });
});

describe("Sprint 31 — RetrievalQueryOptPhase6Band analyzeQueryPlan", () => {
  it("delegates to zone2", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalQueryOptPhase6Band(z);
    const p = await band.analyzeQueryPlan("select *");
    expect(p.estRows).toBeGreaterThan(0);
  });
  it("spy", async () => {
    const spy = vi.fn(async (q: string) => new Zone2RetrievalServiceStub().optimizeQueryRemote(q));
    const z = delegatingZone2Retrieval({ optimizeQueryRemote: spy });
    const band = new RetrievalQueryOptPhase6Band(z);
    await band.analyzeQueryPlan("q1");
    expect(spy).toHaveBeenCalledWith("q1");
  });
});

describe("Sprint 31 — suggestIndexes", () => {
  it("empty when actual within estimate", () => {
    const band = new RetrievalQueryOptPhase6Band(new Zone2RetrievalServiceStub());
    expect(band.suggestIndexes(1000, 1000)).toHaveLength(0);
  });
  it("suggests when actual exceeds estimate", () => {
    const band = new RetrievalQueryOptPhase6Band(new Zone2RetrievalServiceStub());
    const s = band.suggestIndexes(100, 500);
    expect(s.length).toBeGreaterThan(0);
  });
  it("non-positive est fallback", () => {
    const band = new RetrievalQueryOptPhase6Band(new Zone2RetrievalServiceStub());
    expect(band.suggestIndexes(0, 10)[0]).toContain("unknown");
  });
});

describe("Sprint 31 — comparePlanVsActual", () => {
  it("ratio", () => {
    const band = new RetrievalQueryOptPhase6Band(new Zone2RetrievalServiceStub());
    const c = band.comparePlanVsActual(100, 200);
    expect(c.ratio).toBe(2);
  });
  it("null ratio when est zero", () => {
    const band = new RetrievalQueryOptPhase6Band(new Zone2RetrievalServiceStub());
    const c = band.comparePlanVsActual(0, 5);
    expect(c.ratio).toBeNull();
  });
});

describe("Sprint 31 — cacheOptimalPlan", () => {
  it("miss then hit", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalQueryOptPhase6Band(z);
    const a = await band.cacheOptimalPlan("stable-query-text");
    const b = await band.cacheOptimalPlan("stable-query-text");
    expect(a.cacheHit).toBe(false);
    expect(b.cacheHit).toBe(true);
  });
  it("different query different fp", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalQueryOptPhase6Band(z);
    const a = await band.cacheOptimalPlan("a");
    const b = await band.cacheOptimalPlan("b");
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });
  it("clearPlanCache resets", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalQueryOptPhase6Band(z);
    await band.cacheOptimalPlan("once");
    band.clearPlanCache();
    const again = await band.cacheOptimalPlan("once");
    expect(again.cacheHit).toBe(false);
  });
});

describe("Sprint 31 — retrievalQueryOptPhase6Band export", () => {
  it("index band", async () => {
    const { retrievalQueryOptPhase6Band } = await import("../coherentSystem/index.js");
    const p = await retrievalQueryOptPhase6Band.analyzeQueryPlan("from-index");
    expect(p.fingerprint).toHaveLength(24);
  });
});

describe("Sprint 31 — JSONB execution_plan column", () => {
  it("jsonb type", () => {
    expect(sql127).toMatch(/execution_plan\s+JSONB/i);
  });
});

describe("Sprint 31 — RLS ENABLE", () => {
  it("enabled", () => {
    expect(sql127).toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });
});

describe("Sprint 31 — fingerprint stability", () => {
  it("same query same fp via stub", async () => {
    const z = new Zone2RetrievalServiceStub();
    const a = await z.optimizeQueryRemote("identical");
    const b = await z.optimizeQueryRemote("identical");
    expect(a.fingerprint).toBe(b.fingerprint);
  });
});

describe("Sprint 31 — suggestIndexes threshold boundary", () => {
  it("exactly 1.2x no suggestion", () => {
    const band = new RetrievalQueryOptPhase6Band(new Zone2RetrievalServiceStub());
    expect(band.suggestIndexes(100, 120)).toHaveLength(0);
  });
  it("just above 1.2x", () => {
    const band = new RetrievalQueryOptPhase6Band(new Zone2RetrievalServiceStub());
    expect(band.suggestIndexes(100, 121).length).toBeGreaterThan(0);
  });
});

describe("Sprint 31 — comparePlanVsActual equal", () => {
  it("ratio one", () => {
    const band = new RetrievalQueryOptPhase6Band(new Zone2RetrievalServiceStub());
    expect(band.comparePlanVsActual(50, 50).ratio).toBe(1);
  });
});

describe("Sprint 31 — analyzeQueryPlan empty string", () => {
  it("still returns plan", async () => {
    const band = new RetrievalQueryOptPhase6Band(new Zone2RetrievalServiceStub());
    const p = await band.analyzeQueryPlan("");
    expect(p.estRows).toBeGreaterThanOrEqual(1);
  });
});

describe("Sprint 31 — cache fingerprint length", () => {
  it.each(["q", "longer query text"])("fp len %s", async (q) => {
    const band = new RetrievalQueryOptPhase6Band(new Zone2RetrievalServiceStub());
    const r = await band.cacheOptimalPlan(q);
    expect(r.fingerprint).toHaveLength(24);
  });
});

describe("Sprint 31 — executionPlan table field", () => {
  it("stub table name", async () => {
    const z = new Zone2RetrievalServiceStub();
    const p = await z.optimizeQueryRemote("z");
    expect(p.executionPlan.table).toBe("legal_chunks_stub");
  });
});

describe("Sprint 31 — plan cache map isolation", () => {
  it("two bands separate caches", async () => {
    const z = new Zone2RetrievalServiceStub();
    const a = new RetrievalQueryOptPhase6Band(z);
    const b = new RetrievalQueryOptPhase6Band(z);
    await a.cacheOptimalPlan("shared-text");
    const firstB = await b.cacheOptimalPlan("shared-text");
    expect(firstB.cacheHit).toBe(false);
  });
});

describe("Sprint 31 — suggestIndexes returns readonly", () => {
  it("tuple frozen at type level", () => {
    const band = new RetrievalQueryOptPhase6Band(new Zone2RetrievalServiceStub());
    const s = band.suggestIndexes(10, 100);
    expect(Array.isArray(s)).toBe(true);
  });
});

describe("Sprint 31 — migration comment", () => {
  it("COMMENT ON TABLE", () => {
    expect(sql127).toMatch(/COMMENT ON TABLE/i);
  });
});

describe("Sprint 31 — compare negative actual still ratio", () => {
  it("negative actual allowed at band layer", () => {
    const band = new RetrievalQueryOptPhase6Band(new Zone2RetrievalServiceStub());
    const c = band.comparePlanVsActual(10, -5);
    expect(c.ratio).toBe(-0.5);
  });
});

describe("Sprint 31 — optimize override", () => {
  it("delegating override", async () => {
    const z = delegatingZone2Retrieval({
      async optimizeQueryRemote() {
        return { fingerprint: "a".repeat(24), executionPlan: { x: 1 }, estRows: 42 };
      },
    });
    const band = new RetrievalQueryOptPhase6Band(z);
    const p = await band.analyzeQueryPlan("ignored");
    expect(p.estRows).toBe(42);
  });
});

describe("Sprint 31 — UUID id column", () => {
  it("primary key uuid", () => {
    expect(sql127).toMatch(/id\s+UUID PRIMARY KEY/i);
  });
});

describe("Sprint 31 — cache hit stable across analyze", () => {
  it("analyze after cache still works", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalQueryOptPhase6Band(z);
    await band.cacheOptimalPlan("dual");
    const p = await band.analyzeQueryPlan("dual");
    expect(p.fingerprint).toHaveLength(24);
  });
});

describe("Sprint 31 — suggestIndexes content", () => {
  it("includes lane index name", () => {
    const band = new RetrievalQueryOptPhase6Band(new Zone2RetrievalServiceStub());
    const s = band.suggestIndexes(10, 500);
    expect(s.some((x) => x.includes("lane"))).toBe(true);
  });
});

describe("Sprint 31 — fingerprint query sensitivity", () => {
  it("case sensitive", async () => {
    const z = new Zone2RetrievalServiceStub();
    const a = await z.optimizeQueryRemote("Case");
    const b = await z.optimizeQueryRemote("case");
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });
});

describe("Sprint 31 — estRows formula", () => {
  it("length 10 => 1000", async () => {
    const z = new Zone2RetrievalServiceStub();
    const p = await z.optimizeQueryRemote("0123456789");
    expect(p.estRows).toBe(1000);
  });
});

describe("Sprint 31 — FOR ALL policy", () => {
  it("uses FOR ALL", () => {
    expect(sql127).toMatch(/FOR ALL/i);
  });
});

describe("Sprint 31 — plan_created_at default", () => {
  it("default now", () => {
    expect(sql127).toMatch(/plan_created_at.*DEFAULT now\(\)/is);
  });
});

describe("Sprint 31 — cacheOptimalPlan fingerprint matches analyze", () => {
  it("same fp", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalQueryOptPhase6Band(z);
    const c = await band.cacheOptimalPlan("sync-fp");
    const a = await band.analyzeQueryPlan("sync-fp");
    expect(c.fingerprint).toBe(a.fingerprint);
  });
});

describe("Sprint 31 — comparePlanVsActual zero actual", () => {
  it("ratio zero", () => {
    const band = new RetrievalQueryOptPhase6Band(new Zone2RetrievalServiceStub());
    expect(band.comparePlanVsActual(100, 0).ratio).toBe(0);
  });
});

describe("Sprint 31 — suggestIndexes no false positive", () => {
  it("low actual", () => {
    const band = new RetrievalQueryOptPhase6Band(new Zone2RetrievalServiceStub());
    expect(band.suggestIndexes(1000, 1)).toHaveLength(0);
  });
});

describe("Sprint 31 — analyzeQueryPlan whitespace", () => {
  it("preserves whitespace in hash", async () => {
    const z = new Zone2RetrievalServiceStub();
    const a = await z.optimizeQueryRemote("a ");
    const b = await z.optimizeQueryRemote("a");
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });
});
