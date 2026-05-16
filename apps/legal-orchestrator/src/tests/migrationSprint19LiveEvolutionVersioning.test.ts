import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "../../db/migrations/110_sprint19_live_evolution_versioning.sql"), "utf8");

describe("migration 110_sprint19_live_evolution_versioning.sql", () => {
  it("creates prompt_versions with key and version uniqueness", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.prompt_versions/i);
    expect(sql).toMatch(/CONSTRAINT prompt_versions_key_version UNIQUE \(prompt_key, version\)/i);
  });

  it("creates rule_versions with key and version uniqueness", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.rule_versions/i);
    expect(sql).toMatch(/CONSTRAINT rule_versions_key_version UNIQUE \(rule_key, version\)/i);
  });

  it("creates ab_test_flags with segment_rules jsonb", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.ab_test_flags/i);
    expect(sql).toMatch(/segment_rules\s+JSONB/i);
  });

  it("creates ab_test_metrics with variant_version and rates", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.ab_test_metrics/i);
    expect(sql).toMatch(/variant_version/i);
    expect(sql).toMatch(/conversion_rate/i);
    expect(sql).toMatch(/error_rate/i);
  });

  it("enables admin-only RLS on all four tables", () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/prompt_versions_admin_all/i);
    expect(sql).toMatch(/rule_versions_admin_all/i);
    expect(sql).toMatch(/ab_test_flags_admin_all/i);
    expect(sql).toMatch(/ab_test_metrics_admin_all/i);
    expect(sql).toMatch(/current_app_user_is_admin\(\)/i);
  });
});
