import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "../../db/migrations/112_sprint21_law_module_engine_phase1.sql"), "utf8");

describe("migration 112_sprint21_law_module_engine_phase1.sql", () => {
  it("creates law_module_engine_runs", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.law_module_engine_runs/i);
    expect(sql).toMatch(/input_fingerprint/i);
    expect(sql).toMatch(/evidence_pack_version/i);
    expect(sql).toMatch(/reranker_score/i);
  });

  it("references users", () => {
    expect(sql).toMatch(/REFERENCES public\.users\(id\)/i);
  });

  it("indexes user and calculator", () => {
    expect(sql).toMatch(/idx_law_module_engine_runs_user_created/i);
    expect(sql).toMatch(/idx_law_module_engine_runs_calculator/i);
  });

  it("defines self select/insert and admin update/delete", () => {
    expect(sql).toMatch(/law_module_engine_runs_self_select/i);
    expect(sql).toMatch(/law_module_engine_runs_self_insert/i);
    expect(sql).toMatch(/law_module_engine_runs_admin_update/i);
    expect(sql).toMatch(/law_module_engine_runs_admin_delete/i);
    expect(sql).toMatch(/current_app_user_id\(\)/i);
  });

  it("CHECK evidence_pack_version positive", () => {
    expect(sql).toMatch(/evidence_pack_version\s+INT NOT NULL DEFAULT 1 CHECK \(evidence_pack_version > 0\)/i);
  });
});
