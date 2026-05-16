import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RetrievalSpeculativePhase4Band,
  speculativeQueryHash,
} from "../coherentSystem/retrievalSpeculativePhase4.js";
import { RetrievalOllamaPhase2Band } from "../coherentSystem/retrievalOllamaPhase2.js";
import { RetrievalStreamingPhase3Band } from "../coherentSystem/retrievalStreamingPhase3.js";
import { Zone2RetrievalServiceStub } from "../coherentSystem/zone2RetrievalStub.js";
import { delegatingZone2Retrieval } from "./helpers/zone2RetrievalTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql125 = readFileSync(join(__dirname, "../../db/migrations/125_sprint29_retrieval_speculative_decode_cache.sql"), "utf8");

describe("migration 125_sprint29_retrieval_speculative_decode_cache.sql", () => {
  it("creates retrieval_speculative_decode_cache", () => {
    expect(sql125).toMatch(/CREATE TABLE IF NOT EXISTS public\.retrieval_speculative_decode_cache/i);
  });
  it("columns query_hash draft_tokens verifier_tokens acceptance_rate", () => {
    expect(sql125).toMatch(/query_hash/i);
    expect(sql125).toMatch(/draft_tokens/i);
    expect(sql125).toMatch(/verifier_tokens/i);
    expect(sql125).toMatch(/acceptance_rate/i);
  });
  it("acceptance_rate CHECK 0..1", () => {
    expect(sql125).toMatch(/CHECK \(acceptance_rate >= 0 AND acceptance_rate <= 1\)/i);
  });
  it("indexes query_hash and acceptance_rate", () => {
    expect(sql125).toMatch(/idx_retrieval_speculative_query_hash/i);
    expect(sql125).toMatch(/idx_retrieval_speculative_acceptance/i);
  });
  it("RLS admin policy", () => {
    expect(sql125).toMatch(/retrieval_speculative_decode_cache_admin_all/i);
    expect(sql125).toMatch(/current_app_user_is_admin\(\)/i);
  });
  it("ENABLE ROW LEVEL SECURITY", () => {
    expect(sql125).toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });
  it("down drops table", () => {
    const down = readFileSync(join(__dirname, "../../db/migrations/125_sprint29_retrieval_speculative_decode_cache.down.sql"), "utf8");
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.retrieval_speculative_decode_cache/i);
  });
});

describe("Sprint 29 — Zone2RetrievalServiceStub speculativeDecodeDraft", () => {
  it("maps words to draft: tokens", async () => {
    const z = new Zone2RetrievalServiceStub();
    const d = await z.speculativeDecodeDraft("one two");
    expect(d.draftTokens).toEqual(["draft:one", "draft:two"]);
  });
  it("empty query yields placeholder", async () => {
    const z = new Zone2RetrievalServiceStub();
    const d = await z.speculativeDecodeDraft("  ");
    expect(d.draftTokens).toEqual(["[empty-draft]"]);
  });
});

describe("Sprint 29 — Zone2RetrievalServiceStub verifyDraftAgainstVerifier", () => {
  it("full match when verifier contains all words", async () => {
    const z = new Zone2RetrievalServiceStub();
    const v = await z.verifyDraftAgainstVerifier(["draft:aa", "draft:bb"], "aa bb cc");
    expect(v.acceptanceRate).toBe(1);
  });
  it("partial match", async () => {
    const z = new Zone2RetrievalServiceStub();
    const v = await z.verifyDraftAgainstVerifier(["draft:x", "draft:y"], "x quux");
    expect(v.acceptanceRate).toBe(0.5);
  });
  it("empty draft zero rate", async () => {
    const z = new Zone2RetrievalServiceStub();
    const v = await z.verifyDraftAgainstVerifier([], "anything");
    expect(v.acceptanceRate).toBe(0);
  });
});

describe("Sprint 29 — speculativeQueryHash", () => {
  it("stable for same inputs", () => {
    expect(speculativeQueryHash("q", "v")).toBe(speculativeQueryHash("q", "v"));
  });
  it("differs when query changes", () => {
    expect(speculativeQueryHash("a", "v")).not.toBe(speculativeQueryHash("b", "v"));
  });
  it("differs when verifier changes", () => {
    expect(speculativeQueryHash("q", "a")).not.toBe(speculativeQueryHash("q", "b"));
  });
  it("length 40 hex", () => {
    expect(speculativeQueryHash("x", "y")).toMatch(/^[a-f0-9]{40}$/);
  });
});

describe("Sprint 29 — RetrievalSpeculativePhase4Band", () => {
  it("computeDraftModel delegates", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalSpeculativePhase4Band(
      z,
      new RetrievalOllamaPhase2Band(z),
      new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z)),
    );
    const d = await band.computeDraftModel("alpha");
    expect(d.draftTokens[0]).toBe("draft:alpha");
  });
  it("verifyDraftTokens delegates", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalSpeculativePhase4Band(
      z,
      new RetrievalOllamaPhase2Band(z),
      new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z)),
    );
    const v = await band.verifyDraftTokens(["draft:z"], "z");
    expect(v.acceptanceRate).toBe(1);
  });
  it("cacheSpeculativeResult includes mergedTtlMs", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalSpeculativePhase4Band(
      z,
      new RetrievalOllamaPhase2Band(z),
      new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z)),
    );
    const row = await band.cacheSpeculativeResult("foo bar", "foo bar", {
      model: "llama3",
      requestId: "00000000-0000-4000-8000-000000000001",
    });
    expect(row.mergedTtlMs).toBeGreaterThan(0);
    expect(row.streamChunkCount).toBe(2);
  });
  it("verifierTokens split", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalSpeculativePhase4Band(
      z,
      new RetrievalOllamaPhase2Band(z),
      new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z)),
    );
    const row = await band.cacheSpeculativeResult("x", "a b c", {
      model: "m",
      requestId: "00000000-0000-4000-8000-000000000002",
    });
    expect(row.verifierTokens).toEqual(["a", "b", "c"]);
  });
  it("empty verifier tokens placeholder", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalSpeculativePhase4Band(
      z,
      new RetrievalOllamaPhase2Band(z),
      new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z)),
    );
    const row = await band.cacheSpeculativeResult("x", "   ", {
      model: "m",
      requestId: "00000000-0000-4000-8000-000000000003",
    });
    expect(row.verifierTokens).toEqual(["[empty-verifier]"]);
  });
  it("spy on speculativeDecodeDraft", async () => {
    const spy = vi.fn(async (q: string) => new Zone2RetrievalServiceStub().speculativeDecodeDraft(q));
    const z = delegatingZone2Retrieval({ speculativeDecodeDraft: spy });
    const band = new RetrievalSpeculativePhase4Band(
      z,
      new RetrievalOllamaPhase2Band(z),
      new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z)),
    );
    await band.cacheSpeculativeResult("a b", "a", { model: "m", requestId: "00000000-0000-4000-8000-000000000004" });
    expect(spy).toHaveBeenCalledWith("a b");
  });
});

describe("Sprint 29 — computeSpeculativeCacheHitRate", () => {
  it("half", () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalSpeculativePhase4Band(
      z,
      new RetrievalOllamaPhase2Band(z),
      new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z)),
    );
    expect(band.computeSpeculativeCacheHitRate(5, 10)).toBe(0.5);
  });
  it("zero total", () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalSpeculativePhase4Band(
      z,
      new RetrievalOllamaPhase2Band(z),
      new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z)),
    );
    expect(band.computeSpeculativeCacheHitRate(1, 0)).toBe(0);
  });
  it("clamps above 1", () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalSpeculativePhase4Band(
      z,
      new RetrievalOllamaPhase2Band(z),
      new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z)),
    );
    expect(band.computeSpeculativeCacheHitRate(20, 10)).toBe(1);
  });
  it("negative total", () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalSpeculativePhase4Band(
      z,
      new RetrievalOllamaPhase2Band(z),
      new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z)),
    );
    expect(band.computeSpeculativeCacheHitRate(1, -3)).toBe(0);
  });
  it("NaN hits", () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalSpeculativePhase4Band(
      z,
      new RetrievalOllamaPhase2Band(z),
      new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z)),
    );
    expect(band.computeSpeculativeCacheHitRate(Number.NaN, 4)).toBe(0);
  });
});

describe("Sprint 29 — retrievalSpeculativePhase4Band default export", () => {
  it("cacheSpeculativeResult via index", async () => {
    const { retrievalSpeculativePhase4Band } = await import("../coherentSystem/index.js");
    const row = await retrievalSpeculativePhase4Band.cacheSpeculativeResult("ping", "ping", {
      model: "13b",
      requestId: "00000000-0000-4000-8000-000000000005",
    });
    expect(row.queryHash).toHaveLength(40);
    expect(row.acceptanceRate).toBeGreaterThanOrEqual(0);
  });
});

describe("Sprint 29 — acceptance grid", () => {
  it.each([
    ["a", "a", 1],
    ["a b", "a", 0.5],
    ["a b", "c", 0],
  ] as const)("query %s verifier %s", async (q, ver, expected) => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalSpeculativePhase4Band(
      z,
      new RetrievalOllamaPhase2Band(z),
      new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z)),
    );
    const row = await band.cacheSpeculativeResult(q, ver, {
      model: "m",
      requestId: "00000000-0000-4000-8000-000000000006",
    });
    expect(row.acceptanceRate).toBe(expected);
  });
});

describe("Sprint 29 — streamChunkCount aligns with Phase 3", () => {
  it.each(["one", "one two", "one two three"])("words %s", async (q) => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalSpeculativePhase4Band(
      z,
      new RetrievalOllamaPhase2Band(z),
      new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z)),
    );
    const stream = await new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z)).streamResponseChunks({
      model: "m",
      query: q,
      requestId: "00000000-0000-4000-8000-000000000007",
    });
    const row = await band.cacheSpeculativeResult(q, q, {
      model: "m",
      requestId: "00000000-0000-4000-8000-000000000008",
    });
    expect(row.streamChunkCount).toBe(stream.chunks.length);
  });
});

describe("Sprint 29 — FOR ALL policy wording", () => {
  it("uses FOR ALL", () => {
    expect(sql125).toMatch(/FOR ALL/i);
  });
});

describe("Sprint 29 — JSONB columns", () => {
  it("draft_tokens JSONB", () => {
    expect(sql125).toMatch(/draft_tokens\s+JSONB/i);
  });
  it("verifier_tokens JSONB", () => {
    expect(sql125).toMatch(/verifier_tokens\s+JSONB/i);
  });
});

describe("Sprint 29 — cache hit rate edge", () => {
  it("exact 1", () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalSpeculativePhase4Band(
      z,
      new RetrievalOllamaPhase2Band(z),
      new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z)),
    );
    expect(band.computeSpeculativeCacheHitRate(7, 7)).toBe(1);
  });
  it("zero hits", () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalSpeculativePhase4Band(
      z,
      new RetrievalOllamaPhase2Band(z),
      new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z)),
    );
    expect(band.computeSpeculativeCacheHitRate(0, 5)).toBe(0);
  });
});

describe("Sprint 29 — queryHash uniqueness", () => {
  it.each(Array.from({ length: 8 }, (_, i) => i))("hash %i", (i) => {
    expect(speculativeQueryHash(`q${i}`, "v")).not.toBe(speculativeQueryHash(`q${i + 1}`, "v"));
  });
});

describe("Sprint 29 — non-draft token path in verifier", () => {
  it("plain token match", async () => {
    const z = new Zone2RetrievalServiceStub();
    const v = await z.verifyDraftAgainstVerifier(["raw"], "prefix raw suffix");
    expect(v.acceptanceRate).toBe(1);
  });
});

describe("Sprint 29 — delegatingZone2Retrieval speculative override", () => {
  it("uses override for verify", async () => {
    const z = delegatingZone2Retrieval({
      async verifyDraftAgainstVerifier() {
        return { acceptanceRate: 0.33 };
      },
    });
    const band = new RetrievalSpeculativePhase4Band(
      z,
      new RetrievalOllamaPhase2Band(z),
      new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z)),
    );
    const row = await band.cacheSpeculativeResult("x y", "nope", {
      model: "m",
      requestId: "00000000-0000-4000-8000-000000000009",
    });
    expect(row.acceptanceRate).toBe(0.33);
  });
});
