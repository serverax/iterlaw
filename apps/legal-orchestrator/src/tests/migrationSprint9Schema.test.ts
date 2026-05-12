import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "../../db/migrations");

function readMigration(name: string): string {
  const p = join(migrationsDir, name);
  expect(existsSync(p), `missing ${p}`).toBe(true);
  return readFileSync(p, "utf8");
}

describe("Sprint 9 SQL migrations (static validation)", () => {
  const up = readMigration("003_legal_rag_sprint9_uk_employment_core.sql");
  const down = readMigration("003_legal_rag_sprint9_uk_employment_core.down.sql");

  it("forward file defines required tables under uk_emp_rag schema", () => {
    for (const t of [
      "CREATE TABLE IF NOT EXISTS uk_emp_rag.legal_sources",
      "CREATE TABLE IF NOT EXISTS uk_emp_rag.legal_documents",
      "CREATE TABLE IF NOT EXISTS uk_emp_rag.legal_document_chunks",
      "CREATE TABLE IF NOT EXISTS uk_emp_rag.legal_chunk_embeddings",
      "CREATE TABLE IF NOT EXISTS uk_emp_rag.legal_citations",
      "CREATE TABLE IF NOT EXISTS uk_emp_rag.legal_ingestion_runs",
      "CREATE TABLE IF NOT EXISTS uk_emp_rag.legal_answer_evidence",
    ]) {
      expect(up).toContain(t);
    }
  });

  it("legal_documents requires source_id, title, canonical_url, document_type, content_hash", () => {
    expect(up).toMatch(/source_id\s+uuid\s+NOT\s+NULL/i);
    expect(up).toMatch(/title\s+text\s+NOT\s+NULL/i);
    expect(up).toMatch(/canonical_url\s+text\s+NOT\s+NULL/i);
    expect(up).toMatch(/document_type\s+text\s+NOT\s+NULL/i);
    expect(up).toMatch(/content_hash\s+text\s+NOT\s+NULL/i);
  });

  it("legal_document_chunks cascade delete when parent document is deleted", () => {
    expect(up).toContain(
      "REFERENCES uk_emp_rag.legal_documents(id) ON DELETE CASCADE"
    );
  });

  it("unique (document_id, chunk_index) on legal_document_chunks", () => {
    expect(up).toContain("UNIQUE (document_id, chunk_index)");
  });

  it("unique (canonical_url, content_hash) on legal_documents", () => {
    expect(up).toContain("UNIQUE (canonical_url, content_hash)");
  });

  it("legal_answer_evidence links request_id to chunks and documents", () => {
    expect(up).toMatch(/request_id\s+text\s+NOT\s+NULL/i);
    expect(up).toContain("REFERENCES uk_emp_rag.legal_document_chunks(id)");
    expect(up).toContain("REFERENCES uk_emp_rag.legal_documents(id)");
    expect(up).toContain("uk_emp_rag_legal_answer_evidence_request_idx");
    expect(up).toContain("uk_emp_rag_legal_answer_evidence_chunk_idx");
    expect(up).toContain("uk_emp_rag_legal_answer_evidence_document_idx");
  });

  it("full-text index on chunk_text", () => {
    expect(up).toContain("uk_emp_rag_legal_document_chunks_chunk_text_fts_idx");
    expect(up).toContain("to_tsvector('english'");
    expect(up).toContain("chunk_text");
  });

  it("embeddings: jsonb fallback + guarded pgvector column", () => {
    expect(up).toContain("embedding_jsonb");
    expect(up).toContain("pg_extension");
    expect(up).toContain("extname = 'vector'");
    expect(up).toContain("embedding_vector vector(1536)");
  });

  it("legal_citations chunk_id uses ON DELETE SET NULL", () => {
    expect(up).toContain(
      "REFERENCES uk_emp_rag.legal_document_chunks(id) ON DELETE SET NULL"
    );
  });

  it("down file drops Sprint 9 schema", () => {
    expect(down).toContain("DROP SCHEMA IF EXISTS uk_emp_rag CASCADE");
    expect(down).toContain("DROP FUNCTION IF EXISTS uk_emp_rag_set_updated_at()");
  });

  it("migration contains no obvious secrets or credential URLs", () => {
    const banned = [
      /sk-(?:[A-Za-z0-9]{48,}|(?:proj|ant|svcacct)-[A-Za-z0-9_-]{20,})/,
      /github_pat_/i,
      /AKIA[0-9A-Z]{16}/,
      /BEGIN PRIVATE KEY/,
      /postgres(ql)?:\/\/[^:]+:[^@]+@/i,
      /DATABASE_URL\s*=/,
    ];
    for (const re of banned) {
      expect(up).not.toMatch(re);
    }
  });
});
