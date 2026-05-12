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

const FORWARD = "004_legal_rag_sprint10_source_registry.sql";
const DOWN = "004_legal_rag_sprint10_source_registry.down.sql";

const REQUIRED_NAMES = [
  "legislation.gov.uk",
  "GOV.UK Employment",
  "ACAS",
  "Employment Tribunal Decisions",
  "Employment Appeal Tribunal Decisions",
  "HMCTS Forms and Guidance",
  "Judiciary UK",
  "The National Archives",
  "Supreme Court UK",
  "BAILII",
  "Equality and Human Rights Commission",
  "ICO Employment Practices",
  "Health and Safety Executive",
  "Department for Business and Trade",
  "The Pensions Regulator",
] as const;

const REQUIRED_URLS = [
  "https://www.legislation.gov.uk",
  "https://www.gov.uk/browse/employing-people",
  "https://www.acas.org.uk",
  "https://www.gov.uk/employment-tribunal-decisions",
  "https://www.gov.uk/employment-appeal-tribunal-decisions",
  "https://www.gov.uk/government/organisations/hm-courts-and-tribunals-service",
  "https://www.judiciary.uk",
  "https://www.nationalarchives.gov.uk",
  "https://www.supremecourt.uk",
  "https://www.bailii.org",
  "https://www.equalityhumanrights.com",
  "https://ico.org.uk",
  "https://www.hse.gov.uk",
  "https://www.gov.uk/government/organisations/department-for-business-and-trade",
  "https://www.thepensionsregulator.gov.uk",
] as const;

describe("Sprint 10 trusted source registry migration (static validation)", () => {
  it("forward migration file exists", () => {
    readMigration(FORWARD);
  });

  it("down migration file exists", () => {
    readMigration(DOWN);
  });

  it("forward migration inserts into uk_emp_rag.legal_sources", () => {
    const up = readMigration(FORWARD);
    expect(up).toContain("INSERT INTO uk_emp_rag.legal_sources");
  });

  it("all 15 required source names exist in the SQL", () => {
    const up = readMigration(FORWARD);
    for (const n of REQUIRED_NAMES) {
      expect(up).toContain(n);
    }
  });

  it("all source base URLs exist in the SQL", () => {
    const up = readMigration(FORWARD);
    for (const u of REQUIRED_URLS) {
      expect(up).toContain(u);
    }
  });

  it("source types used by Sprint 10 are present", () => {
    const up = readMigration(FORWARD);
    for (const t of [
      "legislation",
      "gov_guidance",
      "acas_guidance",
      "tribunal_decision",
      "eat_decision",
      "hmcts_guidance",
      "court_judgment",
      "archive",
      "legal_database",
      "equality_guidance",
      "data_protection_guidance",
      "health_safety_guidance",
      "pensions_guidance",
    ]) {
      expect(up).toContain(`'${t}'`);
    }
  });

  it("trust levels used by Sprint 10 are present", () => {
    const up = readMigration(FORWARD);
    for (const tl of [
      "primary_law",
      "official_guidance",
      "tribunal_authority",
      "official_archive",
      "court_authority",
      "legal_database",
    ]) {
      expect(up).toContain(`'${tl}'`);
    }
  });

  it("migration is idempotent using ON CONFLICT", () => {
    const up = readMigration(FORWARD);
    expect(up).toMatch(/ON\s+CONFLICT\s*\(\s*id\s*\)/i);
    expect(up).toMatch(/DO\s+UPDATE/i);
  });

  it("down migration deletes only Sprint 10 seeded source rows by id", () => {
    const d = readMigration(DOWN);
    expect(d).toContain("DELETE FROM uk_emp_rag.legal_sources");
    expect(d).toContain("01900010-0000-4000-8000-000000000001");
    expect(d).toContain("01900010-0000-4000-8000-00000000000f");
  });

  it("down migration does not drop schema uk_emp_rag", () => {
    const d = readMigration(DOWN);
    const withoutLineComments = d.replace(/--[^\n]*/g, "");
    expect(withoutLineComments.toLowerCase()).not.toMatch(/drop\s+schema[^;]*uk_emp_rag/i);
  });

  it("no scraping code in forward migration", () => {
    const up = readMigration(FORWARD);
    expect(up.toLowerCase()).not.toContain("scrapy");
    expect(up.toLowerCase()).not.toContain("puppeteer");
    expect(up.toLowerCase()).not.toContain("playwright");
    expect(up.toLowerCase()).not.toContain("cheerio");
  });

  it("no external HTTP/API client code in migrations", () => {
    const up = readMigration(FORWARD);
    const d = readMigration(DOWN);
    const both = up + d;
    expect(both).not.toMatch(/\bfetch\s*\(/);
    expect(both).not.toContain("axios");
    expect(both).not.toContain("http.request");
    expect(both).not.toContain("https.request");
  });

  it("no secrets, API keys, DATABASE_URL assignments, passwords, or credential URLs", () => {
    const up = readMigration(FORWARD);
    const d = readMigration(DOWN);
    const both = up + d;
    const banned = [
      /sk-[a-zA-Z0-9]{10,}/,
      /github_pat_/i,
      /AKIA[0-9A-Z]{16}/,
      /BEGIN PRIVATE KEY/,
      /DATABASE_URL\s*=/,
      /postgres(ql)?:\/\/[^:]+:[^@]+@/i,
      /:\/\/[^/\s]+:[^/\s]+@/,
    ];
    for (const re of banned) {
      expect(both).not.toMatch(re);
    }
  });
});
