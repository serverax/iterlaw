// Sprint 11 — Migration 008: uk_emp_rag.q_a_cache + q_a_cache_sources.
// Static text validation (no DB connection).

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

const FORWARD = "008_qa_cache_with_sources.sql";
const DOWN = "008_qa_cache_with_sources.down.sql";

describe("Migration 008 — q_a_cache + q_a_cache_sources", () => {
  it("forward migration file exists", () => {
    readMigration(FORWARD);
  });

  it("down migration file exists", () => {
    readMigration(DOWN);
  });

  describe("forward migration — q_a_cache table", () => {
    const up = readMigration(FORWARD);

    it("creates q_a_cache in uk_emp_rag schema (idempotent)", () => {
      expect(up).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+uk_emp_rag\.q_a_cache\b/i);
    });

    it("has answer triple columns (law/meaning/action) all NOT NULL", () => {
      expect(up).toMatch(/answer_law_section\s+text\s+NOT\s+NULL/i);
      expect(up).toMatch(/answer_meaning\s+text\s+NOT\s+NULL/i);
      expect(up).toMatch(/answer_action\s+text\s+NOT\s+NULL/i);
    });

    it("stores embedding in jsonb fallback (always present)", () => {
      expect(up).toMatch(/embedding_jsonb\s+jsonb\s+NOT\s+NULL\s+DEFAULT\s+'\[\]'::jsonb/i);
    });

    it("adds embedding_vector + HNSW index conditionally when pgvector is present", () => {
      // Single DO block guards both the column and the index.
      expect(up).toMatch(/pg_extension\s+WHERE\s+extname\s*=\s*'vector'/i);
      expect(up).toContain("embedding_vector vector(1536)");
      expect(up).toContain("USING hnsw");
      expect(up).toContain("vector_cosine_ops");
    });

    it("does NOT use ivfflat for q_a_cache (write-hot cache uses HNSW)", () => {
      // Strip line comments first; the rationale for HNSW vs ivfflat is documented
      // in the migration header. We care that no DDL statement says ivfflat.
      const withoutComments = up.replace(/--[^\n]*/g, "");
      expect(withoutComments).not.toMatch(/ivfflat/i);
    });

    it("has a 3-value status CHECK: draft / approved / withdrawn", () => {
      expect(up).toContain("uk_emp_rag_q_a_cache_status_chk");
      expect(up).toContain("'draft'");
      expect(up).toContain("'approved'");
      expect(up).toContain("'withdrawn'");
    });

    it("has status DEFAULT 'draft'", () => {
      expect(up).toMatch(/status\s+text\s+NOT\s+NULL\s+DEFAULT\s+'draft'/i);
    });

    it("constrains confidence_score to [0, 1]", () => {
      expect(up).toContain("uk_emp_rag_q_a_cache_confidence_chk");
      expect(up).toMatch(/confidence_score\s*>=\s*0/i);
      expect(up).toMatch(/confidence_score\s*<=\s*1/i);
    });

    it("has expires_at as NOT NULL date", () => {
      expect(up).toMatch(/expires_at\s+date\s+NOT\s+NULL/i);
    });

    it("tracks legislation_version, hit_count, last_served_at", () => {
      expect(up).toMatch(/legislation_version\s+text/i);
      expect(up).toMatch(/hit_count\s+integer\s+NOT\s+NULL\s+DEFAULT\s+0/i);
      expect(up).toMatch(/last_served_at\s+timestamptz/i);
    });

    it("has legal_reviewer_id as plain uuid (no FK — soft pointer)", () => {
      // Find the legal_reviewer_id line and ensure no REFERENCES on it.
      const m = up.match(/legal_reviewer_id[^\n,]*/);
      expect(m).not.toBeNull();
      expect(m![0].toLowerCase()).not.toContain("references");
    });

    it("creates partial status_expires index WHERE status='approved'", () => {
      expect(up).toContain("uk_emp_rag_q_a_cache_status_expires_idx");
      expect(up).toMatch(/WHERE\s+status\s*=\s*'approved'/i);
    });

    it("creates jurisdiction+situation_type composite index", () => {
      expect(up).toContain("uk_emp_rag_q_a_cache_jurisdiction_situation_idx");
    });

    it("reuses the existing uk_emp_rag_set_updated_at trigger function", () => {
      expect(up).toMatch(/EXECUTE\s+FUNCTION\s+uk_emp_rag_set_updated_at\s*\(\s*\)/i);
      // Confirm we did NOT invent a new function name.
      expect(up).not.toContain("uk_emp_rag_update_timestamp");
    });
  });

  describe("forward migration — q_a_cache_sources join table", () => {
    const up = readMigration(FORWARD);

    it("creates q_a_cache_sources (idempotent)", () => {
      expect(up).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+uk_emp_rag\.q_a_cache_sources\b/i);
    });

    it("cascades from parent q_a_cache row", () => {
      expect(up).toMatch(/q_a_cache_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+uk_emp_rag\.q_a_cache\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i);
    });

    it("links to legal_document_chunks(id) with ON DELETE SET NULL", () => {
      expect(up).toMatch(/chunk_id\s+uuid\s+REFERENCES\s+uk_emp_rag\.legal_document_chunks\s*\(\s*id\s*\)\s+ON\s+DELETE\s+SET\s+NULL/i);
    });

    it("links to legal_documents(id) with ON DELETE SET NULL", () => {
      expect(up).toMatch(/document_id\s+uuid\s+REFERENCES\s+uk_emp_rag\.legal_documents\s*\(\s*id\s*\)\s+ON\s+DELETE\s+SET\s+NULL/i);
    });

    it("has NO CHECK requiring chunk_id OR document_id (mirrors legal_answer_evidence)", () => {
      // The SET-NULL + CHECK combination would block legitimate cascades.
      const sourcesSection = up.split("CREATE TABLE IF NOT EXISTS uk_emp_rag.q_a_cache_sources")[1] ?? "";
      expect(sourcesSection).not.toContain("q_a_cache_sources_has_source");
      expect(sourcesSection).not.toMatch(/CHECK\s*\([^)]*chunk_id\s+IS\s+NOT\s+NULL[^)]*OR[^)]*document_id\s+IS\s+NOT\s+NULL/i);
    });

    it("records relevance_score + used_in_answer", () => {
      expect(up).toMatch(/relevance_score\s+numeric/i);
      expect(up).toMatch(/used_in_answer\s+boolean\s+NOT\s+NULL\s+DEFAULT\s+false/i);
    });

    it("has the three lookup indexes (cache_id, chunk_id, document_id)", () => {
      expect(up).toContain("uk_emp_rag_q_a_cache_sources_cache_id_idx");
      expect(up).toContain("uk_emp_rag_q_a_cache_sources_chunk_id_idx");
      expect(up).toContain("uk_emp_rag_q_a_cache_sources_document_id_idx");
    });
  });

  describe("forward migration — hygiene", () => {
    const up = readMigration(FORWARD);

    it("has no INSERT statements (DDL only — cache populated by orchestrator)", () => {
      expect(up).not.toMatch(/\bINSERT\s+INTO\b/i);
    });

    it("has no inline BEGIN/COMMIT transaction wrapper", () => {
      // PL/pgSQL BEGIN inside DO $$ ... $$; blocks is allowed; top-level BEGIN;/COMMIT; is not.
      expect(up).not.toMatch(/^\s*BEGIN\s*;/m);
      expect(up).not.toMatch(/^\s*COMMIT\s*;/m);
    });

    it("has no forbidden patterns", () => {
      expect(up).not.toMatch(/\bfetch\s*\(/);
      expect(up).not.toContain("axios");
      expect(up).not.toContain("openai");
      expect(up).not.toContain("anthropic");
      expect(up).not.toMatch(/sk-(?:[A-Za-z0-9]{48,}|(?:proj|ant|svcacct)-[A-Za-z0-9_-]{20,})/);
      expect(up).not.toMatch(/github_pat_/i);
      expect(up).not.toMatch(/AKIA[0-9A-Z]{16}/);
      expect(up).not.toMatch(/BEGIN PRIVATE KEY/);
      expect(up).not.toMatch(/DATABASE_URL\s*=/);
      expect(up).not.toMatch(/:\/\/[^/\s]+:[^/\s]+@/);
    });
  });

  describe("down migration", () => {
    const down = readMigration(DOWN);

    it("drops join table indexes and table first (FK order)", () => {
      expect(down).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+uk_emp_rag\.q_a_cache_sources/i);
      expect(down).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+uk_emp_rag\.q_a_cache\b/i);
    });

    it("drops the trigger", () => {
      expect(down).toMatch(/DROP\s+TRIGGER\s+IF\s+EXISTS\s+uk_emp_rag_q_a_cache_set_updated_at/i);
    });

    it("does NOT drop schema uk_emp_rag", () => {
      const withoutComments = down.replace(/--[^\n]*/g, "");
      expect(withoutComments.toLowerCase()).not.toMatch(/drop\s+schema[^;]*uk_emp_rag/i);
    });
  });
});
