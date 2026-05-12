import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mapRowToRetrievedLegalChunk } from "../rag/postgresRetrieval";

const __dirname = dirname(fileURLToPath(import.meta.url));
const postgresRetrievalPath = join(__dirname, "../rag/postgresRetrieval.ts");

function readPostgresRetrievalSource(): string {
  expect(existsSync(postgresRetrievalPath)).toBe(true);
  return readFileSync(postgresRetrievalPath, "utf8");
}

describe("PostgresRetrieval — temporal SQL (applicable_to)", () => {
  it("FTS and ILIKE queries select c.applicable_to", () => {
    const src = readPostgresRetrievalSource();
    const ftsSelect = src.includes("c.applicable_to     AS applicable_to");
    expect(ftsSelect).toBe(true);
    const count = (src.match(/c\.applicable_to\s+AS applicable_to/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("includes applicable_to filter matching mock temporal rule", () => {
    const src = readPostgresRetrievalSource();
    expect(src).toMatch(
      /\$6::date IS NULL\s+OR c\.applicable_to IS NULL\s+OR c\.applicable_to >= \$6::date/s
    );
    expect(src).toContain(
      "$6::date IS NULL OR c.effective_date IS NULL OR c.effective_date <= $6::date"
    );
  });

  it("when applicable_on is absent, temporal predicates short-circuit via $6 NULL", () => {
    const src = readPostgresRetrievalSource();
    expect(src).toContain("input.filters?.applicable_on ?? null");
  });
});

describe("mapRowToRetrievedLegalChunk — applicable_to from Postgres row", () => {
  it("maps applicable_to ISO string from SQL date string", () => {
    const out = mapRowToRetrievedLegalChunk({
      chunk_id: "c1",
      document_id: "d1",
      source_type: "legislation",
      chunk_index: 0,
      chunk_text: "x",
      authority_level: 50,
      applicable_to: "2026-03-31",
    });
    expect(out.applicable_to).toBe("2026-03-31");
  });

  it("maps applicable_to from JavaScript Date", () => {
    const out = mapRowToRetrievedLegalChunk({
      chunk_id: "c1",
      document_id: "d1",
      source_type: "legislation",
      chunk_index: 0,
      chunk_text: "x",
      authority_level: 50,
      applicable_to: new Date("2026-03-31T00:00:00.000Z"),
    });
    expect(out.applicable_to).toBe("2026-03-31");
  });

  it("NULL applicable_to yields undefined on LegalChunk", () => {
    const out = mapRowToRetrievedLegalChunk({
      chunk_id: "c1",
      document_id: "d1",
      source_type: "legislation",
      chunk_index: 0,
      chunk_text: "x",
      authority_level: 50,
      applicable_to: null,
    });
    expect(out.applicable_to).toBeUndefined();
  });
});

describe("005 legal_chunks.applicable_to migration (static)", () => {
  it("defines ADD COLUMN IF NOT EXISTS applicable_to on legal_chunks", () => {
    const p = join(__dirname, "../../db/migrations/005_legal_chunks_applicable_to.sql");
    expect(existsSync(p)).toBe(true);
    const sql = readFileSync(p, "utf8");
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS applicable_to/i);
    expect(sql).toContain("legal_chunks");
  });
});
