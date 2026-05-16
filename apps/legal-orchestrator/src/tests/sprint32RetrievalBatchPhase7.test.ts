import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RetrievalBatchPhase7Band } from "../coherentSystem/retrievalBatchPhase7.js";
import { Zone2RetrievalServiceStub } from "../coherentSystem/zone2RetrievalStub.js";
import { delegatingZone2Retrieval } from "./helpers/zone2RetrievalTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql128 = readFileSync(join(__dirname, "../../db/migrations/128_sprint32_retrieval_batch_query_jobs.sql"), "utf8");
const U1 = "00000000-0000-4000-8000-000000000001";

describe("migration 128_sprint32_retrieval_batch_query_jobs.sql", () => {
  it("creates retrieval_batch_query_jobs", () => {
    expect(sql128).toMatch(/CREATE TABLE IF NOT EXISTS public\.retrieval_batch_query_jobs/i);
  });
  it("columns user batch started completed status", () => {
    expect(sql128).toMatch(/user_id/i);
    expect(sql128).toMatch(/batch_size/i);
    expect(sql128).toMatch(/started_at/i);
    expect(sql128).toMatch(/completed_at/i);
    expect(sql128).toMatch(/status/i);
  });
  it("status CHECK", () => {
    expect(sql128).toMatch(/CHECK \(status IN \('queued', 'running', 'done', 'failed'\)\)/i);
  });
  it("batch_size positive CHECK", () => {
    expect(sql128).toMatch(/CHECK \(batch_size > 0\)/i);
  });
  it("indexes user and status", () => {
    expect(sql128).toMatch(/idx_retrieval_batch_jobs_user/i);
    expect(sql128).toMatch(/idx_retrieval_batch_jobs_status/i);
  });
  it("RLS self select insert update", () => {
    expect(sql128).toMatch(/retrieval_batch_jobs_self_select/i);
    expect(sql128).toMatch(/retrieval_batch_jobs_self_insert/i);
    expect(sql128).toMatch(/retrieval_batch_jobs_self_update/i);
    expect(sql128).toMatch(/retrieval_batch_jobs_admin_delete/i);
  });
  it("FK users", () => {
    expect(sql128).toMatch(/REFERENCES public\.users\(id\)/i);
  });
  it("down drops", () => {
    const down = readFileSync(join(__dirname, "../../db/migrations/128_sprint32_retrieval_batch_query_jobs.down.sql"), "utf8");
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.retrieval_batch_query_jobs/i);
  });
});

describe("Sprint 32 — Zone2RetrievalServiceStub processBatchRemote", () => {
  it("indexes queries", async () => {
    const z = new Zone2RetrievalServiceStub();
    const r = await z.processBatchRemote(["a", "bb"]);
    expect(r).toHaveLength(2);
    expect(r[0]!.summary).toBe("ok:1");
    expect(r[1]!.summary).toBe("ok:2");
  });
  it("empty string query", async () => {
    const z = new Zone2RetrievalServiceStub();
    const r = await z.processBatchRemote([""]);
    expect(r[0]!.summary).toBe("err:empty");
  });
});

describe("Sprint 32 — queueBatchQueries", () => {
  it("returns job metadata", () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const j = band.queueBatchQueries(U1, ["q1", "q2"]);
    expect(j.batchSize).toBe(2);
    expect(j.userId).toBe(U1);
    expect(j.status).toBe("queued");
    expect(j.jobId).toMatch(/^[0-9a-f-]{36}$/i);
  });
  it("throws on empty", () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    expect(() => band.queueBatchQueries(U1, [])).toThrow(RangeError);
  });
});

describe("Sprint 32 — processBatchParallel", () => {
  it("delegates", async () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const r = await band.processBatchParallel(["x"]);
    expect(r[0]!.queryIndex).toBe(0);
  });
  it("spy", async () => {
    const spy = vi.fn(async (q: readonly string[]) => new Zone2RetrievalServiceStub().processBatchRemote(q));
    const z = delegatingZone2Retrieval({ processBatchRemote: spy });
    const band = new RetrievalBatchPhase7Band(z);
    await band.processBatchParallel(["a", "b"]);
    expect(spy).toHaveBeenCalledWith(["a", "b"]);
  });
});

describe("Sprint 32 — aggregateBatchResults", () => {
  it("joins summaries", () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const a = band.aggregateBatchResults([
      { queryIndex: 0, summary: "ok:1" },
      { queryIndex: 1, summary: "ok:2" },
    ]);
    expect(a.joined).toBe("ok:1|ok:2");
    expect(a.count).toBe(2);
  });
  it("empty rows", () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const a = band.aggregateBatchResults([]);
    expect(a.count).toBe(0);
    expect(a.joined).toBe("");
  });
});

describe("Sprint 32 — end-to-end stub flow", () => {
  it("queue process aggregate", async () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const job = band.queueBatchQueries(U1, ["alpha", "beta"]);
    const rows = await band.processBatchParallel(["alpha", "beta"]);
    const agg = band.aggregateBatchResults(rows);
    expect(job.batchSize).toBe(agg.count);
  });
});

describe("Sprint 32 — retrievalBatchPhase7Band export", () => {
  it("from index", async () => {
    const { retrievalBatchPhase7Band } = await import("../coherentSystem/index.js");
    const rows = await retrievalBatchPhase7Band.processBatchParallel(["from-index"]);
    expect(rows[0]!.summary).toContain("ok:");
  });
});

describe("Sprint 32 — RLS ENABLE", () => {
  it("enabled", () => {
    expect(sql128).toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });
});

describe("Sprint 32 — batch job startedAtMs", () => {
  it("near now", () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const before = Date.now();
    const j = band.queueBatchQueries(U1, ["only"]);
    expect(j.startedAtMs).toBeGreaterThanOrEqual(before - 2);
  });
});

describe("Sprint 32 — processBatchParallel preserves order", () => {
  it("indices 0..n", async () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const r = await band.processBatchParallel(["", "b", "cc"]);
    expect(r.map((x) => x.queryIndex)).toEqual([0, 1, 2]);
  });
});

describe("Sprint 32 — aggregate delimiter", () => {
  it("single row no pipe", () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    expect(band.aggregateBatchResults([{ queryIndex: 0, summary: "only" }]).joined).toBe("only");
  });
});

describe("Sprint 32 — migration completed_at nullable", () => {
  it("column without NOT NULL", () => {
    expect(sql128).toMatch(/completed_at\s+TIMESTAMPTZ/i);
    expect(sql128).not.toMatch(/completed_at\s+TIMESTAMPTZ\s+NOT\s+NULL/i);
  });
});

describe("Sprint 32 — queue unique jobIds", () => {
  it("two jobs differ", () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const a = band.queueBatchQueries(U1, ["1"]);
    const b = band.queueBatchQueries(U1, ["2"]);
    expect(a.jobId).not.toBe(b.jobId);
  });
});

describe("Sprint 32 — processBatchRemote override", () => {
  it("delegating", async () => {
    const z = delegatingZone2Retrieval({
      async processBatchRemote() {
        return [{ queryIndex: 0, summary: "custom" }];
      },
    });
    const band = new RetrievalBatchPhase7Band(z);
    const r = await band.processBatchParallel(["ignored"]);
    expect(r[0]!.summary).toBe("custom");
  });
});

describe("Sprint 32 — large batch", () => {
  it("length 20", async () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const qs = Array.from({ length: 20 }, (_, i) => `q${i}`);
    const job = band.queueBatchQueries(U1, qs);
    expect(job.batchSize).toBe(20);
    const rows = await band.processBatchParallel(qs);
    expect(rows).toHaveLength(20);
  });
});

describe("Sprint 32 — aggregate count matches", () => {
  it("after process", async () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const rows = await band.processBatchParallel(["a", "b", "c"]);
    expect(band.aggregateBatchResults(rows).count).toBe(3);
  });
});

describe("Sprint 32 — status values in CHECK only", () => {
  it("includes done", () => {
    expect(sql128).toMatch(/'done'/i);
  });
  it("includes failed", () => {
    expect(sql128).toMatch(/'failed'/i);
  });
});

describe("Sprint 32 — user id passthrough", () => {
  it("second user", () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const u2 = "00000000-0000-4000-8000-000000000002";
    expect(band.queueBatchQueries(u2, ["x"]).userId).toBe(u2);
  });
});

describe("Sprint 32 — FOR ALL not required on user table", () => {
  it("uses granular policies", () => {
    expect(sql128).toMatch(/FOR SELECT/i);
  });
});

describe("Sprint 32 — batch_size matches queries", () => {
  it("one", () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    expect(band.queueBatchQueries(U1, ["a"]).batchSize).toBe(1);
  });
  it("two", () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    expect(band.queueBatchQueries(U1, ["a", "b"]).batchSize).toBe(2);
  });
  it("three", () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    expect(band.queueBatchQueries(U1, ["x", "y", "z"]).batchSize).toBe(3);
  });
});

describe("Sprint 32 — processBatchParallel empty array allowed", () => {
  it("returns empty", async () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const r = await band.processBatchParallel([]);
    expect(r).toHaveLength(0);
  });
});

describe("Sprint 32 — primary key id", () => {
  it("uuid default", () => {
    expect(sql128).toMatch(/id\s+UUID PRIMARY KEY/i);
  });
});

describe("Sprint 32 — aggregate long", () => {
  it("many segments", async () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const rows = await band.processBatchParallel(["a", "b", "c", "d"]);
    const j = band.aggregateBatchResults(rows).joined.split("|").length;
    expect(j).toBe(4);
  });
});

describe("Sprint 32 — err empty in batch", () => {
  it("mixed", async () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const rows = await band.processBatchParallel(["ok", ""]);
    expect(rows[1]!.summary).toMatch(/^err:/);
  });
});

describe("Sprint 32 — COMMENT ON TABLE", () => {
  it("comment", () => {
    expect(sql128).toMatch(/COMMENT ON TABLE/i);
  });
});

describe("Sprint 32 — started_at default", () => {
  it("now()", () => {
    expect(sql128).toMatch(/started_at.*DEFAULT now\(\)/is);
  });
});

describe("Sprint 32 — jobId uuid v4 shape", () => {
  it("version nibble", () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const j = band.queueBatchQueries(U1, ["v"]);
    const parts = j.jobId.split("-");
    expect(parts[2]!.startsWith("4")).toBe(true);
  });
});

describe("Sprint 32 — aggregate stability", () => {
  it("same rows same joined", () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const rows = [
      { queryIndex: 0, summary: "a" },
      { queryIndex: 1, summary: "b" },
    ];
    expect(band.aggregateBatchResults(rows).joined).toBe(band.aggregateBatchResults(rows).joined);
  });
});

describe("Sprint 32 — processBatchParallel length", () => {
  it("matches input", async () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const input = ["1", "2", "3", "4", "5"];
    const r = await band.processBatchParallel(input);
    expect(r.length).toBe(input.length);
  });
});

describe("Sprint 32 — queue throws message", () => {
  it("range error text", () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    expect(() => band.queueBatchQueries(U1, [])).toThrow(/at least one query/i);
  });
});

describe("Sprint 32 — admin delete policy only admin", () => {
  it("delete uses admin", () => {
    expect(sql128).toMatch(/FOR DELETE USING \(public\.current_app_user_is_admin\(\)\)/i);
  });
});

describe("Sprint 32 — batch stub summary pattern", () => {
  it("ok prefix", async () => {
    const z = new Zone2RetrievalServiceStub();
    const r = await z.processBatchRemote(["hello"]);
    expect(r[0]!.summary.startsWith("ok:")).toBe(true);
  });
});

describe("Sprint 32 — aggregate unicode safe", () => {
  it("pipe in summary preserved", () => {
    const band = new RetrievalBatchPhase7Band(new Zone2RetrievalServiceStub());
    const agg = band.aggregateBatchResults([
      { queryIndex: 0, summary: "a|x" },
      { queryIndex: 1, summary: "b" },
    ]);
    expect(agg.joined).toBe("a|x|b");
  });
});
