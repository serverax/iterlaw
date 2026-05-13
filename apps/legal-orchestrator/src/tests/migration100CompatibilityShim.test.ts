// Static checks for the migration 100 compatibility shim.
//
// Migration 100 is marked "DO NOT APPLY" on top of the 001-chain. A Docker
// staging replay tool that runs every .sql file in numeric order ignored
// the banner and failed at `idx_legal_documents_legal_area` because the
// 001-chain's `legal_documents` does not have a `legal_area` column.
//
// The fix in migration 100 is an additive, idempotent ALTER block:
//   ADD COLUMN IF NOT EXISTS for each column 100's indexes reference but
//   that the 001-chain shape does not declare.
//
// This test scans the migration text only — no DB is required.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(__dirname, "../../db/migrations");
const M100 = join(MIG_DIR, "100_iterlaw_core_rag_foundation.sql");

function loadM100(): string {
  return readFileSync(M100, "utf8");
}

describe("migration 100 — compatibility shim against 001-chain", () => {
  const body = loadM100();

  it("preserves the historical DO NOT APPLY banner and superseded-by reference", () => {
    // Locked by namespaceAndSchemaPolicy.test.ts. Re-asserted here so a
    // future edit does not silently strip the warning.
    expect(body).toMatch(/DO NOT APPLY/);
    expect(body).toMatch(/superseded by 101_reconcile_legal_rag_schema/);
  });

  it("contains the compatibility ALTER block for every column the 001-chain shape lacks", () => {
    const must: Array<[string, string]> = [
      ["legal_documents", "legal_area"],
      ["legal_documents", "jurisdiction"],
      ["legal_documents", "effective_from"],
      ["legal_documents", "effective_to"],
      ["legal_documents", "status"],
      ["legal_cases", "judgment_date"],
    ];
    for (const [tbl, col] of must) {
      const re = new RegExp(
        `ALTER\\s+TABLE\\s+${tbl}\\s+ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+${col}\\b`,
        "i",
      );
      expect(body, `missing ALTER for ${tbl}.${col}`).toMatch(re);
    }
  });

  it("places every legal_area-dependent CREATE INDEX after the ALTER block", () => {
    // The fix only works if the ALTER block precedes the index whose
    // column it adds. Find the first ALTER and the first index that
    // references one of the added columns; the ALTER must come first.
    const alterIdx = body.search(
      /ALTER\s+TABLE\s+legal_documents\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+legal_area\b/i,
    );
    const indexIdx = body.search(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_legal_documents_legal_area\b/i,
    );
    expect(alterIdx, "ALTER for legal_area not found").toBeGreaterThanOrEqual(0);
    expect(indexIdx, "INDEX idx_legal_documents_legal_area not found").toBeGreaterThanOrEqual(0);
    expect(alterIdx).toBeLessThan(indexIdx);
  });

  it("places the legal_cases.judgment_date ALTER before the legal_cases judgment_date index", () => {
    const alterIdx = body.search(
      /ALTER\s+TABLE\s+legal_cases\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+judgment_date\b/i,
    );
    const indexIdx = body.search(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_legal_cases_judgment_date\b/i,
    );
    expect(alterIdx).toBeGreaterThanOrEqual(0);
    expect(indexIdx).toBeGreaterThanOrEqual(0);
    expect(alterIdx).toBeLessThan(indexIdx);
  });

  it("introduces no destructive SQL", () => {
    // The compatibility shim must be additive only.
    // Strip `-- line comments` before scanning so descriptive prose
    // like "No DROPs" inside the header doesn't false-positive.
    const stripped = body
      .replace(/\/\*[\s\S]*?\*\//g, " ")      // SQL block comments
      .replace(/--[^\n]*\n/g, "\n");          // SQL line comments
    // DROP / DELETE FROM / TRUNCATE are forbidden in real statements.
    const forbidden = [
      /\bDROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT|VIEW|FUNCTION)\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bTRUNCATE\b/i,
    ];
    for (const re of forbidden) {
      expect(stripped, `forbidden statement matched ${re}`).not.toMatch(re);
    }
    // RENAME and SET NOT NULL on existing columns are also forbidden.
    expect(stripped).not.toMatch(/\bRENAME\b/i);
    expect(stripped).not.toMatch(/SET\s+NOT\s+NULL/i);
  });

  it("the ALTER block uses no NOT NULL clause (existing rows must not break)", () => {
    // Every ADD COLUMN line in the compat block must not declare NOT NULL.
    const lines = body.split(/\r?\n/);
    const offenders: string[] = [];
    for (const line of lines) {
      const m = /^\s*ALTER\s+TABLE\s+\S+\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+\S+/i.exec(line);
      if (!m) continue;
      if (/\bNOT\s+NULL\b/i.test(line)) offenders.push(line.trim());
    }
    expect(offenders, `ADD COLUMN ... NOT NULL would fail on populated tables: ${offenders.join("; ")}`).toEqual([]);
  });
});

describe("migration chain — 100 sits between 010 and 101 in numeric order", () => {
  it("104 / 105 / 106 still exist and still depend on legal_sources / workspace tables created earlier", () => {
    const names = readdirSync(MIG_DIR);
    for (const n of [
      "104_user_workspace_foundation.sql",
      "105_case_workspace.sql",
      "106_enable_rls.sql",
    ]) {
      expect(names).toContain(n);
    }
    const m105 = readFileSync(join(MIG_DIR, "105_case_workspace.sql"), "utf8");
    // 105 references the canonical legal_sources via legal_case_sources.
    expect(m105).toMatch(/legal_sources/);
    // 106 references the 9 user-data tables for RLS enable.
    const m106 = readFileSync(join(MIG_DIR, "106_enable_rls.sql"), "utf8");
    for (const t of [
      "users",
      "workspaces",
      "workspace_members",
      "legal_case_records",
      "legal_case_facts",
      "legal_case_documents",
      "legal_case_drafts",
      "legal_case_timeline",
      "legal_case_sources",
    ]) {
      expect(m106).toMatch(new RegExp(`\\b${t}\\b`));
    }
  });

  it("the migration directory orders 010 -> 100 -> 101 -> 102 -> 104 -> 105 -> 106 lexically", () => {
    const sql = readdirSync(MIG_DIR)
      .filter((n) => /\.sql$/.test(n) && !/\.down\.sql$/.test(n))
      .sort();
    const idx = (n: string) => sql.findIndex((x) => x.startsWith(n));
    expect(idx("010_")).toBeGreaterThan(idx("001_"));
    expect(idx("100_")).toBeGreaterThan(idx("010_"));
    expect(idx("101_")).toBeGreaterThan(idx("100_"));
    expect(idx("102_")).toBeGreaterThan(idx("101_"));
    expect(idx("104_")).toBeGreaterThan(idx("102_"));
    expect(idx("105_")).toBeGreaterThan(idx("104_"));
    expect(idx("106_")).toBeGreaterThan(idx("105_"));
    // 103 must remain absent.
    expect(sql.filter((n) => n.startsWith("103_"))).toEqual([]);
  });
});
