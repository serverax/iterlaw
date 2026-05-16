import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "../../db/migrations/108_sprint17_member_auth_foundation.sql"), "utf8");

describe("migration 108_sprint17_member_auth_foundation.sql", () => {
  it("adds password_hash on users", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS password_hash/i);
  });

  it("creates user_subscriptions with tier check", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.user_subscriptions/i);
    expect(sql).toMatch(/CHECK \(tier IN \('FREE', 'PRO', 'ENTERPRISE'\)\)/i);
  });

  it("creates user_api_keys with key_hash", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.user_api_keys/i);
    expect(sql).toMatch(/key_hash/i);
  });

  it("enables RLS on new tables", () => {
    expect(sql).toMatch(/ALTER TABLE public\.user_subscriptions ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/ALTER TABLE public\.user_api_keys ENABLE ROW LEVEL SECURITY/i);
  });

  it("defines self + admin style policies", () => {
    expect(sql).toMatch(/user_subscriptions_self_select/i);
    expect(sql).toMatch(/user_api_keys_self_select/i);
    expect(sql).toMatch(/current_app_user_id\(\)/i);
  });

  it("references users FK", () => {
    expect(sql).toMatch(/REFERENCES public\.users\(id\)/i);
  });
});
