// Tests for the RAG retrieval layer:
//  - MockRetrieval against an in-memory corpus
//  - PostgresRetrieval mock-safe behaviour (no DATABASE_URL -> empty)
//  - mapRowToRetrievedLegalChunk pure-mapping function
// No live database is touched.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MockRetrieval,
  SAMPLE_UK_EMPLOYMENT_CORPUS,
  PostgresRetrieval,
  mapRowToRetrievedLegalChunk,
  createRagService,
} from "../rag";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;
beforeEach(() => {
  delete process.env.DATABASE_URL;
});
afterEach(() => {
  if (ORIGINAL_DATABASE_URL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
});

describe("MockRetrieval — successful retrieval", () => {
  it("returns matching chunks for 'dismissal'", async () => {
    const port = new MockRetrieval({ corpus: SAMPLE_UK_EMPLOYMENT_CORPUS });
    const r = await port.search({
      legal_pack: "uk_employment_england_wales",
      query_text: "dismissal",
      jurisdiction: "England and Wales",
      limit: 10,
    });
    expect(r.chunks.length).toBeGreaterThan(0);
    expect(r.chunks.every((c) => c.chunk_text.length > 0)).toBe(true);
    expect(r.retrieval_notes?.length ?? 0).toBeGreaterThan(0);
  });

  it("orders by authority_level descending (statute above ACAS above GOV.UK)", async () => {
    const port = new MockRetrieval({ corpus: SAMPLE_UK_EMPLOYMENT_CORPUS });
    const r = await port.search({
      legal_pack: "uk_employment_england_wales",
      query_text: "dismissal",
      limit: 10,
    });
    const levels = r.chunks.map((c) => c.authority_level);
    const sortedDesc = [...levels].sort((a, b) => b - a);
    expect(levels).toEqual(sortedDesc);
  });
});

describe("MockRetrieval — no result retrieval", () => {
  it("returns [] for a query no chunk contains and a 'no_match' note", async () => {
    const port = new MockRetrieval({ corpus: SAMPLE_UK_EMPLOYMENT_CORPUS });
    const r = await port.search({
      legal_pack: "uk_employment_england_wales",
      query_text: "wholly unrelated nonsense zorblat",
      limit: 10,
    });
    expect(r.chunks).toEqual([]);
    expect(r.retrieval_notes).toContain("mock_retrieval:no_match");
  });
});

describe("MockRetrieval — source_type filtering", () => {
  it("returns only legislation chunks when filtered", async () => {
    const port = new MockRetrieval({ corpus: SAMPLE_UK_EMPLOYMENT_CORPUS });
    const r = await port.search({
      legal_pack: "uk_employment_england_wales",
      query_text: "dismissal",
      source_types: ["legislation"],
      limit: 10,
    });
    expect(r.chunks.length).toBeGreaterThan(0);
    for (const c of r.chunks) expect(c.source_type).toBe("legislation");
    expect(r.retrieval_notes).toEqual(
      expect.arrayContaining(["mock_retrieval:source_type_filter=legislation"])
    );
  });

  it("excludes all chunks when filter matches nothing in corpus", async () => {
    const port = new MockRetrieval({ corpus: SAMPLE_UK_EMPLOYMENT_CORPUS });
    const r = await port.search({
      legal_pack: "uk_employment_england_wales",
      query_text: "dismissal",
      source_types: ["hmcts"],
      limit: 10,
    });
    expect(r.chunks).toEqual([]);
  });
});

describe("MockRetrieval — jurisdiction filtering", () => {
  it("excludes a chunk whose jurisdiction differs from the query", async () => {
    const corpus = [
      ...SAMPLE_UK_EMPLOYMENT_CORPUS,
      {
        ...SAMPLE_UK_EMPLOYMENT_CORPUS[0]!,
        chunk_id: "se-only",
        jurisdiction: "Sverige",
      },
    ];
    const port = new MockRetrieval({ corpus });
    const r = await port.search({
      legal_pack: "uk_employment_england_wales",
      query_text: "dismissal",
      jurisdiction: "England and Wales",
      limit: 10,
    });
    expect(r.chunks.map((c) => c.chunk_id)).not.toContain("se-only");
  });
});

describe("MockRetrieval — limit respected", () => {
  it("returns at most `limit` chunks", async () => {
    const port = new MockRetrieval({ corpus: SAMPLE_UK_EMPLOYMENT_CORPUS });
    const r = await port.search({
      legal_pack: "uk_employment_england_wales",
      query_text: "dismissal",
      limit: 2,
    });
    expect(r.chunks.length).toBeLessThanOrEqual(2);
  });

  it("emits a 'truncated_to' note when results are clipped", async () => {
    const port = new MockRetrieval({ corpus: SAMPLE_UK_EMPLOYMENT_CORPUS });
    const r = await port.search({
      legal_pack: "uk_employment_england_wales",
      query_text: "dismissal",
      limit: 1,
    });
    if (r.chunks.length === 1) {
      expect(r.retrieval_notes).toEqual(
        expect.arrayContaining([expect.stringContaining("truncated_to")])
      );
    }
  });
});

describe("PostgresRetrieval — mock-safe path", () => {
  it("returns [] + db_url_missing note when DATABASE_URL is unset", async () => {
    const port = new PostgresRetrieval();
    expect(port.isLive()).toBe(false);
    const r = await port.search({
      legal_pack: "uk_employment_england_wales",
      query_text: "anything",
      limit: 10,
    });
    expect(r.chunks).toEqual([]);
    expect(r.retrieval_notes).toContain("postgres_retrieval:db_url_missing");
  });

  it("returns [] in < 50ms in mock-safe mode (no I/O)", async () => {
    const port = new PostgresRetrieval();
    const t0 = Date.now();
    await port.search({
      legal_pack: "uk_employment_england_wales",
      query_text: "anything",
      limit: 10,
    });
    expect(Date.now() - t0).toBeLessThan(50);
  });

  it("sanitises errors: thrown message must not contain DATABASE_URL or stack", async () => {
    const sentinel = "postgres://SECRET_user:SECRET_pw@127.0.0.1:1/SECRET_db";
    const port = new PostgresRetrieval({ databaseUrl: sentinel });
    const r = await port.search({
      legal_pack: "uk_employment_england_wales",
      query_text: "x",
      limit: 5,
    });
    // Either pg is unavailable -> note; or query fails -> note. Never throws.
    expect(r.chunks).toEqual([]);
    const all = (r.retrieval_notes ?? []).join(" ");
    expect(all).not.toContain("SECRET_pw");
    expect(all).not.toContain("SECRET_user");
    expect(all).not.toContain("postgres://");
    expect(all).not.toMatch(/node_modules/);
  });
});

describe("mapRowToRetrievedLegalChunk — pure mapper", () => {
  it("maps a well-formed row", () => {
    const row = {
      chunk_id: "c1",
      document_id: "d1",
      source_type: "legislation",
      chunk_index: 0,
      chunk_text: "An employee is dismissed when ...",
      token_count: 24,
      section_reference: "95(1)",
      authority_level: 100,
      title: "ERA 1996 Section 95",
      url: "https://www.legislation.gov.uk/...",
      citation_label: "ERA 1996 s.95(1)",
    };
    const out = mapRowToRetrievedLegalChunk(row);
    expect(out.chunk_id).toBe("c1");
    expect(out.source_type).toBe("legislation");
    expect(out.section_reference).toBe("95(1)");
    expect(out.authority_level).toBe(100);
    expect(out.url).toBe(row.url);
    expect(out.citation_label).toBe(row.citation_label);
  });

  it("coerces unknown source_type to internal_template", () => {
    const out = mapRowToRetrievedLegalChunk({ chunk_id: "x", source_type: "lol" });
    expect(out.source_type).toBe("internal_template");
  });

  it("maps adjacent source_types to canonical CorpusSourceType variants", () => {
    expect(mapRowToRetrievedLegalChunk({ chunk_id: "x", source_type: "appeal_case" }).source_type).toBe("tribunal_case");
    expect(mapRowToRetrievedLegalChunk({ chunk_id: "x", source_type: "case_law" }).source_type).toBe("tribunal_case");
    expect(mapRowToRetrievedLegalChunk({ chunk_id: "x", source_type: "statutory_instrument" }).source_type).toBe("legislation");
  });
});

describe("createRagService — strategy selection", () => {
  it("returns empty_mock when no DATABASE_URL is set", () => {
    const svc = createRagService();
    expect(svc.describe().strategy).toBe("empty_mock");
    expect(svc.describe().live).toBe(false);
  });

  it("returns postgres when databaseUrl is provided explicitly", () => {
    const svc = createRagService({ databaseUrl: "postgres://x:y@z:1/db" });
    expect(svc.describe().strategy).toBe("postgres");
  });

  it("returns explicit_port when a port is passed", () => {
    const svc = createRagService({
      port: { async search() { return { chunks: [], retrieval_notes: [] }; } },
    });
    expect(svc.describe().strategy).toBe("explicit_port");
  });

  it("emits empty_mock_default note when nothing is wired", async () => {
    const svc = createRagService();
    const r = await svc.search({
      legal_pack: "uk_employment_england_wales",
      query_text: "x",
      limit: 10,
    });
    expect(r.retrieval_notes).toContain("rag_service:empty_mock_default");
  });
});
