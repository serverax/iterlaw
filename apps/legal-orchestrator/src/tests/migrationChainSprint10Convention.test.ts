// Locks Sprint 10+ DB migration numbering: SQL-only chain, 102 present,
// 103 intentionally absent (reserved for GraphRAG per 104 header).

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(__dirname, "../../db/migrations");

describe("migration directory convention (Sprint 10 DB)", () => {
  it("uses only .sql migration files (no .ts migrations in db/migrations)", () => {
    const names = readdirSync(MIG_DIR);
    const nonSql = names.filter((n) => !n.endsWith(".sql"));
    expect(nonSql, `unexpected non-sql in migrations: ${nonSql.join(", ")}`).toEqual([]);
  });

  it("includes 102_add_legal_cases_table.sql in the forward chain", () => {
    const names = readdirSync(MIG_DIR);
    expect(names).toContain("102_add_legal_cases_table.sql");
  });

  it("does not ship a 103_*.sql file — 103 is reserved (see 104_user_workspace_foundation.sql header)", () => {
    const names = readdirSync(MIG_DIR);
    const n103 = names.filter((n) => /^103_/i.test(n));
    expect(n103).toEqual([]);
    const header = readFileSync(join(MIG_DIR, "104_user_workspace_foundation.sql"), "utf8");
    expect(header).toMatch(/103 is skipped|103 is reserved/i);
  });
});
