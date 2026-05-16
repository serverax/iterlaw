import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "../../db/migrations/109_sprint18_legal_case_approvals.sql"), "utf8");

describe("migration 109_sprint18_legal_case_approvals.sql", () => {
  it("creates legal_case_approvals", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.legal_case_approvals/i);
  });

  it("references legal_case_records and users", () => {
    expect(sql).toMatch(/REFERENCES public\.legal_case_records\(id\)/i);
    expect(sql).toMatch(/REFERENCES public\.users\(id\)/i);
  });

  it("constrains status to APPROVED or REJECTED", () => {
    expect(sql).toMatch(/CHECK \(status IN \('APPROVED', 'REJECTED'\)\)/i);
  });

  it("enables admin-only RLS policies", () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/legal_case_approvals_admin_select/i);
    expect(sql).toMatch(/current_app_user_is_admin\(\)/i);
  });
});
