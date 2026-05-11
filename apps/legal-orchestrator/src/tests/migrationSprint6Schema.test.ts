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

describe("Sprint 6 SQL migrations (static validation)", () => {
  const up = readMigration("002_legal_rag_sprint6.sql");
  const down = readMigration("002_legal_rag_sprint6.down.sql");

  it("forward file defines required tables", () => {
    for (const t of [
      "CREATE TABLE IF NOT EXISTS ingestion_jobs",
      "CREATE TABLE IF NOT EXISTS ingestion_job_events",
      "CREATE TABLE IF NOT EXISTS source_fetch_audit",
      "CREATE TABLE IF NOT EXISTS legal_document_versions",
      "CREATE TABLE IF NOT EXISTS legal_chunk_embeddings",
      "CREATE TABLE IF NOT EXISTS citation_registry",
    ]) {
      expect(up).toContain(t);
    }
  });

  it("forward file extends rag_query_audit and legal_sources CHECK", () => {
    expect(up).toContain("ALTER TABLE rag_query_audit");
    expect(up).toContain("final_citation_ids");
    expect(up).toContain("ranking_scores");
    expect(up).toContain("retrieved_chunk_ids");
    expect(up).toContain("legal_sources_source_type_chk");
    expect(up).toContain("legislation_gov_uk");
    expect(up).toContain("hmcts");
    expect(up).toContain("ehrc");
    expect(up).toContain("cac");
  });

  it("forward file includes UUID PKs and audit columns", () => {
    expect(up).toMatch(/uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/i);
    expect(up).toContain("http_status");
    expect(up).toContain("response_checksum");
    expect(up).toContain("embedding_bytea");
  });

  it("forward file guards pgvector column add", () => {
    expect(up).toContain("pg_extension");
    expect(up).toContain("extname = 'vector'");
    expect(up).toContain("ADD COLUMN embedding vector(1536)");
  });

  it("down file drops Sprint 6 tables and restores source_type CHECK", () => {
    expect(down).toContain("DROP TABLE IF EXISTS citation_registry");
    expect(down).toContain("DROP TABLE IF EXISTS legal_chunk_embeddings");
    expect(down).toContain("DROP TABLE IF EXISTS legal_document_versions");
    expect(down).toContain("DROP TABLE IF EXISTS source_fetch_audit");
    expect(down).toContain("DROP TABLE IF EXISTS ingestion_job_events");
    expect(down).toContain("DROP TABLE IF EXISTS ingestion_jobs");
    expect(down).toContain("legal_sources_source_type_chk");
  });
});
