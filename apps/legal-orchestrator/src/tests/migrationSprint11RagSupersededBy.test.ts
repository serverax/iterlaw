// Sprint 11 — Migration 007: superseded_by + status tightening on
// uk_emp_rag.legal_documents. Static text validation (no DB connection).

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

const FORWARD = "007_legal_documents_superseded_by.sql";
const DOWN = "007_legal_documents_superseded_by.down.sql";

describe("Migration 007 — legal_documents.superseded_by + status", () => {
  it("forward migration file exists", () => {
    readMigration(FORWARD);
  });

  it("down migration file exists", () => {
    readMigration(DOWN);
  });

  describe("forward migration", () => {
    const up = readMigration(FORWARD);

    it("targets uk_emp_rag.legal_documents (qualified schema)", () => {
      expect(up).toContain("uk_emp_rag.legal_documents");
    });

    it("adds superseded_by uuid column (idempotent)", () => {
      expect(up).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+superseded_by\s+uuid/i);
    });

    it("adds self-referencing FK with ON DELETE SET NULL", () => {
      expect(up).toContain("uk_emp_rag_legal_documents_superseded_by_fkey");
      expect(up).toMatch(/REFERENCES\s+uk_emp_rag\.legal_documents\s*\(\s*id\s*\)/i);
      expect(up).toMatch(/ON\s+DELETE\s+SET\s+NULL/i);
    });

    it("prevents self-supersession via CHECK", () => {
      expect(up).toContain("uk_emp_rag_legal_documents_no_self_supersede_chk");
      expect(up).toMatch(/superseded_by\s*<>\s*id/);
    });

    it("tightens status to ('active','superseded','withdrawn')", () => {
      expect(up).toContain("uk_emp_rag_legal_documents_status_chk");
      expect(up).toContain("'active'");
      expect(up).toContain("'superseded'");
      expect(up).toContain("'withdrawn'");
    });

    it("does NOT include 'deprecated' as a status value (3-value enum)", () => {
      expect(up).not.toMatch(/'deprecated'/);
    });

    it("uses NOT VALID + VALIDATE pattern for the status CHECK", () => {
      expect(up).toMatch(/NOT\s+VALID/i);
      expect(up).toMatch(/VALIDATE\s+CONSTRAINT\s+uk_emp_rag_legal_documents_status_chk/i);
    });

    it("creates partial index on superseded_by IS NOT NULL", () => {
      expect(up).toContain("uk_emp_rag_legal_documents_superseded_by_idx");
      expect(up).toMatch(/WHERE\s+superseded_by\s+IS\s+NOT\s+NULL/i);
    });

    it("creates partial index on status='active'", () => {
      expect(up).toContain("uk_emp_rag_legal_documents_status_active_idx");
      expect(up).toMatch(/WHERE\s+status\s*=\s*'active'/i);
    });

    it("has no INSERT statements (DDL only)", () => {
      expect(up).not.toMatch(/\bINSERT\s+INTO\b/i);
    });

    it("has no inline BEGIN/COMMIT transaction wrapper", () => {
      // Migration framework supplies transactionality; matches convention of 001–006.
      // Look only at top-level transaction statements (BEGIN; / COMMIT;);
      // PL/pgSQL BEGIN inside DO $$ ... $$; blocks has no semicolon and is allowed.
      expect(up).not.toMatch(/^\s*BEGIN\s*;/m);
      expect(up).not.toMatch(/^\s*COMMIT\s*;/m);
    });

    it("has no forbidden patterns (fetch/axios/secrets/credentials)", () => {
      expect(up).not.toMatch(/\bfetch\s*\(/);
      expect(up).not.toContain("axios");
      expect(up).not.toMatch(/sk-[a-zA-Z0-9]{10,}/);
      expect(up).not.toMatch(/github_pat_/i);
      expect(up).not.toMatch(/AKIA[0-9A-Z]{16}/);
      expect(up).not.toMatch(/BEGIN PRIVATE KEY/);
      expect(up).not.toMatch(/DATABASE_URL\s*=/);
      expect(up).not.toMatch(/:\/\/[^/\s]+:[^/\s]+@/);
    });
  });

  describe("down migration", () => {
    const down = readMigration(DOWN);

    it("drops the partial indexes", () => {
      expect(down).toMatch(/DROP\s+INDEX\s+IF\s+EXISTS\s+uk_emp_rag\.uk_emp_rag_legal_documents_status_active_idx/i);
      expect(down).toMatch(/DROP\s+INDEX\s+IF\s+EXISTS\s+uk_emp_rag\.uk_emp_rag_legal_documents_superseded_by_idx/i);
    });

    it("drops the CHECK and FK constraints", () => {
      expect(down).toMatch(/DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+uk_emp_rag_legal_documents_status_chk/i);
      expect(down).toMatch(/DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+uk_emp_rag_legal_documents_no_self_supersede_chk/i);
      expect(down).toMatch(/DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+uk_emp_rag_legal_documents_superseded_by_fkey/i);
    });

    it("drops the superseded_by column", () => {
      expect(down).toMatch(/DROP\s+COLUMN\s+IF\s+EXISTS\s+superseded_by/i);
    });

    it("does NOT drop schema uk_emp_rag", () => {
      const withoutComments = down.replace(/--[^\n]*/g, "");
      expect(withoutComments.toLowerCase()).not.toMatch(/drop\s+schema[^;]*uk_emp_rag/i);
    });
  });
});
