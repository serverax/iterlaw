import { describe, expect, it } from "vitest";

import {
  createPostgresFullTextSearch,
  createPostgresVectorSearch,
  createPostgresRetrievalAdapters,
} from "../retrieval/postgresRetrievalAdapters";
import type {
  RetrievalPort,
  RetrievalPortResult,
  RetrievedLegalChunk,
} from "../rag/retrieval.port";

function makeChunk(overrides: Partial<RetrievedLegalChunk> = {}): RetrievedLegalChunk {
  return {
    chunk_id: "chunk-1",
    document_id: "doc-1",
    source_type: "legislation",
    chunk_index: 0,
    chunk_text: "Sample statutory text.",
    authority_level: 90,
    effective_date: "2020-04-01",
    title: "Employment Rights Act 1996",
    url: "https://www.legislation.gov.uk/ukpga/1996/18/contents",
    citation_label: "ERA 1996 s.94",
    ...overrides,
  };
}

function makePort(
  search: (q: { legal_pack: string; query_text: string; limit: number }) => Promise<RetrievalPortResult> | RetrievalPortResult,
): RetrievalPort {
  return {
    search: async (q) => Promise.resolve(search(q)),
  };
}

describe("createPostgresFullTextSearch", () => {
  it("returns [] when no port is provided (mock-safe)", async () => {
    const fts = createPostgresFullTextSearch(undefined, { legalPack: "uk-employment" });
    const out = await fts("unfair dismissal", { limit: 5 });
    expect(out).toEqual([]);
  });

  it("returns [] when the port returns an empty chunks array", async () => {
    const port = makePort(() => ({ chunks: [] }));
    const fts = createPostgresFullTextSearch(port, { legalPack: "uk-employment" });
    const out = await fts("unfair dismissal", { limit: 5 });
    expect(out).toEqual([]);
  });

  it("maps a legislation chunk to a statutory_source candidate with rank=1", async () => {
    const port = makePort(() => ({ chunks: [makeChunk()] }));
    const fts = createPostgresFullTextSearch(port, { legalPack: "uk-employment" });
    const out = await fts("unfair dismissal", { limit: 5 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      candidate_id: "chunk-1",
      source_id: "doc-1",
      source_type: "statutory_source",
      source_title: "Employment Rights Act 1996",
      source_url: "https://www.legislation.gov.uk/ukpga/1996/18/contents",
      effective_from: "2020-04-01",
      keyword_rank: 1,
      vector_rank: null,
      qa_status: "approved",
    });
    expect(out[0].reason_codes).toContain("postgres_full_text_adapter");
  });

  it("maps multiple chunks with ascending keyword_rank", async () => {
    const port = makePort(() => ({
      chunks: [
        makeChunk({ chunk_id: "c1" }),
        makeChunk({ chunk_id: "c2", source_type: "acas_guidance" }),
        makeChunk({ chunk_id: "c3", source_type: "tribunal_case" }),
      ],
    }));
    const fts = createPostgresFullTextSearch(port, { legalPack: "uk-employment" });
    const out = await fts("redundancy pay", { limit: 5 });
    expect(out.map((c) => c.candidate_id)).toEqual(["c1", "c2", "c3"]);
    expect(out.map((c) => c.keyword_rank)).toEqual([1, 2, 3]);
    expect(out.map((c) => c.source_type)).toEqual([
      "statutory_source",
      "acas_guidance",
      "tribunal_case",
    ]);
  });

  it("respects the tier `limit` and hard-caps via hardLimit", async () => {
    const port = makePort(() => ({
      chunks: Array.from({ length: 10 }, (_v, i) => makeChunk({ chunk_id: `c${i}` })),
    }));
    const fts = createPostgresFullTextSearch(port, { legalPack: "uk-employment", hardLimit: 3 });
    const out = await fts("anything", { limit: 5 });
    expect(out).toHaveLength(3);
  });

  it("swallows port exceptions and returns [] — never leaks error details", async () => {
    const port: RetrievalPort = {
      search: async () => {
        throw new Error("postgres://user:password@host:5432/db cannot connect");
      },
    };
    const fts = createPostgresFullTextSearch(port, { legalPack: "uk-employment" });
    const out = await fts("anything", { limit: 5 });
    expect(out).toEqual([]);
  });

  it("forwards jurisdiction and topic to the port query", async () => {
    let captured: { legal_pack: string; query_text: string; jurisdiction?: string; topic?: string } | undefined;
    const port = makePort((q) => {
      captured = q as typeof captured;
      return { chunks: [] };
    });
    const fts = createPostgresFullTextSearch(port, {
      legalPack: "uk-employment",
      jurisdiction: "UK_ENGLAND_WALES",
      topic: "unfair_dismissal",
    });
    await fts("anything", { limit: 5 });
    expect(captured?.legal_pack).toBe("uk-employment");
    expect(captured?.jurisdiction).toBe("UK_ENGLAND_WALES");
    expect(captured?.topic).toBe("unfair_dismissal");
    expect(captured?.query_text).toBe("anything");
  });
});

describe("createPostgresVectorSearch", () => {
  it("always returns [] in this sprint (FTS-only port)", async () => {
    const port = makePort(() => ({
      chunks: [makeChunk({ chunk_id: "should-not-leak" })],
    }));
    const vec = createPostgresVectorSearch(port, { legalPack: "uk-employment" });
    const out = await vec("anything", { limit: 5 });
    expect(out).toEqual([]);
  });

  it("returns [] even without a port", async () => {
    const vec = createPostgresVectorSearch(undefined, { legalPack: "uk-employment" });
    const out = await vec("anything", { limit: 5 });
    expect(out).toEqual([]);
  });
});

describe("createPostgresRetrievalAdapters", () => {
  it("returns both adapters wired against the same port", async () => {
    const port = makePort(() => ({ chunks: [makeChunk()] }));
    const { fullTextSearch, vectorSearch } = createPostgresRetrievalAdapters(port, {
      legalPack: "uk-employment",
    });
    const ft = await fullTextSearch("any", { limit: 5 });
    const vec = await vectorSearch("any", { limit: 5 });
    expect(ft).toHaveLength(1);
    expect(vec).toEqual([]);
  });
});
