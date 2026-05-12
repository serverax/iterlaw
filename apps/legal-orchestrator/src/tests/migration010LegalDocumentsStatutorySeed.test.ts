// Migration 010 — uk_emp_rag.legal_documents statutory-document seed.
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

const FORWARD = "010_legal_documents_statutory_seed.sql";
const DOWN = "010_legal_documents_statutory_seed.down.sql";

const SEED_UUIDS = [
  "01900010-0010-4000-8000-000000000001",
  "01900010-0010-4000-8000-000000000002",
  "01900010-0010-4000-8000-000000000003",
  "01900010-0010-4000-8000-000000000004",
];

const SOURCE_GOVUK_EMPLOYMENT = "01900010-0000-4000-8000-000000000002";
const SOURCE_LEGISLATION = "01900010-0000-4000-8000-000000000001";
const SOURCE_JUDICIARY = "01900010-0000-4000-8000-000000000007";

describe("Migration 010 — legal_documents statutory seed", () => {
  it("forward migration file exists", () => {
    readMigration(FORWARD);
  });

  it("down migration file exists", () => {
    readMigration(DOWN);
  });

  describe("forward migration", () => {
    const up = readMigration(FORWARD);

    it("inserts into uk_emp_rag.legal_documents (qualified schema)", () => {
      expect(up).toMatch(/INSERT\s+INTO\s+uk_emp_rag\.legal_documents\b/i);
    });

    it("uses ON CONFLICT (id) DO UPDATE for idempotency", () => {
      expect(up).toMatch(/ON\s+CONFLICT\s*\(\s*id\s*\)\s+DO\s+UPDATE/i);
    });

    it("seeds exactly the four deterministic UUIDs", () => {
      for (const uuid of SEED_UUIDS) {
        expect(up).toContain(uuid);
      }
    });

    it("references the GOV.UK Employment source for NMW (row 1)", () => {
      expect(up).toContain(SOURCE_GOVUK_EMPLOYMENT);
      expect(up).toMatch(/National\s+Minimum\s+Wage/i);
      expect(up).toContain("https://www.gov.uk/national-minimum-wage-rates");
    });

    it("references the legislation.gov.uk source for SI 2026/310 (row 2)", () => {
      expect(up).toContain(SOURCE_LEGISLATION);
      expect(up).toContain("https://www.legislation.gov.uk/uksi/2026/310");
      expect(up).toMatch(/SI\s+2026\/310/);
    });

    it("references the GOV.UK Employment source for redundancy cap (row 3)", () => {
      expect(up).toContain("https://www.gov.uk/redundancy-your-rights/redundancy-pay");
      expect(up).toMatch(/Redundancy\s+pay/i);
    });

    it("references the Judiciary UK source for Vento bands (row 4)", () => {
      expect(up).toContain(SOURCE_JUDICIARY);
      expect(up).toContain("https://www.judiciary.uk/guidance-and-resources/vento-bands-presidential-guidance/");
      expect(up).toMatch(/Vento/);
    });

    it("marks every row as seed_row=true and ingestion_pending=true", () => {
      const seedRowMatches = up.match(/'seed_row',\s*\n?\s*true/g) ?? [];
      const ingestionPendingMatches = up.match(/'ingestion_pending',\s*\n?\s*true/g) ?? [];
      expect(seedRowMatches.length).toBe(4);
      expect(ingestionPendingMatches.length).toBe(4);
    });

    it("uses status='active' for all seed rows (CHECK from migration 007)", () => {
      const activeMatches = up.match(/'active'/g) ?? [];
      expect(activeMatches.length).toBeGreaterThanOrEqual(4);
      // Must not introduce a forbidden status value.
      expect(up).not.toMatch(/'pending_ingestion'/i);
      expect(up).not.toMatch(/'deprecated'/i);
    });

    it("uses deterministic content_hash markers (no fabricated SHA values)", () => {
      expect(up).toContain("seed:nmw-2026-04-01:v1");
      expect(up).toContain("seed:uksi-2026-310:v1");
      expect(up).toContain("seed:redundancy-cap-2026:v1");
      expect(up).toContain("seed:vento-presidential-guidance:v1");
      // No hex-string content hashes that would imply real document fingerprints.
      expect(up).not.toMatch(/content_hash[^,]*'[0-9a-f]{40,}'/i);
    });

    it("does NOT write raw_text or raw_html (no content fabrication)", () => {
      // raw_text / raw_html columns must remain NULL — they are not in the
      // INSERT column list, so PostgreSQL leaves them NULL.
      const columnList = up.match(/INSERT\s+INTO\s+uk_emp_rag\.legal_documents\s*\(([^)]+)\)/i);
      expect(columnList).not.toBeNull();
      expect(columnList![1]).not.toMatch(/\braw_text\b/i);
      expect(columnList![1]).not.toMatch(/\braw_html\b/i);
    });

    it("does NOT write scraped_at or published_at (no fabricated timestamps)", () => {
      const columnList = up.match(/INSERT\s+INTO\s+uk_emp_rag\.legal_documents\s*\(([^)]+)\)/i);
      expect(columnList).not.toBeNull();
      expect(columnList![1]).not.toMatch(/\bscraped_at\b/i);
      expect(columnList![1]).not.toMatch(/\bpublished_at\b/i);
    });

    it("has no inline BEGIN/COMMIT transaction wrapper", () => {
      expect(up).not.toMatch(/^\s*BEGIN\s*;/m);
      expect(up).not.toMatch(/^\s*COMMIT\s*;/m);
    });

    it("does not touch tables other than uk_emp_rag.legal_documents", () => {
      const ddl = up.replace(/--[^\n]*/g, "");
      expect(ddl).not.toMatch(/INSERT\s+INTO\s+uk_emp_rag\.statutory_rate\b/i);
      expect(ddl).not.toMatch(/INSERT\s+INTO\s+uk_emp_rag\.legal_sources\b/i);
      expect(ddl).not.toMatch(/INSERT\s+INTO\s+uk_emp_rag\.legal_document_chunks\b/i);
      expect(ddl).not.toMatch(/INSERT\s+INTO\s+uk_emp_rag\.legal_chunk_embeddings\b/i);
      expect(ddl).not.toMatch(/UPDATE\s+uk_emp_rag\./i);
      expect(ddl).not.toMatch(/DELETE\s+FROM\s+uk_emp_rag\./i);
      expect(ddl).not.toMatch(/CREATE\s+TABLE\b/i);
      expect(ddl).not.toMatch(/ALTER\s+TABLE\b/i);
      expect(ddl).not.toMatch(/DROP\s+/i);
    });

    it("has no forbidden patterns (fetch/axios/secrets/credentials)", () => {
      expect(up).not.toMatch(/\bfetch\s*\(/);
      expect(up).not.toContain("axios");
      expect(up).not.toContain("openai");
      expect(up).not.toContain("anthropic");
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

    it("deletes from uk_emp_rag.legal_documents (qualified schema)", () => {
      expect(down).toMatch(/DELETE\s+FROM\s+uk_emp_rag\.legal_documents/i);
    });

    it("scopes the delete to the four seed UUIDs only", () => {
      for (const uuid of SEED_UUIDS) {
        expect(down).toContain(uuid);
      }
      // Must use WHERE id IN (...) — no unscoped delete.
      expect(down).toMatch(/WHERE\s+id\s+IN\s*\(/i);
    });

    it("does NOT delete from any other table", () => {
      const ddl = down.replace(/--[^\n]*/g, "");
      expect(ddl).not.toMatch(/DELETE\s+FROM\s+uk_emp_rag\.legal_sources/i);
      expect(ddl).not.toMatch(/DELETE\s+FROM\s+uk_emp_rag\.statutory_rate\b/i);
      expect(ddl).not.toMatch(/DELETE\s+FROM\s+uk_emp_rag\.legal_document_chunks/i);
    });

    it("does NOT drop schema or tables", () => {
      const withoutComments = down.replace(/--[^\n]*/g, "");
      expect(withoutComments).not.toMatch(/DROP\s+SCHEMA\b/i);
      expect(withoutComments).not.toMatch(/DROP\s+TABLE\b/i);
    });
  });
});
