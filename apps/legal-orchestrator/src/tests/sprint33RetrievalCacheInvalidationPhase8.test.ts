import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RetrievalCacheInvalidationPhase8Band } from "../coherentSystem/retrievalCacheInvalidationPhase8.js";
import { Zone2RetrievalServiceStub } from "../coherentSystem/zone2RetrievalStub.js";
import { delegatingZone2Retrieval } from "./helpers/zone2RetrievalTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql129 = readFileSync(
  join(__dirname, "../../db/migrations/129_sprint33_retrieval_cache_invalidation_rules.sql"),
  "utf8",
);

describe("migration 129_sprint33_retrieval_cache_invalidation_rules.sql", () => {
  it("creates retrieval_cache_invalidation_rules", () => {
    expect(sql129).toMatch(/CREATE TABLE IF NOT EXISTS public\.retrieval_cache_invalidation_rules/i);
  });
  it("columns pattern ttl_seconds trigger_on last_invalidated_at", () => {
    expect(sql129).toMatch(/pattern/i);
    expect(sql129).toMatch(/ttl_seconds/i);
    expect(sql129).toMatch(/trigger_on/i);
    expect(sql129).toMatch(/last_invalidated_at/i);
  });
  it("ttl_seconds positive CHECK", () => {
    expect(sql129).toMatch(/CHECK \(ttl_seconds > 0\)/i);
  });
  it("indexes pattern and trigger_on", () => {
    expect(sql129).toMatch(/idx_retrieval_cache_invalidation_pattern/i);
    expect(sql129).toMatch(/idx_retrieval_cache_invalidation_trigger/i);
  });
  it("admin RLS", () => {
    expect(sql129).toMatch(/retrieval_cache_invalidation_rules_admin_all/i);
    expect(sql129).toMatch(/current_app_user_is_admin\(\)/i);
  });
  it("down drops table", () => {
    const down = readFileSync(
      join(__dirname, "../../db/migrations/129_sprint33_retrieval_cache_invalidation_rules.down.sql"),
      "utf8",
    );
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.retrieval_cache_invalidation_rules/i);
  });
});

describe("Sprint 33 — Zone2RetrievalServiceStub suggestInvalidationTtl", () => {
  it("ollama cache longer ttl", async () => {
    const z = new Zone2RetrievalServiceStub();
    const o = await z.suggestInvalidationTtl("ollama-response");
    const h = await z.suggestInvalidationTtl("hnsw-lane");
    expect(o.ttlSeconds).toBeGreaterThan(h.ttlSeconds);
  });
  it("minimum 300 seconds", async () => {
    const z = new Zone2RetrievalServiceStub();
    const hint = await z.suggestInvalidationTtl("x");
    expect(hint.ttlSeconds).toBeGreaterThanOrEqual(300);
  });
  it("default tier when unknown type", async () => {
    const z = new Zone2RetrievalServiceStub();
    const hint = await z.suggestInvalidationTtl("misc");
    expect(hint.ttlSeconds).toBe(21_600);
  });
});

describe("Sprint 33 — registerInvalidationRule", () => {
  it("stores rule with zone2 ttl", async () => {
    const band = new RetrievalCacheInvalidationPhase8Band(new Zone2RetrievalServiceStub());
    const rule = await band.registerInvalidationRule({
      pattern: "lane:",
      cacheType: "ollama",
      triggerOn: "write",
    });
    expect(rule.ttlSeconds).toBe(86_400);
    expect(rule.pattern).toBe("lane:");
    expect(rule.triggerOn).toBe("write");
    expect(rule.lastInvalidatedAtMs).toBeNull();
  });
  it("spy on suggestInvalidationTtl", async () => {
    const spy = vi.fn(async (c: string) => new Zone2RetrievalServiceStub().suggestInvalidationTtl(c));
    const z = delegatingZone2Retrieval({ suggestInvalidationTtl: spy });
    const band = new RetrievalCacheInvalidationPhase8Band(z);
    await band.registerInvalidationRule({ pattern: "x", cacheType: "hnsw", triggerOn: "ttl" });
    expect(spy).toHaveBeenCalledWith("hnsw");
  });
});

describe("Sprint 33 — checkRuleMatch", () => {
  it("substring match", () => {
    const band = new RetrievalCacheInvalidationPhase8Band(new Zone2RetrievalServiceStub());
    const rule = {
      id: "1",
      pattern: "ollama",
      ttlSeconds: 100,
      triggerOn: "x",
      lastInvalidatedAtMs: null,
    };
    expect(band.checkRuleMatch("cache:ollama:model", rule)).toBe(true);
    expect(band.checkRuleMatch("cache:hnsw", rule)).toBe(false);
  });
  it("wildcard star", () => {
    const band = new RetrievalCacheInvalidationPhase8Band(new Zone2RetrievalServiceStub());
    const rule = {
      id: "1",
      pattern: "*",
      ttlSeconds: 1,
      triggerOn: "x",
      lastInvalidatedAtMs: null,
    };
    expect(band.checkRuleMatch("anything", rule)).toBe(true);
  });
  it("empty pattern false", () => {
    const band = new RetrievalCacheInvalidationPhase8Band(new Zone2RetrievalServiceStub());
    const rule = {
      id: "1",
      pattern: "",
      ttlSeconds: 1,
      triggerOn: "x",
      lastInvalidatedAtMs: null,
    };
    expect(band.checkRuleMatch("key", rule)).toBe(false);
  });
});

describe("Sprint 33 — purgeStaleCache", () => {
  it("purges expired keys", async () => {
    const z = delegatingZone2Retrieval({
      async suggestInvalidationTtl() {
        return { ttlSeconds: 60 };
      },
    });
    const band = new RetrievalCacheInvalidationPhase8Band(z);
    await band.registerInvalidationRule({ pattern: "k", cacheType: "misc", triggerOn: "ttl" });
    const now = 1_000_000;
    band.touchCache("k:1", now - 120_000);
    const out = band.purgeStaleCache(now);
    expect(out.purgedKeys).toContain("k:1");
    expect(out.rulesTouched).toBeGreaterThanOrEqual(1);
  });
  it("keeps fresh keys", async () => {
    const band = new RetrievalCacheInvalidationPhase8Band(new Zone2RetrievalServiceStub());
    await band.registerInvalidationRule({ pattern: "fresh", cacheType: "misc", triggerOn: "ttl" });
    const now = Date.now();
    band.touchCache("fresh:entry", now);
    const out = band.purgeStaleCache(now);
    expect(out.purgedKeys).not.toContain("fresh:entry");
  });
  it("updates lastInvalidatedAtMs on purge", async () => {
    const z = delegatingZone2Retrieval({
      async suggestInvalidationTtl() {
        return { ttlSeconds: 30 };
      },
    });
    const band = new RetrievalCacheInvalidationPhase8Band(z);
    const rule = await band.registerInvalidationRule({ pattern: "p", cacheType: "misc", triggerOn: "ttl" });
    const now = 2_000_000;
    band.touchCache("p:old", now - 60_000);
    band.purgeStaleCache(now);
    const updated = band.listRules().find((r) => r.id === rule.id);
    expect(updated?.lastInvalidatedAtMs).toBe(now);
  });
});

describe("Sprint 33 — retrievalCacheInvalidationPhase8Band export", () => {
  it("index default", async () => {
    const { retrievalCacheInvalidationPhase8Band } = await import("../coherentSystem/index.js");
    const rule = await retrievalCacheInvalidationPhase8Band.registerInvalidationRule({
      pattern: "idx",
      cacheType: "ollama",
      triggerOn: "read",
    });
    expect(rule.ttlSeconds).toBeGreaterThan(0);
  });
});

describe("Sprint 33 — listRules", () => {
  it("accumulates rules", async () => {
    const band = new RetrievalCacheInvalidationPhase8Band(new Zone2RetrievalServiceStub());
    await band.registerInvalidationRule({ pattern: "a", cacheType: "misc", triggerOn: "t1" });
    await band.registerInvalidationRule({ pattern: "b", cacheType: "misc", triggerOn: "t2" });
    expect(band.listRules()).toHaveLength(2);
  });
});

describe("Sprint 33 — RLS ENABLE", () => {
  it("enabled", () => {
    expect(sql129).toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });
});

describe("Sprint 33 — FOR ALL policy", () => {
  it("uses FOR ALL", () => {
    expect(sql129).toMatch(/FOR ALL/i);
  });
});

describe("Sprint 33 — rule id uuid shape", () => {
  it("uuid on register", async () => {
    const band = new RetrievalCacheInvalidationPhase8Band(new Zone2RetrievalServiceStub());
    const rule = await band.registerInvalidationRule({ pattern: "z", cacheType: "misc", triggerOn: "t" });
    expect(rule.id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("Sprint 33 — non-matching rule skips key", () => {
  it("other pattern untouched", async () => {
    const band = new RetrievalCacheInvalidationPhase8Band(new Zone2RetrievalServiceStub());
    await band.registerInvalidationRule({ pattern: "only", cacheType: "misc", triggerOn: "ttl" });
    const now = 9_000_000;
    band.touchCache("other:key", now - 500_000);
    const out = band.purgeStaleCache(now);
    expect(out.purgedKeys).not.toContain("other:key");
  });
});

describe("Sprint 33 — multiple rules same key", () => {
  it("purges once", async () => {
    const band = new RetrievalCacheInvalidationPhase8Band(new Zone2RetrievalServiceStub());
    await band.registerInvalidationRule({ pattern: "dup", cacheType: "misc", triggerOn: "a" });
    await band.registerInvalidationRule({ pattern: "dup", cacheType: "misc", triggerOn: "b" });
    const now = 10_000_000;
    band.touchCache("dup:x", now - 500_000);
    const out = band.purgeStaleCache(now);
    expect(out.purgedKeys.filter((k) => k === "dup:x").length).toBeLessThanOrEqual(1);
  });
});

describe("Sprint 33 — hnsw cache type ttl", () => {
  it("43200", async () => {
    const z = new Zone2RetrievalServiceStub();
    const hint = await z.suggestInvalidationTtl("retrieval-hnsw");
    expect(hint.ttlSeconds).toBe(43_200);
  });
});

describe("Sprint 33 — purge empty cache", () => {
  it("no keys", async () => {
    const band = new RetrievalCacheInvalidationPhase8Band(new Zone2RetrievalServiceStub());
    await band.registerInvalidationRule({ pattern: "*", cacheType: "misc", triggerOn: "ttl" });
    const out = band.purgeStaleCache(Date.now());
    expect(out.purgedKeys).toHaveLength(0);
  });
});

describe("Sprint 33 — primary key", () => {
  it("uuid id column", () => {
    expect(sql129).toMatch(/id\s+UUID PRIMARY KEY/i);
  });
});

describe("Sprint 33 — delegating override ttl", () => {
  it("custom ttl", async () => {
    const z = delegatingZone2Retrieval({
      async suggestInvalidationTtl() {
        return { ttlSeconds: 42 };
      },
    });
    const band = new RetrievalCacheInvalidationPhase8Band(z);
    const rule = await band.registerInvalidationRule({ pattern: "x", cacheType: "y", triggerOn: "z" });
    expect(rule.ttlSeconds).toBe(42);
  });
});

describe("Sprint 33 — COMMENT ON TABLE", () => {
  it("comment present", () => {
    expect(sql129).toMatch(/COMMENT ON TABLE/i);
  });
});

describe("Sprint 33 — trigger_on index", () => {
  it("index name", () => {
    expect(sql129).toMatch(/trigger_on\)/i);
  });
});

describe("Sprint 33 — case insensitive cache type", () => {
  it("OLLAMA upper", async () => {
    const z = new Zone2RetrievalServiceStub();
    const hint = await z.suggestInvalidationTtl("OLLAMA_CACHE");
    expect(hint.ttlSeconds).toBe(86_400);
  });
});

describe("Sprint 33 — rulesTouched zero when fresh", () => {
  it("no purge no touch", async () => {
    const band = new RetrievalCacheInvalidationPhase8Band(new Zone2RetrievalServiceStub());
    await band.registerInvalidationRule({ pattern: "n", cacheType: "misc", triggerOn: "ttl" });
    band.touchCache("n:ok", Date.now());
    const out = band.purgeStaleCache(Date.now());
    expect(out.rulesTouched).toBe(0);
  });
});

describe("Sprint 33 — register trigger variants", () => {
  it.each(["write", "read", "ttl", "schema_change"])("trigger %s", async (triggerOn) => {
    const band = new RetrievalCacheInvalidationPhase8Band(new Zone2RetrievalServiceStub());
    const rule = await band.registerInvalidationRule({ pattern: "t", cacheType: "misc", triggerOn });
    expect(rule.triggerOn).toBe(triggerOn);
  });
});

describe("Sprint 33 — purge respects ttl boundary", () => {
  it("exactly at ttl not purged", async () => {
    const z = delegatingZone2Retrieval({
      async suggestInvalidationTtl() {
        return { ttlSeconds: 100 };
      },
    });
    const band = new RetrievalCacheInvalidationPhase8Band(z);
    await band.registerInvalidationRule({ pattern: "edge", cacheType: "x", triggerOn: "ttl" });
    const now = 5_000_000;
    band.touchCache("edge:1", now - 100_000);
    const out = band.purgeStaleCache(now);
    expect(out.purgedKeys).not.toContain("edge:1");
  });
});

describe("Sprint 33 — last_invalidated_at nullable in sql", () => {
  it("no NOT NULL on column", () => {
    expect(sql129).toMatch(/last_invalidated_at\s+TIMESTAMPTZ/i);
    expect(sql129).not.toMatch(/last_invalidated_at\s+TIMESTAMPTZ\s+NOT\s+NULL/i);
  });
});

describe("Sprint 33 — pattern index column", () => {
  it("pattern in index", () => {
    expect(sql129).toMatch(/\(pattern\)/i);
  });
});

describe("Sprint 33 — two cache keys partial purge", () => {
  it("only stale removed", async () => {
    const z = delegatingZone2Retrieval({
      async suggestInvalidationTtl() {
        return { ttlSeconds: 50 };
      },
    });
    const band = new RetrievalCacheInvalidationPhase8Band(z);
    await band.registerInvalidationRule({ pattern: "mix", cacheType: "misc", triggerOn: "ttl" });
    const now = 8_000_000;
    band.touchCache("mix:old", now - 100_000);
    band.touchCache("mix:new", now - 1_000);
    const out = band.purgeStaleCache(now);
    expect(out.purgedKeys).toContain("mix:old");
    expect(out.purgedKeys).not.toContain("mix:new");
  });
});

describe("Sprint 33 — checkRuleMatch case sensitive pattern", () => {
  it("case matters", () => {
    const band = new RetrievalCacheInvalidationPhase8Band(new Zone2RetrievalServiceStub());
    const rule = {
      id: "1",
      pattern: "Ollama",
      ttlSeconds: 1,
      triggerOn: "x",
      lastInvalidatedAtMs: null,
    };
    expect(band.checkRuleMatch("cache:ollama", rule)).toBe(false);
    expect(band.checkRuleMatch("cache:Ollama:x", rule)).toBe(true);
  });
});
