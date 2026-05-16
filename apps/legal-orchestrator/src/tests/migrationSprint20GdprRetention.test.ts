import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "../../db/migrations/111_sprint20_gdpr_retention.sql"), "utf8");

describe("migration 111_sprint20_gdpr_retention.sql", () => {
  it("creates data_retention_policies with positive retention_days check", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.data_retention_policies/i);
    expect(sql).toMatch(/retention_days\s+INT NOT NULL CHECK \(retention_days > 0\)/i);
    expect(sql).toMatch(/UNIQUE \(resource_type, category\)/i);
  });

  it("creates gdpr_subject_requests with request_type and status checks", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.gdpr_subject_requests/i);
    expect(sql).toMatch(/CHECK \(request_type IN \('EXPORT', 'ERASURE', 'RECTIFICATION'\)\)/i);
    expect(sql).toMatch(/CHECK \(status IN \('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'\)\)/i);
  });

  it("references users for gdpr_subject_requests.user_id", () => {
    expect(sql).toMatch(/REFERENCES public\.users\(id\)/i);
  });

  it("enables RLS and defines admin policy on retention catalog", () => {
    expect(sql).toMatch(/data_retention_policies.*ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/data_retention_policies_admin_all/i);
    expect(sql).toMatch(/current_app_user_is_admin\(\)/i);
  });

  it("defines self + admin DSR select and admin update/delete", () => {
    expect(sql).toMatch(/gdpr_subject_requests_self_select/i);
    expect(sql).toMatch(/user_id = public\.current_app_user_id\(\)/i);
    expect(sql).toMatch(/gdpr_subject_requests_self_insert/i);
    expect(sql).toMatch(/gdpr_subject_requests_admin_update/i);
    expect(sql).toMatch(/gdpr_subject_requests_admin_delete/i);
  });

  it("indexes user_id and status for queue scans", () => {
    expect(sql).toMatch(/idx_gdpr_subject_requests_user_id/i);
    expect(sql).toMatch(/idx_gdpr_subject_requests_status/i);
  });
});
