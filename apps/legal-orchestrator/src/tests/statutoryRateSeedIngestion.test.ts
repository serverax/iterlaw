import { describe, expect, it } from "vitest";

import { ingestCitedStatutoryRateSeed, selectCapForDate } from "../legalRules/statutoryRateSeed";
import type { CitedStatutoryRateEntry } from "../legalRules/statutoryRateSources";
import { calculateStatutoryRedundancyPay } from "../legalRules/redundancyPayCalculator";

function entry(o: Partial<CitedStatutoryRateEntry> = {}): CitedStatutoryRateEntry {
  return {
    jurisdiction: "UK_ENGLAND_WALES",
    rate_type: "statutory_weekly_pay_cap",
    amount: 700,
    currency: "GBP",
    effective_from: "2024-04-06",
    effective_to: "2025-04-05",
    source_title: "Test fixture (illustrative only)",
    source_url: "https://www.legislation.gov.uk/test/fixture",
    verified_at: "2026-05-14",
    trust_score: 0.9,
    ...o,
  };
}

describe("ingestCitedStatutoryRateSeed — accepts cited seeds", () => {
  it("accepts a single valid cited entry", () => {
    const out = ingestCitedStatutoryRateSeed([entry({})]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.accepted).toBe(1);
    expect(out.registry.weeklyPayCaps).toHaveLength(1);
    expect(out.reasonCodes).toContain("seed_ingest:ok");
  });

  it("accepts an empty seed but marks no_production_claim", () => {
    const out = ingestCitedStatutoryRateSeed([]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.accepted).toBe(0);
    expect(out.registry.weeklyPayCaps).toEqual([]);
    expect(out.reasonCodes).toContain("seed_ingest:empty_seed_no_production_claim");
  });

  it("registry from a valid seed drives the redundancy calculator successfully", () => {
    const out = ingestCitedStatutoryRateSeed([entry({})]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const calc = calculateStatutoryRedundancyPay(
      { ageAtDismissal: 35, yearsOfService: 5, weeklyPayGbp: 500, effectiveDate: "2024-09-01" },
      { ratesRegistry: out.registry },
    );
    expect(calc.ok).toBe(true);
  });

  it("registry from an empty seed still returns needs_verified_rate for any date (no production-ready claim)", () => {
    const out = ingestCitedStatutoryRateSeed([]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const calc = calculateStatutoryRedundancyPay(
      { ageAtDismissal: 35, yearsOfService: 5, weeklyPayGbp: 500, effectiveDate: "2024-09-01" },
      { ratesRegistry: out.registry },
    );
    expect(calc.ok).toBe(false);
    if (calc.ok) return;
    expect(calc.reason).toBe("needs_verified_rate");
  });
});

describe("ingestCitedStatutoryRateSeed — refuses missing citation metadata", () => {
  it("refuses an entry whose source_title is empty", () => {
    const out = ingestCitedStatutoryRateSeed([entry({ source_title: "" })]);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.perEntryFailures[0]?.reasons).toContain("missing_source_title");
  });

  it("refuses a non-https source_url", () => {
    const out = ingestCitedStatutoryRateSeed([entry({ source_url: "http://www.legislation.gov.uk/x" })]);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.perEntryFailures[0]?.reasons).toContain("source_url_not_https");
  });

  it("refuses a missing effective_from", () => {
    const out = ingestCitedStatutoryRateSeed([entry({ effective_from: "not-a-date" })]);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.perEntryFailures[0]?.reasons).toContain("effective_from_not_iso");
  });

  it("refuses missing verified_at", () => {
    const out = ingestCitedStatutoryRateSeed([entry({ verified_at: "" })]);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.perEntryFailures[0]?.reasons).toContain("missing_verified_at");
  });

  it("refuses untrusted source host", () => {
    const out = ingestCitedStatutoryRateSeed([entry({ source_url: "https://example.test/foo" })]);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.perEntryFailures[0]?.reasons).toContain("source_url_not_trusted_host");
  });

  it("refuses out-of-range trust score", () => {
    const out = ingestCitedStatutoryRateSeed([entry({ trust_score: 1.5 })]);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.perEntryFailures[0]?.reasons).toContain("trust_score_invalid");
  });
});

describe("ingestCitedStatutoryRateSeed — duplicate key handling", () => {
  it("refuses two entries with the same (jurisdiction, rate_type, effective_from)", () => {
    const out = ingestCitedStatutoryRateSeed([
      entry({}),
      entry({}),
    ]);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.perEntryFailures.some((f) => f.reasons.includes("duplicate_key"))).toBe(true);
  });

  it("two entries differing in effective_from are not duplicates (still validates ranges)", () => {
    const out = ingestCitedStatutoryRateSeed([
      entry({ effective_from: "2024-04-06", effective_to: "2025-04-05" }),
      entry({ effective_from: "2025-04-06", effective_to: "2026-04-05" }),
    ]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.accepted).toBe(2);
  });
});

describe("ingestCitedStatutoryRateSeed — overlap detection", () => {
  it("refuses overlapping windows on the same (jurisdiction, rate_type)", () => {
    const out = ingestCitedStatutoryRateSeed([
      entry({ effective_from: "2024-04-06", effective_to: "2026-04-05" }),
      entry({ effective_from: "2025-01-01", effective_to: "2027-01-01" }),
    ]);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.overlapPairs.length).toBeGreaterThan(0);
  });
});

describe("selectCapForDate — effective-date selection", () => {
  it("picks the entry whose window covers the date", () => {
    const out = ingestCitedStatutoryRateSeed([
      entry({ effective_from: "2024-04-06", effective_to: "2025-04-05", amount: 700 }),
      entry({ effective_from: "2025-04-06", effective_to: "2026-04-05", amount: 720 }),
    ]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const cap = selectCapForDate(out.registry, "2025-08-15");
    expect(cap?.amountGbp).toBe(720);
  });

  it("returns undefined when no entry covers the date", () => {
    const out = ingestCitedStatutoryRateSeed([entry({})]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(selectCapForDate(out.registry, "2030-01-01")).toBeUndefined();
  });

  it("returns undefined for a non-ISO date", () => {
    const out = ingestCitedStatutoryRateSeed([entry({})]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(selectCapForDate(out.registry, "tomorrow")).toBeUndefined();
  });
});
