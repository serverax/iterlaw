// Sprint 20 — UK Employment ingestion pack foundation tests.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  evaluateIngestionPolicy,
} from "../ingestion/ingestionPolicy";
import {
  findUkEmploymentTrustedHost,
  listUkEmploymentSourceTiers,
  listUkEmploymentTrustedHosts,
} from "../ingestion/ukEmploymentSourceRegistry";
import { evaluateCitationMetadata } from "../ingestion/citationRegistryPolicy";
import {
  findStatutoryCalculator,
  listStatutoryCalculators,
  UK_EMPLOYMENT_STATUTORY_CALCULATORS,
} from "../legalRules/statutoryCalculatorRegistry";

describe("Sprint 20 — UK Employment trusted-host allowlist", () => {
  it("allows official UK legislation host (legislation.gov.uk)", () => {
    const r = evaluateIngestionPolicy("https://www.legislation.gov.uk/ukpga/1996/18/section/94");
    expect(r.allowed).toBe(true);
  });

  it("allows GOV.UK guidance", () => {
    const r = evaluateIngestionPolicy("https://www.gov.uk/holiday-entitlement-rights");
    expect(r.allowed).toBe(true);
  });

  it("allows ACAS guidance", () => {
    const r = evaluateIngestionPolicy("https://www.acas.org.uk/discipline-and-grievance");
    expect(r.allowed).toBe(true);
  });

  it("allows judiciary.uk and bailii.org for case law / Presidential Guidance", () => {
    expect(evaluateIngestionPolicy("https://www.judiciary.uk/some-guidance").allowed).toBe(true);
    expect(evaluateIngestionPolicy("https://www.bailii.org/uk/cases/UKEAT/2024/...").allowed).toBe(true);
  });

  it("blocks unknown hostnames", () => {
    const r = evaluateIngestionPolicy("https://random-blog.example.com/employment-tip");
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("unapproved_host");
  });

  it("blocks plain HTTP even on a trusted host", () => {
    const r = evaluateIngestionPolicy("http://www.gov.uk/holiday-entitlement-rights");
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("non_https");
  });

  it("blocks unparseable URLs", () => {
    expect(evaluateIngestionPolicy("").allowed).toBe(false);
    expect(evaluateIngestionPolicy("not a url").allowed).toBe(false);
  });

  it("source-tier ordering is deterministic", () => {
    const tiers = listUkEmploymentSourceTiers();
    // primary legislation must come before guidance
    expect(tiers.indexOf("primary_legislation")).toBeLessThan(tiers.indexOf("gov_guidance"));
    expect(tiers.indexOf("primary_legislation")).toBeLessThan(tiers.indexOf("acas_guidance"));
    // statutory_rate is lowest (only valid when an official source exists)
    expect(tiers[tiers.length - 1]).toBe("statutory_rate");
  });

  it("findUkEmploymentTrustedHost is case-insensitive on hostname", () => {
    expect(findUkEmploymentTrustedHost("WWW.LEGISLATION.GOV.UK")?.host).toBe("www.legislation.gov.uk");
  });

  it("registry contains the expected official hosts", () => {
    const hosts = listUkEmploymentTrustedHosts().map((h) => h.host).sort();
    expect(hosts).toContain("www.legislation.gov.uk");
    expect(hosts).toContain("www.gov.uk");
    expect(hosts).toContain("www.acas.org.uk");
    expect(hosts).toContain("www.judiciary.uk");
    expect(hosts).toContain("www.bailii.org");
    expect(hosts).toContain("caselaw.nationalarchives.gov.uk");
  });
});

describe("Sprint 20 — citation registry policy", () => {
  it("requires source_url, source_title, and a verified/retrieved timestamp", () => {
    const r = evaluateCitationMetadata({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reasons).toContain("missing_source_url");
      expect(r.reasons).toContain("missing_source_title");
      expect(r.reasons).toContain("missing_retrieved_or_verified_timestamp");
    }
  });

  it("flags legal sources missing effective_from / effective_to as needs_review", () => {
    const r = evaluateCitationMetadata({
      source_url: "https://www.legislation.gov.uk/ukpga/1996/18",
      source_title: "ERA 1996",
      verified_at: "2026-01-01",
      is_legal_source: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.level).toBe("needs_review");
  });

  it("returns fully_cited when all required fields are present", () => {
    const r = evaluateCitationMetadata({
      source_url: "https://www.legislation.gov.uk/ukpga/1996/18",
      source_title: "ERA 1996",
      verified_at: "2026-01-01",
      effective_from: "1996-08-22",
      is_legal_source: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.level).toBe("fully_cited");
  });

  it("non-legal sources do not require effective date", () => {
    const r = evaluateCitationMetadata({
      source_url: "https://www.gov.uk/some-help-page",
      source_title: "GOV.UK help page",
      verified_at: "2026-01-01",
      is_legal_source: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.level).toBe("fully_cited");
  });
});

describe("Sprint 20 — statutory calculator registry", () => {
  it("lists the expected calculators", () => {
    const ids = listStatutoryCalculators().map((c) => c.calculatorId).sort();
    for (const expected of [
      "limitation_dates",
      "statutory_redundancy_pay",
      "notice_period",
      "holiday_pay",
      "ssp",
      "nmw_nlw",
      "unfair_dismissal_cap",
      "vento_bands",
    ]) {
      expect(ids).toContain(expected);
    }
  });

  it("every calculator points at an official source", () => {
    for (const c of UK_EMPLOYMENT_STATUTORY_CALCULATORS) {
      expect(c.officialSource).toMatch(/^https:\/\/(www\.legislation\.gov\.uk|www\.gov\.uk|www\.judiciary\.uk)\//);
    }
  });

  it("only statutory_redundancy_pay is implemented (Sprint 21); every other calculator stays planned", () => {
    for (const c of UK_EMPLOYMENT_STATUTORY_CALCULATORS) {
      if (c.calculatorId === "statutory_redundancy_pay") {
        expect(c.status, `${c.calculatorId} is implemented in Sprint 21`).toBe("implemented");
      } else {
        expect(c.status, `${c.calculatorId} must remain planned until implemented`).toBe("planned");
      }
    }
  });

  it("findStatutoryCalculator returns undefined for unknown ids", () => {
    expect(findStatutoryCalculator("not_a_calculator")).toBeUndefined();
  });
});

describe("Sprint 20 — no live fetch / network in pack source", () => {
  // Static source scan: ingestion + legalRules pack files must not import fetch/axios/http
  // and must not embed any external LLM hostname.
  const FILES = [
    "ingestion/ukEmploymentSourceRegistry.ts",
    "ingestion/ingestionPolicy.ts",
    "ingestion/citationRegistryPolicy.ts",
    "legalRules/statutoryCalculatorRegistry.ts",
  ];
  it.each(FILES)("source-scan: %s has no external LLM / network import", (rel) => {
    const source = readFileSync(join(__dirname, "..", rel), "utf8");
    expect(source).not.toMatch(/from\s+"axios"/);
    expect(source).not.toMatch(/from\s+"node-fetch"/);
    expect(source).not.toMatch(/from\s+["']http/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com/);
  });
});
