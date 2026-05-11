import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PgRagPort, mapRowToChunk } from "../ports/pgRagPort";

describe("PgRagPort — mock-safe path", () => {
  const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (ORIGINAL_DATABASE_URL === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
    }
  });

  it("returns [] when DATABASE_URL is missing (no env, no config)", async () => {
    const port = new PgRagPort();
    const out = await port.search({
      legal_pack: "uk_employment_england_wales",
      query: "unfair dismissal",
      topic: "unfair_dismissal",
      jurisdiction: "England and Wales",
      limit: 10,
    });
    expect(out).toEqual([]);
  });

  it("returns [] when explicit config has no databaseUrl", async () => {
    const port = new PgRagPort({ databaseUrl: undefined });
    const out = await port.search({
      legal_pack: "uk_employment_england_wales",
      query: "x",
      topic: "unknown",
      jurisdiction: "England and Wales",
      limit: 10,
    });
    expect(out).toEqual([]);
  });

  it("returns [] when databaseUrl is empty string", async () => {
    const port = new PgRagPort({ databaseUrl: "" });
    expect(port.isLive()).toBe(false);
    const out = await port.search({
      legal_pack: "x",
      query: "x",
      topic: "unknown",
      jurisdiction: "England and Wales",
      limit: 10,
    });
    expect(out).toEqual([]);
  });

  it("does NOT attempt to load 'pg' or open any socket in mock mode", async () => {
    // If the port were to require('pg') in mock mode and pg were missing,
    // the older skeleton would have thrown. We assert the call resolves
    // with [] within a tight time budget — this is a proxy for "no I/O".
    const port = new PgRagPort();
    const t0 = Date.now();
    const out = await port.search({
      legal_pack: "x",
      query: "x",
      topic: "unknown",
      jurisdiction: "England and Wales",
      limit: 10,
    });
    expect(out).toEqual([]);
    // Any real connect would take >5ms even on localhost. 50ms is a
    // generous ceiling for in-process resolve.
    expect(Date.now() - t0).toBeLessThan(50);
  });

  it("isLive() reflects databaseUrl presence", () => {
    expect(new PgRagPort({ databaseUrl: "postgres://x" }).isLive()).toBe(true);
    expect(new PgRagPort({ databaseUrl: "" }).isLive()).toBe(false);
    expect(new PgRagPort().isLive()).toBe(false);
  });
});

describe("PgRagPort — error sanitisation", () => {
  // Construct a port with a databaseUrl that points nowhere. If pg IS
  // installed locally (it's not in legal-orchestrator's deps), it would
  // fail to connect. We assert: the error message does NOT contain the
  // connection string and does NOT contain a node_modules path.
  // If pg is NOT installed, the port returns [] and this test is a no-op
  // for the leak assertion; we still check the empty-result contract.
  it("never includes the connection string or a stack trace in thrown errors", async () => {
    const sentinel = "postgres://SECRET_user:SECRET_pw@127.0.0.1:1/SECRET_db";
    const port = new PgRagPort({ databaseUrl: sentinel });
    try {
      const out = await port.search({
        legal_pack: "x",
        query: "anything",
        topic: "unknown",
        jurisdiction: "England and Wales",
        limit: 10,
      });
      // If pg isn't installed, we got [] — that's fine, nothing to leak.
      expect(out).toEqual([]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).not.toContain("SECRET_user");
      expect(msg).not.toContain("SECRET_pw");
      expect(msg).not.toContain("SECRET_db");
      expect(msg).not.toContain("postgres://");
      expect(msg).not.toMatch(/node_modules/);
      // Whatever we throw should be a stable identifier.
      expect(msg).toBe("pg_rag_query_failed");
    }
  });
});

describe("mapRowToChunk — pure mapper", () => {
  it("maps a well-formed row into a citation-ready RagChunk", () => {
    const row = {
      chunk_id: "11111111-1111-1111-1111-111111111111",
      document_id: "22222222-2222-2222-2222-222222222222",
      source_type: "legislation",
      authority_level: 100,
      title: "Employment Rights Act 1996",
      url: "https://www.legislation.gov.uk/ukpga/1996/18",
      section_reference: "95",
      paragraph_reference: "(1)(a)",
      chunk_text: "Circumstances in which an employee is dismissed.",
      score: 0.87,
    };
    const out = mapRowToChunk(row);
    expect(out.chunk_id).toBe(row.chunk_id);
    expect(out.document_id).toBe(row.document_id);
    expect(out.source_type).toBe("legislation");
    expect(out.authority_level).toBe(100);
    expect(out.title).toBe(row.title);
    expect(out.url).toBe(row.url);
    expect(out.section_reference).toBe("95");
    expect(out.paragraph_reference).toBe("(1)(a)");
    expect(out.chunk_text).toBe(row.chunk_text);
    expect(out.score).toBeCloseTo(0.87, 3);
  });

  it("handles null / missing fields without throwing", () => {
    const row = {
      chunk_id: "c1",
      document_id: "d1",
      source_type: null,
      authority_level: null,
      title: null,
      url: null,
      section_reference: null,
      paragraph_reference: null,
      chunk_text: null,
      score: null,
    };
    const out = mapRowToChunk(row);
    expect(out.chunk_id).toBe("c1");
    expect(out.document_id).toBe("d1");
    expect(out.source_type).toBe("internal_note"); // safe default
    expect(out.authority_level).toBe(50); // safe default
    expect(out.title).toBe("");
    expect(out.url).toBe("");
    expect(out.section_reference).toBeUndefined();
    expect(out.paragraph_reference).toBeUndefined();
    expect(out.chunk_text).toBe("");
    expect(out.score).toBe(0);
  });

  it("coerces stringified numbers safely", () => {
    const row = {
      chunk_id: "c1",
      document_id: "d1",
      source_type: "acas_guidance",
      authority_level: "60",
      title: "ACAS",
      url: "https://www.acas.org.uk/",
      chunk_text: "Some content.",
      score: "0.42",
    };
    const out = mapRowToChunk(row);
    expect(out.authority_level).toBe(60);
    expect(out.score).toBeCloseTo(0.42, 3);
  });

  it("does not throw on completely empty input", () => {
    const out = mapRowToChunk({});
    expect(out.chunk_id).toBe("");
    expect(out.source_type).toBe("internal_note");
    expect(out.authority_level).toBe(50);
  });

  it("does not throw on null input", () => {
    const out = mapRowToChunk(null);
    expect(out.chunk_id).toBe("");
    expect(out.authority_level).toBe(50);
  });
});
