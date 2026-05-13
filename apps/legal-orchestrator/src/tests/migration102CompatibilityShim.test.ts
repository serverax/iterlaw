// Static checks for the migration 102 compatibility shim.
//
// In numeric replay order, 100 creates public.legal_cases first with
// the draft shape (`judgment_date`, no `decision_date`, no `source_id`,
// no `source_provider`, no `metadata`). 102 then runs against that
// existing table:
//   - CREATE TABLE IF NOT EXISTS public.legal_cases  → silent no-op.
//   - CREATE INDEX IF NOT EXISTS idx_legal_cases_decision_date
//                ON public.legal_cases (decision_date)
//     → ERROR: column "decision_date" does not exist.
//
// The fix in 102 is an additive, idempotent ALTER block that adds
// every column 102's indexes reference (and the rest of 102's
// declared columns) without NOT NULL, before the first CREATE INDEX.
//
// This test scans the migration text only — no DB is required.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(__dirname, "../../db/migrations");
const M102 = join(MIG_DIR, "102_add_legal_cases_table.sql");

function loadM102(): string {
  return readFileSync(M102, "utf8");
}

describe("migration 102 — compatibility shim against the 100 shape", () => {
  const body = loadM102();

  it("contains an ADD COLUMN IF NOT EXISTS for every column 102's indexes reference but the 100 shape lacks", () => {
    const must = ["source_id", "decision_date", "source_provider", "metadata"];
    for (const col of must) {
      const re = new RegExp(
        `ALTER\\s+TABLE\\s+public\\.legal_cases\\s+ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+${col}\\b`,
        "i",
      );
      expect(body, `missing ALTER for public.legal_cases.${col}`).toMatch(re);
    }
  });

  it("contains ADD COLUMN IF NOT EXISTS for the remaining 102-only columns the 100 shape lacks", () => {
    const must = [
      "case_name",
      "jurisdiction",
      "url",
      "summary",
      "full_text",
      "updated_at",
    ];
    for (const col of must) {
      const re = new RegExp(
        `ALTER\\s+TABLE\\s+public\\.legal_cases\\s+ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+${col}\\b`,
        "i",
      );
      expect(body, `missing ALTER for public.legal_cases.${col}`).toMatch(re);
    }
  });

  it("places the decision_date ALTER strictly before the decision_date index", () => {
    const alterIdx = body.search(
      /ALTER\s+TABLE\s+public\.legal_cases\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+decision_date\b/i,
    );
    const indexIdx = body.search(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_legal_cases_decision_date\b/i,
    );
    expect(alterIdx, "ALTER for decision_date not found").toBeGreaterThanOrEqual(0);
    expect(indexIdx, "INDEX idx_legal_cases_decision_date not found").toBeGreaterThanOrEqual(0);
    expect(alterIdx).toBeLessThan(indexIdx);
  });

  it("places the metadata ALTER strictly before the metadata gin index", () => {
    const alterIdx = body.search(
      /ALTER\s+TABLE\s+public\.legal_cases\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+metadata\b/i,
    );
    const indexIdx = body.search(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_legal_cases_metadata_gin\b/i,
    );
    expect(alterIdx).toBeGreaterThanOrEqual(0);
    expect(indexIdx).toBeGreaterThanOrEqual(0);
    expect(alterIdx).toBeLessThan(indexIdx);
  });

  it("places the source_id ALTER strictly before the source_id index", () => {
    const alterIdx = body.search(
      /ALTER\s+TABLE\s+public\.legal_cases\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+source_id\b/i,
    );
    const indexIdx = body.search(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_legal_cases_source_id\b/i,
    );
    expect(alterIdx).toBeGreaterThanOrEqual(0);
    expect(indexIdx).toBeGreaterThanOrEqual(0);
    expect(alterIdx).toBeLessThan(indexIdx);
  });

  it("places the source_provider ALTER strictly before the source_provider index", () => {
    const alterIdx = body.search(
      /ALTER\s+TABLE\s+public\.legal_cases\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+source_provider\b/i,
    );
    const indexIdx = body.search(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_legal_cases_source_provider\b/i,
    );
    expect(alterIdx).toBeGreaterThanOrEqual(0);
    expect(indexIdx).toBeGreaterThanOrEqual(0);
    expect(alterIdx).toBeLessThan(indexIdx);
  });

  it("introduces no destructive SQL", () => {
    const stripped = body
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/--[^\n]*\n/g, "\n");
    const forbidden = [
      /\bDROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT|VIEW|FUNCTION)\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bTRUNCATE\b/i,
    ];
    for (const re of forbidden) {
      expect(stripped, `forbidden statement matched ${re}`).not.toMatch(re);
    }
    expect(stripped).not.toMatch(/\bRENAME\b/i);
    expect(stripped).not.toMatch(/SET\s+NOT\s+NULL/i);
  });

  it("the ALTER block uses no NOT NULL on existing tables", () => {
    const lines = body.split(/\r?\n/);
    const offenders: string[] = [];
    for (const line of lines) {
      const m = /^\s*ALTER\s+TABLE\s+\S+\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+\S+/i.exec(line);
      if (!m) continue;
      if (/\bNOT\s+NULL\b/i.test(line)) offenders.push(line.trim());
    }
    expect(offenders, `ADD COLUMN ... NOT NULL would fail on populated tables: ${offenders.join("; ")}`).toEqual([]);
  });

  it("preserves the canonical 102 CREATE TABLE declaration (fresh-DB path)", () => {
    expect(body).toMatch(/CREATE TABLE IF NOT EXISTS public\.legal_cases\b/);
    for (const col of [
      "neutral_citation",
      "case_name",
      "court",
      "jurisdiction",
      "decision_date",
      "metadata",
    ]) {
      expect(body).toMatch(new RegExp(`\\b${col}\\b`));
    }
  });
});

describe("migration chain — 100 and 102 both shim the legacy schema; 104/105/106 still ordered", () => {
  it("both 100 and 102 add compatibility ALTER blocks", () => {
    const m100 = readFileSync(join(MIG_DIR, "100_iterlaw_core_rag_foundation.sql"), "utf8");
    const m102 = readFileSync(join(MIG_DIR, "102_add_legal_cases_table.sql"), "utf8");
    // 100: add legal_documents.legal_area + legal_cases.judgment_date at minimum.
    expect(m100).toMatch(
      /ALTER\s+TABLE\s+legal_documents\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+legal_area\b/i,
    );
    expect(m100).toMatch(
      /ALTER\s+TABLE\s+legal_cases\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+judgment_date\b/i,
    );
    // 102: add public.legal_cases.decision_date + metadata at minimum.
    expect(m102).toMatch(
      /ALTER\s+TABLE\s+public\.legal_cases\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+decision_date\b/i,
    );
    expect(m102).toMatch(
      /ALTER\s+TABLE\s+public\.legal_cases\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+metadata\b/i,
    );
  });

  it("104 / 105 / 106 still present and ordered after 102", () => {
    const sql = readdirSync(MIG_DIR)
      .filter((n) => /\.sql$/.test(n) && !/\.down\.sql$/.test(n))
      .sort();
    const idx = (n: string) => sql.findIndex((x) => x.startsWith(n));
    expect(idx("100_")).toBeGreaterThan(idx("010_"));
    expect(idx("101_")).toBeGreaterThan(idx("100_"));
    expect(idx("102_")).toBeGreaterThan(idx("101_"));
    expect(idx("104_")).toBeGreaterThan(idx("102_"));
    expect(idx("105_")).toBeGreaterThan(idx("104_"));
    expect(idx("106_")).toBeGreaterThan(idx("105_"));
    expect(sql.filter((n) => n.startsWith("103_"))).toEqual([]);
  });
});
