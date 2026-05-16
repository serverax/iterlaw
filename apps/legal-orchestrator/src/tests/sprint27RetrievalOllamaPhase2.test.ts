import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeMergedOllamaTtlMs,
  ollamaExpiresAtIso,
  RetrievalOllamaPhase2Band,
} from "../coherentSystem/retrievalOllamaPhase2.js";
import { ollamaCacheTtlMs } from "../coherentSystem/retrievalBand.js";
import { Zone2RetrievalServiceStub } from "../coherentSystem/zone2RetrievalStub.js";
import type { Zone2RetrievalService } from "../coherentSystem/zone2RetrievalTypes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql123 = readFileSync(join(__dirname, "../../db/migrations/123_sprint27_retrieval_ollama_phase2.sql"), "utf8");

describe("migration 123_sprint27_retrieval_ollama_phase2.sql", () => {
  it("creates retrieval_ollama_inference_cache", () => {
    expect(sql123).toMatch(/CREATE TABLE IF NOT EXISTS public\.retrieval_ollama_inference_cache/i);
  });
  it("stores merged_ttl_ms and ttl columns", () => {
    expect(sql123).toMatch(/merged_ttl_ms/i);
    expect(sql123).toMatch(/zone1_ttl_ms/i);
    expect(sql123).toMatch(/zone2_ttl_ms/i);
  });
  it("response_json default", () => {
    expect(sql123).toMatch(/response_json/i);
  });
  it("RLS policies", () => {
    expect(sql123).toMatch(/retrieval_ollama_cache_self_select/i);
    expect(sql123).toMatch(/retrieval_ollama_cache_self_insert/i);
    expect(sql123).toMatch(/retrieval_ollama_cache_admin_delete/i);
  });
  it("indexes on user/model and expires", () => {
    expect(sql123).toMatch(/idx_retrieval_ollama_cache_user_model/i);
    expect(sql123).toMatch(/idx_retrieval_ollama_cache_expires/i);
  });
  it("down migration drops table", () => {
    const down = readFileSync(join(__dirname, "../../db/migrations/123_sprint27_retrieval_ollama_phase2.down.sql"), "utf8");
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.retrieval_ollama_inference_cache/i);
  });
});

describe("Sprint 27 — computeMergedOllamaTtlMs", () => {
  it("min of two", () => {
    expect(computeMergedOllamaTtlMs(100, 50)).toBe(50);
    expect(computeMergedOllamaTtlMs(50, 100)).toBe(50);
  });
  it("equal", () => {
    expect(computeMergedOllamaTtlMs(42, 42)).toBe(42);
  });
});

describe("Sprint 27 — ollamaExpiresAtIso", () => {
  it("adds ttl to now", () => {
    const t = ollamaExpiresAtIso(5000, 1_000_000_000_000);
    expect(t).toBe(new Date(1_000_000_000_000 + 5000).toISOString());
  });
});

describe("Sprint 27 — Zone2RetrievalServiceStub suggestOllamaCacheTtl", () => {
  it("never below 60s", async () => {
    const stub = new Zone2RetrievalServiceStub();
    const r = await stub.suggestOllamaCacheTtl("tiny");
    expect(r.ttlMs).toBeGreaterThanOrEqual(60_000);
  });

  it("below zone1 baseline for default model", async () => {
    const stub = new Zone2RetrievalServiceStub();
    const z1 = ollamaCacheTtlMs("llama3");
    const z2 = await stub.suggestOllamaCacheTtl("llama3");
    expect(z2.ttlMs).toBeLessThanOrEqual(z1);
  });

  it("deterministic for same model", async () => {
    const stub = new Zone2RetrievalServiceStub();
    const a = await stub.suggestOllamaCacheTtl("MY_70B_MODEL");
    const b = await stub.suggestOllamaCacheTtl("MY_70B_MODEL");
    expect(a.ttlMs).toBe(b.ttlMs);
  });
});

describe("Sprint 27 — RetrievalOllamaPhase2Band", () => {
  it("merged equals min", async () => {
    const band = new RetrievalOllamaPhase2Band(new Zone2RetrievalServiceStub());
    const plan = await band.planCacheTtl("llama3");
    expect(plan.mergedTtlMs).toBe(computeMergedOllamaTtlMs(plan.zone1TtlMs, plan.zone2TtlMs));
  });

  it("70b branch zone1 larger", async () => {
    const band = new RetrievalOllamaPhase2Band(new Zone2RetrievalServiceStub());
    const plan = await band.planCacheTtl("llama-70b-chat");
    expect(plan.zone1TtlMs).toBeGreaterThan(plan.zone2TtlMs);
    expect(plan.mergedTtlMs).toBe(plan.zone2TtlMs);
  });

  it("injected zone2 overrides ttl", async () => {
    const zone2: Zone2RetrievalService = {
      async suggestRemoteHnswBuild(p) {
        return new Zone2RetrievalServiceStub().suggestRemoteHnswBuild(p);
      },
      async suggestOllamaCacheTtl() {
        return { ttlMs: 10_000 };
      },
      async streamOllamaResponseChunked(q) {
        return new Zone2RetrievalServiceStub().streamOllamaResponseChunked(q);
      },
    };
    const band = new RetrievalOllamaPhase2Band(zone2);
    const plan = await band.planCacheTtl("anything");
    expect(plan.zone2TtlMs).toBe(10_000);
    expect(plan.mergedTtlMs).toBe(10_000);
  });

  it("spy on suggestOllamaCacheTtl", async () => {
    const spy = vi.fn(async (m: string) => new Zone2RetrievalServiceStub().suggestOllamaCacheTtl(m));
    const zone2: Zone2RetrievalService = {
      async suggestRemoteHnswBuild(p) {
        return new Zone2RetrievalServiceStub().suggestRemoteHnswBuild(p);
      },
      suggestOllamaCacheTtl: spy,
      async streamOllamaResponseChunked(q) {
        return new Zone2RetrievalServiceStub().streamOllamaResponseChunked(q);
      },
    };
    const band = new RetrievalOllamaPhase2Band(zone2);
    await band.planCacheTtl("model-x");
    expect(spy).toHaveBeenCalledWith("model-x");
  });
});

describe("Sprint 27 — retrievalOllamaPhase2Band default export", () => {
  it("planCacheTtl via index", async () => {
    const { retrievalOllamaPhase2Band } = await import("../coherentSystem/index.js");
    const plan = await retrievalOllamaPhase2Band.planCacheTtl("13b-fast");
    expect(plan.model).toBe("13b-fast");
    expect(plan.mergedTtlMs).toBeGreaterThan(0);
  });
});

describe("Sprint 27 — ttl plan grid", () => {
  it.each(["a", "b", "c13b", "d70b", "e"])("model %s", async (model) => {
    const band = new RetrievalOllamaPhase2Band(new Zone2RetrievalServiceStub());
    const plan = await band.planCacheTtl(model);
    expect(plan.zone1TtlMs).toBe(ollamaCacheTtlMs(model));
    expect(plan.mergedTtlMs).toBeLessThanOrEqual(plan.zone1TtlMs);
  });
});

describe("Sprint 27 — migration CHECK constraints", () => {
  it("positive ttl checks", () => {
    expect(sql123).toMatch(/CHECK \(zone1_ttl_ms > 0\)/i);
    expect(sql123).toMatch(/CHECK \(merged_ttl_ms > 0\)/i);
  });
});

describe("Sprint 27 — stub vs zone1 for 13b model", () => {
  it("13b model uses 13b ttl tier", async () => {
    const stub = new Zone2RetrievalServiceStub();
    const z1 = ollamaCacheTtlMs("foo13bbar");
    const z2 = await stub.suggestOllamaCacheTtl("foo13bbar");
    expect(z1).toBe(172_800_000);
    expect(z2.ttlMs).toBe(Math.max(60_000, z1 - 3_600_000));
  });
});

describe("Sprint 27 — merge when zone2 equals zone1 edge", () => {
  it("custom zone2 same as z1 yields merged z1", async () => {
    const z1 = ollamaCacheTtlMs("llama3");
    const zone2: Zone2RetrievalService = {
      async suggestRemoteHnswBuild(p) {
        return new Zone2RetrievalServiceStub().suggestRemoteHnswBuild(p);
      },
      async suggestOllamaCacheTtl() {
        return { ttlMs: z1 };
      },
      async streamOllamaResponseChunked(q) {
        return new Zone2RetrievalServiceStub().streamOllamaResponseChunked(q);
      },
    };
    const band = new RetrievalOllamaPhase2Band(zone2);
    const plan = await band.planCacheTtl("llama3");
    expect(plan.mergedTtlMs).toBe(z1);
  });
});

describe("Sprint 27 — workspace_id nullable in migration", () => {
  it("workspace_id column", () => {
    expect(sql123).toMatch(/workspace_id/i);
  });
});

describe("Sprint 27 — computeMergedOllamaTtlMs grid", () => {
  it.each([
    [1, 2, 1],
    [2, 1, 1],
    [100, 200, 100],
    [200, 100, 100],
    [1_000_000, 2_000_000, 1_000_000],
    [86_400_000, 43_200_000, 43_200_000],
    [10, 10, 10],
    [9, 10, 9],
    [10, 9, 9],
    [500, 499, 499],
    [3, 3, 3],
    [0.5, 1, 0.5],
  ] as const)("min(%i,%i)=%i", (a, b, e) => {
    expect(computeMergedOllamaTtlMs(a, b)).toBe(e);
  });
});

describe("Sprint 27 — planCacheTtl positive merged", () => {
  it.each([
    "llama3",
    "Llama-70B",
    "13b",
    "unknown",
    "MODEL_70B_X",
    "MODEL_13B_Y",
    "qwen",
    "mistral",
    "phi",
    "gemma",
  ])("model %s", async (model) => {
    const band = new RetrievalOllamaPhase2Band(new Zone2RetrievalServiceStub());
    const plan = await band.planCacheTtl(model);
    expect(plan.mergedTtlMs).toBeGreaterThan(0);
    expect(plan.zone1TtlMs).toBeGreaterThan(0);
    expect(plan.zone2TtlMs).toBeGreaterThan(0);
  });
});
