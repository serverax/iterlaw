import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  anonymizeRetrievalQueryHint,
  buildHnswCreateIndexSql,
  RetrievalHNSWPhase1Band,
  vectorOpClassFor,
} from "../coherentSystem/retrievalHNSWPhase1.js";
import { hnswEfSearchDefault } from "../coherentSystem/retrievalBand.js";
import { Zone2RetrievalServiceStub } from "../coherentSystem/zone2RetrievalStub.js";
import type { HnswBuildParams } from "../coherentSystem/zone2RetrievalTypes.js";
import { delegatingZone2Retrieval } from "./helpers/zone2RetrievalTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql122 = readFileSync(join(__dirname, "../../db/migrations/122_sprint26_retrieval_hnsw_setup.sql"), "utf8");

describe("migration 122_sprint26_retrieval_hnsw_setup.sql", () => {
  it("creates retrieval_hnsw_lane_profiles", () => {
    expect(sql122).toMatch(/CREATE TABLE IF NOT EXISTS public\.retrieval_hnsw_lane_profiles/i);
  });
  it("distance CHECK", () => {
    expect(sql122).toMatch(/CHECK \(distance IN \('cosine', 'l2', 'ip'\)\)/i);
  });
  it("dimensions CHECK", () => {
    expect(sql122).toMatch(/CHECK \(dimensions > 0\)/i);
  });
  it("RLS enabled", () => {
    expect(sql122).toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });
  it("admin policy", () => {
    expect(sql122).toMatch(/retrieval_hnsw_lane_profiles_admin_all/i);
  });
  it("seed insert for UK lane", () => {
    expect(sql122).toMatch(/UK_EMP_LEGAL_CHUNKS_PRIMARY/i);
    expect(sql122).toMatch(/ON CONFLICT \(lane_id\) DO NOTHING/i);
  });
  it("down migration drops table", () => {
    const down = readFileSync(join(__dirname, "../../db/migrations/122_sprint26_retrieval_hnsw_setup.down.sql"), "utf8");
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.retrieval_hnsw_lane_profiles/i);
  });
});

describe("Sprint 26 — vectorOpClassFor", () => {
  it("cosine", () => {
    expect(vectorOpClassFor("cosine")).toBe("vector_cosine_ops");
  });
  it("l2", () => {
    expect(vectorOpClassFor("l2")).toBe("vector_l2_ops");
  });
  it("ip", () => {
    expect(vectorOpClassFor("ip")).toBe("vector_ip_ops");
  });
});

describe("Sprint 26 — buildHnswCreateIndexSql", () => {
  it("contains HNSW and opclass", () => {
    const sql = buildHnswCreateIndexSql({
      indexName: "idx_test",
      tableQualified: "public.legal_chunks",
      column: "embedding",
      distance: "cosine",
      m: 16,
      efConstruction: 200,
    });
    expect(sql).toMatch(/USING hnsw/i);
    expect(sql).toMatch(/vector_cosine_ops/);
    expect(sql).toMatch(/m = 16/);
    expect(sql).toMatch(/ef_construction = 200/);
  });
  it("l2 ops in SQL", () => {
    const sql = buildHnswCreateIndexSql({
      indexName: "i2",
      tableQualified: "uk_emp_rag.q_a_cache",
      column: "embedding_vector",
      distance: "l2",
      m: 8,
      efConstruction: 64,
    });
    expect(sql).toMatch(/vector_l2_ops/);
  });
  it("ip ops in SQL", () => {
    const sql = buildHnswCreateIndexSql({
      indexName: "i3",
      tableQualified: "public.t",
      column: "v",
      distance: "ip",
      m: 12,
      efConstruction: 100,
    });
    expect(sql).toMatch(/vector_ip_ops/);
  });
});

describe("Sprint 26 — anonymizeRetrievalQueryHint", () => {
  it("masks email", () => {
    expect(anonymizeRetrievalQueryHint("reach me at user@example.com thanks")).toContain("[EMAIL]");
    expect(anonymizeRetrievalQueryHint("reach me at user@example.com thanks")).not.toContain("user@example.com");
  });
  it("no change when no email", () => {
    const s = "unfair dismissal ERA";
    expect(anonymizeRetrievalQueryHint(s)).toBe(s);
  });
});

describe("Sprint 26 — Zone2RetrievalServiceStub", () => {
  it("deterministic remoteIndexId for same params", async () => {
    const stub = new Zone2RetrievalServiceStub();
    const p: HnswBuildParams = {
      laneId: "LANE_A",
      indexName: "idx_one",
      dimensions: 1536,
      distance: "cosine",
      lists: 32,
      m: 16,
      efConstruction: 200,
    };
    const a = await stub.suggestRemoteHnswBuild(p);
    const b = await stub.suggestRemoteHnswBuild(p);
    expect(a.remoteIndexId).toBe(b.remoteIndexId);
  });

  it("recommendedLists >= 16", async () => {
    const stub = new Zone2RetrievalServiceStub();
    const r = await stub.suggestRemoteHnswBuild({
      laneId: "L",
      indexName: "i",
      dimensions: 384,
      distance: "cosine",
      lists: 8,
      m: 8,
      efConstruction: 64,
    });
    expect(r.recommendedLists).toBeGreaterThanOrEqual(16);
  });
});

describe("Sprint 26 — RetrievalHNSWPhase1Band", () => {
  it("merges lists for ef_search", async () => {
    const band = new RetrievalHNSWPhase1Band(new Zone2RetrievalServiceStub());
    const plan = await band.planBuild({
      laneId: "UK_EMP_LEGAL_CHUNKS_PRIMARY",
      indexName: "legal_chunks_embedding_hnsw_primary",
      dimensions: 1536,
      distance: "cosine",
      lists: 32,
      m: 16,
      efConstruction: 200,
    });
    expect(plan.mergedListsForEfSearch).toBe(Math.max(32, plan.zone2RecommendedLists));
    expect(plan.efSearch).toBe(hnswEfSearchDefault(plan.mergedListsForEfSearch));
  });

  it("createIndexSqlHint references index name", async () => {
    const band = new RetrievalHNSWPhase1Band(new Zone2RetrievalServiceStub());
    const plan = await band.planBuild({
      laneId: "L",
      indexName: "my_hnsw_idx",
      dimensions: 1536,
      distance: "cosine",
      lists: 64,
      m: 16,
      efConstruction: 200,
    });
    expect(plan.createIndexSqlHint).toContain("my_hnsw_idx");
  });

  it("uses injected Zone2 service", async () => {
    const zone2 = delegatingZone2Retrieval({
      async suggestRemoteHnswBuild() {
        return { remoteIndexId: "fixed-remote", recommendedLists: 100 };
      },
    });
    const band = new RetrievalHNSWPhase1Band(zone2);
    const plan = await band.planBuild({
      laneId: "x",
      indexName: "y",
      dimensions: 1536,
      distance: "cosine",
      lists: 10,
      m: 16,
      efConstruction: 200,
    });
    expect(plan.remoteIndexId).toBe("fixed-remote");
    expect(plan.mergedListsForEfSearch).toBe(100);
  });

  it("spy receives build params", async () => {
    const spy = vi.fn(async (p: HnswBuildParams) => {
      return new Zone2RetrievalServiceStub().suggestRemoteHnswBuild(p);
    });
    const zone2 = delegatingZone2Retrieval({ suggestRemoteHnswBuild: spy });
    const band = new RetrievalHNSWPhase1Band(zone2);
    const params: HnswBuildParams = {
      laneId: "lane",
      indexName: "idx",
      dimensions: 1536,
      distance: "cosine",
      lists: 48,
      m: 16,
      efConstruction: 200,
    };
    await band.planBuild(params);
    expect(spy).toHaveBeenCalledWith(params);
  });
});

describe("Sprint 26 — ef_search grid vs merged lists", () => {
  it.each([16, 32, 48, 64, 96])("lists %i", async (lists) => {
    const band = new RetrievalHNSWPhase1Band(new Zone2RetrievalServiceStub());
    const plan = await band.planBuild({
      laneId: "G",
      indexName: "ix",
      dimensions: 1536,
      distance: "cosine",
      lists,
      m: 16,
      efConstruction: 200,
    });
    expect(plan.efSearch).toBe(hnswEfSearchDefault(plan.mergedListsForEfSearch));
    expect(plan.efSearch).toBeGreaterThanOrEqual(16);
    expect(plan.efSearch).toBeLessThanOrEqual(200);
  });
});

describe("Sprint 26 — retrievalHnswPhase1Band default export", () => {
  it("planBuild via index", async () => {
    const { retrievalHnswPhase1Band } = await import("../coherentSystem/index.js");
    const plan = await retrievalHnswPhase1Band.planBuild({
      laneId: "UK_EMP_LEGAL_CHUNKS_PRIMARY",
      indexName: "legal_chunks_embedding_hnsw_primary",
      dimensions: 1536,
      distance: "cosine",
      lists: 64,
      m: 16,
      efConstruction: 200,
    });
    expect(plan.remoteIndexId).toContain("milvus-stub");
  });
});

describe("Sprint 26 — stub sanitizes lane id in remote id", () => {
  it("drops exotic characters from lane segment", async () => {
    const stub = new Zone2RetrievalServiceStub();
    const r = await stub.suggestRemoteHnswBuild({
      laneId: "weird/lane:id",
      indexName: "idx",
      dimensions: 1536,
      distance: "cosine",
      lists: 32,
      m: 16,
      efConstruction: 200,
    });
    expect(r.remoteIndexId).not.toContain("/");
    expect(r.remoteIndexId).not.toContain(":");
  });
});

describe("Sprint 26 — migration column constraints", () => {
  it("lists m ef checks", () => {
    expect(sql122).toMatch(/CHECK \(lists > 0\)/i);
    expect(sql122).toMatch(/CHECK \(m > 0\)/i);
    expect(sql122).toMatch(/CHECK \(ef_construction > 0\)/i);
  });
  it("index_name unique", () => {
    expect(sql122).toMatch(/index_name\s+TEXT NOT NULL UNIQUE/i);
  });
});

describe("Sprint 26 — buildHnsw m parameter grid", () => {
  it.each([8, 12, 16, 24, 32])("m=%i", (m) => {
    const sql = buildHnswCreateIndexSql({
      indexName: "ix",
      tableQualified: "public.t",
      column: "e",
      distance: "cosine",
      m,
      efConstruction: 100,
    });
    expect(sql).toContain(`m = ${m}`);
  });
});

describe("Sprint 26 — anonymize multiple emails", () => {
  it.each([
    "a@b.co and c@d.org",
    "x@y.zz",
    "no-email-here",
    "mix@here.com plain",
  ])("row %s", (s) => {
    const out = anonymizeRetrievalQueryHint(s);
    if (s.includes("@")) {
      expect(out).not.toMatch(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/);
    } else {
      expect(out).toBe(s);
    }
  });
});

describe("Sprint 26 — recommendedLists cap 128", () => {
  it.each([120, 200, 300])("lists seed %i", async (lists) => {
    const stub = new Zone2RetrievalServiceStub();
    const r = await stub.suggestRemoteHnswBuild({
      laneId: "L",
      indexName: "i",
      dimensions: 1536,
      distance: "cosine",
      lists,
      m: 16,
      efConstruction: 200,
    });
    expect(r.recommendedLists).toBeLessThanOrEqual(128);
  });
});
