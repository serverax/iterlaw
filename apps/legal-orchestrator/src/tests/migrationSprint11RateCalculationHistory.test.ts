// Sprint 11 — Migration 009: uk_emp_rag.statutory_rate_calculation_history.
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

const FORWARD = "009_statutory_rate_calculation_history.sql";
const DOWN = "009_statutory_rate_calculation_history.down.sql";

describe("Migration 009 — statutory_rate_calculation_history", () => {
  it("forward migration file exists", () => {
    readMigration(FORWARD);
  });

  it("down migration file exists", () => {
    readMigration(DOWN);
  });

  describe("forward migration", () => {
    const up = readMigration(FORWARD);

    it("creates statutory_rate_calculation_history in uk_emp_rag (idempotent)", () => {
      expect(up).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+uk_emp_rag\.statutory_rate_calculation_history\b/i);
    });

    it("FK to statutory_rate(id) with ON DELETE RESTRICT (no orphan history)", () => {
      expect(up).toMatch(/statutory_rate_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+uk_emp_rag\.statutory_rate\s*\(\s*id\s*\)\s+ON\s+DELETE\s+RESTRICT/i);
    });

    it("FK to legal_documents(id) with ON DELETE SET NULL (source provenance)", () => {
      expect(up).toMatch(/source_document_id\s+uuid\s+REFERENCES\s+uk_emp_rag\.legal_documents\s*\(\s*id\s*\)\s+ON\s+DELETE\s+SET\s+NULL/i);
    });

    it("FK to legal_ingestion_runs(id) with ON DELETE SET NULL (run lineage)", () => {
      expect(up).toMatch(/ingestion_run_id\s+uuid\s+REFERENCES\s+uk_emp_rag\.legal_ingestion_runs\s*\(\s*id\s*\)\s+ON\s+DELETE\s+SET\s+NULL/i);
    });

    it("does NOT include superseded_by_run_id column (per design decision J)", () => {
      // Strip line comments; the rejected column is referenced in the migration header.
      const withoutComments = up.replace(/--[^\n]*/g, "");
      expect(withoutComments).not.toContain("superseded_by_run_id");
    });

    it("tracks rate_category, previous_value, new_value", () => {
      expect(up).toMatch(/rate_category\s+text\s+NOT\s+NULL/i);
      expect(up).toMatch(/previous_value\s+numeric/i);
      expect(up).toMatch(/new_value\s+numeric\s+NOT\s+NULL/i);
    });

    it("has effective_from + effective_to (SCD Type 2 window)", () => {
      expect(up).toMatch(/effective_from\s+date\s+NOT\s+NULL/i);
      expect(up).toMatch(/effective_to\s+date(?!\s+NOT\s+NULL)/i);
    });

    it("imports the unit CHECK from migration 006 (same 5 values)", () => {
      expect(up).toContain("uk_emp_rag_statutory_rate_calc_hist_unit_chk");
      expect(up).toContain("'GBP'");
      expect(up).toContain("'GBP_PER_HOUR'");
      expect(up).toContain("'GBP_PER_WEEK'");
      expect(up).toContain("'WEEKS'");
      expect(up).toContain("'PERCENT'");
    });

    it("enforces effective_to > effective_from when set", () => {
      expect(up).toContain("uk_emp_rag_statutory_rate_calc_hist_window_chk");
      expect(up).toMatch(/effective_to\s+IS\s+NULL\s+OR\s+effective_to\s*>\s*effective_from/i);
    });

    it("has changed_by as plain uuid (no FK — soft pointer)", () => {
      const m = up.match(/changed_by[^\n,]*/);
      expect(m).not.toBeNull();
      expect(m![0].toLowerCase()).not.toContain("references");
    });

    it("creates the 4 expected indexes", () => {
      expect(up).toContain("uk_emp_rag_statutory_rate_calc_hist_rate_idx");
      expect(up).toContain("uk_emp_rag_statutory_rate_calc_hist_category_eff_idx");
      expect(up).toContain("uk_emp_rag_statutory_rate_calc_hist_source_idx");
      expect(up).toContain("uk_emp_rag_statutory_rate_calc_hist_run_idx");
    });

    it("partial index on (rate_category, effective_from) WHERE effective_to IS NULL", () => {
      expect(up).toMatch(/uk_emp_rag_statutory_rate_calc_hist_category_eff_idx[\s\S]*WHERE\s+effective_to\s+IS\s+NULL/i);
    });

    it("has no INSERT statements (DDL only — rates come from verified ingest)", () => {
      expect(up).not.toMatch(/\bINSERT\s+INTO\b/i);
    });

    it("has no inline BEGIN/COMMIT transaction wrapper", () => {
      expect(up).not.toMatch(/^\s*BEGIN\s*;/m);
      expect(up).not.toMatch(/^\s*COMMIT\s*;/m);
    });

    it("has no forbidden patterns", () => {
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

    it("drops the table", () => {
      expect(down).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+uk_emp_rag\.statutory_rate_calculation_history/i);
    });

    it("drops all four indexes", () => {
      expect(down).toContain("uk_emp_rag_statutory_rate_calc_hist_run_idx");
      expect(down).toContain("uk_emp_rag_statutory_rate_calc_hist_source_idx");
      expect(down).toContain("uk_emp_rag_statutory_rate_calc_hist_category_eff_idx");
      expect(down).toContain("uk_emp_rag_statutory_rate_calc_hist_rate_idx");
    });

    it("does NOT drop schema uk_emp_rag", () => {
      const withoutComments = down.replace(/--[^\n]*/g, "");
      expect(withoutComments.toLowerCase()).not.toMatch(/drop\s+schema[^;]*uk_emp_rag/i);
    });
  });
});
