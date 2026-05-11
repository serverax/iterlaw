import { describe, it, expect, vi, beforeEach } from "vitest";
import { listRegistryEntries, listAllRegistryEntries, isKnownSourceKey } from "../ingestion/sourceRegistry";
import { chunkDocument } from "../ingestion/chunkDocument";
import { hashDocumentVersion } from "../ingestion/hashDocumentVersion";
import { persistIngestionJob, noOpPersistenceSink, type PersistenceSink } from "../ingestion/persistIngestionJob";
import { runIngestionPlan } from "../ingestion/runIngestionPlan";
import { IngestionAudit } from "../ingestion/ingestionAudit";
import { fetchSourceText } from "../ingestion/fetchSource";
import { __clearRobotsCacheForTests } from "../ingestion/robotsCompliance";

describe("sourceRegistry", () => {
  it("includes legislation.gov.uk, GOV.UK, ACAS, ET collection, and CAC-style entries", () => {
    const all = listAllRegistryEntries();
    const hosts = new Set(all.map((e) => e.robotsHost));
    expect(hosts.has("www.legislation.gov.uk")).toBe(true);
    expect(hosts.has("www.gov.uk")).toBe(true);
    expect(hosts.has("www.acas.org.uk")).toBe(true);
    const legislation = all.filter((e) => e.sourceKey === "legislation");
    expect(legislation.length).toBeGreaterThanOrEqual(1);
    expect(legislation[0].canonicalUrl).toContain("legislation.gov.uk");
  });

  it("filters by source and limit", () => {
    const rows = listRegistryEntries({ sourceKey: "legislation", limit: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceKey).toBe("legislation");
  });

  it("isKnownSourceKey guards CLI values", () => {
    expect(isKnownSourceKey("legislation")).toBe(true);
    expect(isKnownSourceKey("nope")).toBe(false);
  });
});

describe("chunkDocument", () => {
  it("produces multiple chunks for long text", () => {
    const body = "word ".repeat(500);
    const chunks = chunkDocument(
      { title: "t", canonicalUrl: "https://example.com/x", text: body },
      { maxChars: 200, overlapChars: 20 }
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].chunkIndex).toBe(0);
  });
});

describe("hashDocumentVersion", () => {
  it("changes when normalized body changes", () => {
    const a = { title: "t", canonicalUrl: "https://example.com/a", text: "hello" };
    const b = { ...a, text: "hello!" };
    expect(hashDocumentVersion(a)).toBe(hashDocumentVersion(a));
    expect(hashDocumentVersion(a)).not.toBe(hashDocumentVersion(b));
  });
});

describe("persistIngestionJob dry-run", () => {
  it("never calls sink methods when dryRun", async () => {
    const sink: PersistenceSink = {
      persistJob: vi.fn(async () => {}),
      persistChunks: vi.fn(async () => {}),
    };
    const r = await persistIngestionJob(
      {
        jobId: "j1",
        canonicalUrl: "https://example.com",
        versionHash: "abc",
        chunks: [{ chunkIndex: 0, text: "x" }],
      },
      { dryRun: true, writeChunks: true },
      sink
    );
    expect(r.chunksWritten).toBe(0);
    expect(r.jobSaved).toBe(false);
    expect(sink.persistJob).not.toHaveBeenCalled();
    expect(sink.persistChunks).not.toHaveBeenCalled();
  });

  it("writes job but not chunks when writeChunks is false", async () => {
    const sink: PersistenceSink = {
      persistJob: vi.fn(async () => {}),
      persistChunks: vi.fn(async () => {}),
    };
    const r = await persistIngestionJob(
      {
        jobId: "j2",
        canonicalUrl: "https://example.com",
        versionHash: "def",
        chunks: [{ chunkIndex: 0, text: "y" }],
      },
      { dryRun: false, writeChunks: false },
      sink
    );
    expect(r.jobSaved).toBe(true);
    expect(r.chunksWritten).toBe(0);
    expect(sink.persistJob).toHaveBeenCalledTimes(1);
    expect(sink.persistChunks).not.toHaveBeenCalled();
  });
});

describe("runIngestionPlan", () => {
  beforeEach(() => {
    __clearRobotsCacheForTests();
  });

  it("dry-run does not invoke persistence sink", async () => {
    const sink: PersistenceSink = {
      persistJob: vi.fn(async () => {}),
      persistChunks: vi.fn(async () => {}),
    };
    const audit = new IngestionAudit("memory");
    const res = await runIngestionPlan({
      sourceKey: "legislation",
      limit: 2,
      dryRun: true,
      live: false,
      writeChunks: false,
      audit,
      sink,
    });
    expect(res.dryRun).toBe(true);
    expect(res.items.length).toBeGreaterThan(0);
    expect(sink.persistJob).not.toHaveBeenCalled();
    expect(sink.persistChunks).not.toHaveBeenCalled();
  });

  it("records fetch errors safely without throwing", async () => {
    const audit = new IngestionAudit("memory");
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = typeof url === "string" ? url : url instanceof Request ? url.url : String(url);
      if (u.includes("robots.txt")) {
        return new Response("User-agent: *\nDisallow: /\n", { status: 200 });
      }
      return new Response("ok", { status: 200 });
    });

    const res = await runIngestionPlan({
      sourceKey: "legislation",
      limit: 1,
      dryRun: false,
      live: true,
      writeChunks: false,
      audit,
      fetchImpl: fetchImpl as typeof fetch,
      sink: noOpPersistenceSink,
    });

    expect(res.live).toBe(true);
    const item = res.items[0];
    expect(item.fetch).toBeDefined();
    expect(item.fetch?.ok).toBe(false);
    expect(item.fetch?.error).toMatch(/robots|disallowed/i);
    const errs = audit.snapshot().filter((e) => e.type === "fetch_error");
    expect(errs.length).toBeGreaterThanOrEqual(1);
  });
});

describe("fetchSourceText", () => {
  beforeEach(() => {
    __clearRobotsCacheForTests();
  });

  it("allows fetch when robots permits path", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = typeof url === "string" ? url : url instanceof Request ? url.url : String(url);
      if (u.includes("robots.txt")) {
        return new Response("User-agent: *\nDisallow: /private\n", { status: 200 });
      }
      return new Response("<html><body>Hello</body></html>", { status: 200 });
    });
    const r = await fetchSourceText("https://example.com/public/x", "example.com", "/public/x", {
      userAgent: "test-bot",
      fetchImpl: fetchImpl as typeof fetch,
    });
    expect(r.ok).toBe(true);
    expect(r.body).toContain("Hello");
  });

  it("respects robots disallow", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = typeof url === "string" ? url : url instanceof Request ? url.url : String(url);
      if (u.includes("robots.txt")) {
        return new Response("User-agent: *\nDisallow: /\n", { status: 200 });
      }
      return new Response("body", { status: 200 });
    });
    const r = await fetchSourceText("https://example.com/page", "example.com", "/page", {
      userAgent: "test-bot",
      fetchImpl: fetchImpl as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBeDefined();
  });
});
