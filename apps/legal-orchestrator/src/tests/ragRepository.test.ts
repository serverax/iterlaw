// ragRepository — unit tests. No live PostgreSQL connection.

import { describe, it, expect, beforeEach } from "vitest";
import {
  insertLegalChunks,
  insertLegalCitations,
  markDocumentSuperseded,
  queryChunks,
  RagRepositoryValidationError,
  upsertLegalDocument,
  upsertLegalSource,
  type DbClient,
  type DbQueryResult,
} from "../rag/ragRepository";

interface RecordedCall {
  sql: string;
  params: unknown[];
}

class MockClient implements DbClient {
  public readonly calls: RecordedCall[] = [];
  public nextReturn: DbQueryResult<unknown> = { rows: [], rowCount: 0 };
  public queueReturns: DbQueryResult<unknown>[] = [];

  setReturn(r: DbQueryResult<unknown>): void {
    this.nextReturn = r;
  }

  queueReturn(r: DbQueryResult<unknown>): void {
    this.queueReturns.push(r);
  }

  async query<TRow = unknown>(sql: string, params: unknown[] = []): Promise<DbQueryResult<TRow>> {
    this.calls.push({ sql, params });
    const next = this.queueReturns.shift() ?? this.nextReturn;
    return next as DbQueryResult<TRow>;
  }
}

const DOMAIN_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";
const CHUNK_ID = "44444444-4444-4444-8444-444444444444";

let mock: MockClient;
beforeEach(() => {
  mock = new MockClient();
});

// ---------------------------------------------------------------------
// upsertLegalSource
// ---------------------------------------------------------------------

describe("upsertLegalSource — input validation", () => {
  it("rejects an invalid UUID for domain_id", async () => {
    await expect(
      upsertLegalSource(mock, {
        domain_id: "not-a-uuid",
        source_type: "legislation",
        title: "ERA 1996",
        jurisdiction: "England and Wales",
        canonical_url: "https://www.legislation.gov.uk/ukpga/1996/18",
      })
    ).rejects.toBeInstanceOf(RagRepositoryValidationError);
  });

  it("rejects an unknown source_type", async () => {
    await expect(
      upsertLegalSource(mock, {
        domain_id: DOMAIN_ID,
        source_type: "wikipedia" as unknown as "legislation",
        title: "x",
        jurisdiction: "England and Wales",
        canonical_url: "https://example.com/",
      })
    ).rejects.toThrow(/source_type/);
    expect(mock.calls.length).toBe(0);
  });

  it("rejects a non-ISO effective_date", async () => {
    await expect(
      upsertLegalSource(mock, {
        domain_id: DOMAIN_ID,
        source_type: "legislation",
        title: "x",
        jurisdiction: "England and Wales",
        canonical_url: "https://example.com/",
        effective_date: "April 2024",
      })
    ).rejects.toThrow(/ISO YYYY-MM-DD/);
  });

  it("upserts via parameterized SQL and returns the row id", async () => {
    mock.setReturn({ rows: [{ id: SOURCE_ID }], rowCount: 1 });
    const r = await upsertLegalSource(mock, {
      domain_id: DOMAIN_ID,
      source_type: "legislation",
      title: "Employment Rights Act 1996",
      citation_label: "ERA 1996",
      jurisdiction: "England and Wales",
      canonical_url: "https://www.legislation.gov.uk/ukpga/1996/18",
    });
    expect(r.id).toBe(SOURCE_ID);
    expect(mock.calls.length).toBe(1);
    const [call] = mock.calls;
    expect(call!.sql).toMatch(/INSERT INTO legal_sources/);
    expect(call!.sql).toMatch(/ON CONFLICT.*DO UPDATE/i);
    expect(call!.sql).toMatch(/\$1.*\$11/s);
    // All caller-supplied values appear ONLY as bound params, never inlined.
    expect(call!.sql).not.toMatch(/Employment Rights Act 1996/);
    expect(call!.sql).not.toMatch(/legislation\.gov\.uk/);
    expect(call!.params).toContain("Employment Rights Act 1996");
    expect(call!.params).toContain("https://www.legislation.gov.uk/ukpga/1996/18");
  });

  it("defaults authority_level from source_type if not provided", async () => {
    mock.setReturn({ rows: [{ id: SOURCE_ID }], rowCount: 1 });
    await upsertLegalSource(mock, {
      domain_id: DOMAIN_ID,
      source_type: "legislation",
      title: "x",
      jurisdiction: "uk",
      canonical_url: "https://example.com/",
    });
    // legislation → 100 per repository's default map.
    expect(mock.calls[0]!.params).toContain(100);
  });
});

// ---------------------------------------------------------------------
// upsertLegalDocument — duplicate upsert + supersede semantics.
// ---------------------------------------------------------------------

describe("upsertLegalDocument", () => {
  it("uses ON CONFLICT DO UPDATE so duplicate (source_id, official_reference, version_date) is idempotent", async () => {
    mock.setReturn({ rows: [{ id: DOCUMENT_ID }], rowCount: 1 });
    await upsertLegalDocument(mock, {
      source_id: SOURCE_ID,
      domain_id: DOMAIN_ID,
      title: "ERA 1996 s.95",
      official_reference: "ERA 1996 s.95",
      version_date: "1996-08-22",
    });
    await upsertLegalDocument(mock, {
      source_id: SOURCE_ID,
      domain_id: DOMAIN_ID,
      title: "ERA 1996 s.95",
      official_reference: "ERA 1996 s.95",
      version_date: "1996-08-22",
      clean_text: "updated body",
    });
    expect(mock.calls.length).toBe(2);
    for (const call of mock.calls) {
      expect(call.sql).toMatch(/ON CONFLICT \(source_id, official_reference, version_date\) DO UPDATE/i);
      expect(call.sql).toMatch(/INSERT INTO legal_documents/);
      expect(call.sql).not.toMatch(/DELETE/);
    }
  });

  it("rejects an invalid version_date", async () => {
    await expect(
      upsertLegalDocument(mock, {
        source_id: SOURCE_ID,
        domain_id: DOMAIN_ID,
        title: "x",
        version_date: "1996",
      })
    ).rejects.toThrow(/ISO YYYY-MM-DD/);
  });
});

// ---------------------------------------------------------------------
// insertLegalChunks
// ---------------------------------------------------------------------

describe("insertLegalChunks", () => {
  it("is a no-op when given an empty list", async () => {
    const r = await insertLegalChunks(mock, []);
    expect(r.inserted).toBe(0);
    expect(mock.calls.length).toBe(0);
  });

  it("rejects a chunk with a missing chunk_text", async () => {
    await expect(
      insertLegalChunks(mock, [
        {
          document_id: DOCUMENT_ID,
          domain_id: DOMAIN_ID,
          jurisdiction: "uk",
          source_type: "legislation",
          title: "x",
          chunk_index: 0,
          chunk_text: "",
        },
      ])
    ).rejects.toThrow(/chunk_text/);
  });

  it("rejects authority_level outside [0,100]", async () => {
    await expect(
      insertLegalChunks(mock, [
        {
          document_id: DOCUMENT_ID,
          domain_id: DOMAIN_ID,
          jurisdiction: "uk",
          source_type: "legislation",
          title: "t",
          chunk_index: 0,
          chunk_text: "body",
          authority_level: 250,
        },
      ])
    ).rejects.toThrow(/authority_level/);
  });

  it("issues one parameterized INSERT per chunk with ON CONFLICT update", async () => {
    mock.queueReturn({ rows: [], rowCount: 1 });
    mock.queueReturn({ rows: [], rowCount: 1 });
    const r = await insertLegalChunks(mock, [
      {
        document_id: DOCUMENT_ID,
        domain_id: DOMAIN_ID,
        jurisdiction: "England and Wales",
        source_type: "legislation",
        title: "ERA 1996",
        chunk_index: 0,
        chunk_text: "An employee is dismissed when …",
        applicable_to: "2026-03-31",
        effective_date: "1996-08-22",
      },
      {
        document_id: DOCUMENT_ID,
        domain_id: DOMAIN_ID,
        jurisdiction: "England and Wales",
        source_type: "legislation",
        title: "ERA 1996",
        chunk_index: 1,
        chunk_text: "It is for the employer to show …",
      },
    ]);
    expect(r.inserted).toBe(2);
    expect(mock.calls.length).toBe(2);
    for (const call of mock.calls) {
      expect(call.sql).toMatch(/INSERT INTO legal_chunks/);
      expect(call.sql).toMatch(/ON CONFLICT \(document_id, chunk_index\) DO UPDATE/);
      // No string-interpolated values.
      expect(call.sql).not.toMatch(/An employee is dismissed/);
    }
    // Applicable_to passed through as a bound param.
    expect(mock.calls[0]!.params).toContain("2026-03-31");
    // Second chunk had no applicable_to — null bound.
    expect(mock.calls[1]!.params).toContain(null);
  });
});

// ---------------------------------------------------------------------
// insertLegalCitations
// ---------------------------------------------------------------------

describe("insertLegalCitations", () => {
  it("stores citation metadata via bound params", async () => {
    mock.queueReturn({ rows: [], rowCount: 1 });
    const r = await insertLegalCitations(mock, [
      { chunk_id: CHUNK_ID, citation_label: "ERA 1996 s.95", context_snippet: "An employee is dismissed when…" },
    ]);
    expect(r.inserted).toBe(1);
    const [call] = mock.calls;
    expect(call!.sql).toMatch(/INSERT INTO legal_citations/);
    expect(call!.params).toEqual([CHUNK_ID, "ERA 1996 s.95", "An employee is dismissed when…"]);
  });

  it("rejects an invalid chunk_id", async () => {
    await expect(
      insertLegalCitations(mock, [
        { chunk_id: "not-a-uuid", citation_label: "x" },
      ])
    ).rejects.toThrow(/chunk_id/);
  });
});

// ---------------------------------------------------------------------
// markDocumentSuperseded — never DELETE.
// ---------------------------------------------------------------------

describe("markDocumentSuperseded", () => {
  it("issues an UPDATE (is_active=false), never a DELETE", async () => {
    mock.setReturn({ rows: [], rowCount: 1 });
    const r = await markDocumentSuperseded(mock, DOCUMENT_ID);
    expect(r.updated).toBe(1);
    const [call] = mock.calls;
    expect(call!.sql).toMatch(/UPDATE legal_documents/);
    expect(call!.sql).toMatch(/SET is_active = false/);
    expect(call!.sql).not.toMatch(/\bDELETE\b/i);
    expect(call!.params).toEqual([DOCUMENT_ID]);
  });

  it("rejects a non-UUID id", async () => {
    await expect(markDocumentSuperseded(mock, "not-a-uuid")).rejects.toThrow(/UUID/);
    expect(mock.calls.length).toBe(0);
  });
});

// ---------------------------------------------------------------------
// queryChunks — temporal filter, parameterization, no SQL injection.
// ---------------------------------------------------------------------

describe("queryChunks", () => {
  it("issues a single SELECT with all filters as bound parameters", async () => {
    mock.setReturn({ rows: [], rowCount: 0 });
    await queryChunks(mock, {
      domain_code: "uk_employment_england_wales",
      source_type: "legislation",
      jurisdiction: "England and Wales",
      topic_query: "unfair dismissal",
      applicable_on: "2024-06-01",
      min_authority_level: 50,
      min_quality_score: 0.5,
      limit: 10,
    });
    expect(mock.calls.length).toBe(1);
    const [call] = mock.calls;
    expect(call!.sql).toMatch(/SELECT/);
    expect(call!.sql).toMatch(/FROM legal_chunks c/);
    expect(call!.sql).toMatch(/JOIN legal_domains d/);
    expect(call!.sql).toMatch(/c\.is_active = true/);
    // Temporal predicates exactly mirror postgresRetrieval.ts.
    expect(call!.sql).toMatch(
      /\$5::date IS NULL OR c\.effective_date IS NULL OR c\.effective_date <= \$5::date/
    );
    expect(call!.sql).toMatch(
      /\$5::date IS NULL OR c\.applicable_to\s+IS NULL OR c\.applicable_to\s+>= \$5::date/
    );
    expect(call!.params).toEqual([
      "uk_employment_england_wales",
      "legislation",
      "England and Wales",
      "unfair dismissal",
      "2024-06-01",
      50,
      0.5,
      10,
    ]);
  });

  it("missing effective date returns safe fallback (null bound to $5)", async () => {
    mock.setReturn({ rows: [], rowCount: 0 });
    await queryChunks(mock, { domain_code: "uk_employment_england_wales" });
    const [call] = mock.calls;
    expect(call!.params[4]).toBeNull();
    // The same SQL is used; the NULL short-circuits the temporal AND.
    expect(call!.sql).toMatch(/\$5::date IS NULL OR/);
  });

  it("rejects a malformed applicable_on", async () => {
    await expect(
      queryChunks(mock, { applicable_on: "yesterday" })
    ).rejects.toThrow(/applicable_on/);
  });

  it("rejects an out-of-range limit", async () => {
    await expect(queryChunks(mock, { limit: 0 })).rejects.toThrow(/limit/);
    await expect(queryChunks(mock, { limit: 1000 })).rejects.toThrow(/limit/);
    expect(mock.calls.length).toBe(0);
  });

  it("rejects a malicious topic_query without ever building SQL that contains it", async () => {
    mock.setReturn({ rows: [], rowCount: 0 });
    const evil = "x'); DROP TABLE legal_chunks; --";
    await queryChunks(mock, { topic_query: evil });
    const [call] = mock.calls;
    // The exact attacker string must NEVER appear in the SQL — it must
    // only live in the params array as $4.
    expect(call!.sql).not.toContain("DROP TABLE");
    expect(call!.sql).not.toContain(evil);
    expect(call!.params).toContain(evil);
  });
});

// ---------------------------------------------------------------------
// SQL-injection guard — sweep every public function.
// ---------------------------------------------------------------------

describe("SQL injection guard (every entrypoint)", () => {
  const EVIL = "'; DROP TABLE legal_chunks; --";

  it("upsertLegalSource never interpolates evil strings into SQL", async () => {
    mock.setReturn({ rows: [{ id: SOURCE_ID }], rowCount: 1 });
    await upsertLegalSource(mock, {
      domain_id: DOMAIN_ID,
      source_type: "legislation",
      title: EVIL,
      jurisdiction: EVIL,
      canonical_url: EVIL,
    });
    const sql = mock.calls[0]!.sql;
    expect(sql).not.toContain("DROP TABLE");
    expect(mock.calls[0]!.params).toContain(EVIL);
  });

  it("insertLegalCitations never interpolates evil context_snippet", async () => {
    mock.queueReturn({ rows: [], rowCount: 1 });
    await insertLegalCitations(mock, [
      { chunk_id: CHUNK_ID, citation_label: EVIL, context_snippet: EVIL },
    ]);
    expect(mock.calls[0]!.sql).not.toContain("DROP TABLE");
    expect(mock.calls[0]!.params).toContain(EVIL);
  });
});
