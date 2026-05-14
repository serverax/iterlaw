import { describe, expect, it } from "vitest";

import {
  CITED_RATES_SEED,
  citedToStatutoryWeeklyPayCap,
  validateCitedRateEntry,
  validateNoOverlappingRanges,
  type CitedStatutoryRateEntry,
} from "../legalRules/statutoryRateSources";
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

describe("CITED_RATES_SEED — production seed", () => {
  it("ships EMPTY by design (no fabricated rate values in product code)", () => {
    expect(CITED_RATES_SEED).toEqual([]);
  });
});

describe("validateCitedRateEntry", () => {
  it("accepts a fully-populated entry from a trusted host", () => {
    expect(validateCitedRateEntry(entry({})).ok).toBe(true);
  });

  it("rejects an entry with missing source_title", () => {
    const v = validateCitedRateEntry(entry({ source_title: "" }));
    expect(v.ok).toBe(false);
    expect(v.failures).toContain("missing_source_title");
  });

  it("rejects an entry with a non-https URL", () => {
    const v = validateCitedRateEntry(entry({ source_url: "http://www.legislation.gov.uk/x" }));
    expect(v.ok).toBe(false);
    expect(v.failures).toContain("source_url_not_https");
  });

  it("rejects an entry from an untrusted host", () => {
    const v = validateCitedRateEntry(entry({ source_url: "https://random.example.com/x" }));
    expect(v.ok).toBe(false);
    expect(v.failures).toContain("source_url_not_trusted_host");
  });

  it("rejects amount <= 0", () => {
    const v = validateCitedRateEntry(entry({ amount: 0 }));
    expect(v.ok).toBe(false);
    expect(v.failures).toContain("amount_not_positive");
  });

  it("rejects trust_score out of range", () => {
    for (const ts of [0, -0.1, 1.1, Number.NaN]) {
      const v = validateCitedRateEntry(entry({ trust_score: ts }));
      expect(v.ok).toBe(false);
      expect(v.failures).toContain("trust_score_invalid");
    }
  });

  it("rejects inverted effective window", () => {
    const v = validateCitedRateEntry(entry({ effective_from: "2025-01-01", effective_to: "2024-01-01" }));
    expect(v.ok).toBe(false);
    expect(v.failures).toContain("effective_window_inverted");
  });

  it("rejects non-ISO verified_at", () => {
    const v = validateCitedRateEntry(entry({ verified_at: "yesterday" }));
    expect(v.ok).toBe(false);
    expect(v.failures).toContain("verified_at_not_iso");
  });
});

describe("validateNoOverlappingRanges", () => {
  it("ok when entries do not overlap", () => {
    const a = entry({ effective_from: "2024-04-06", effective_to: "2025-04-05" });
    const b = entry({ effective_from: "2025-04-06", effective_to: "2026-04-05" });
    const v = validateNoOverlappingRanges([a, b]);
    expect(v.ok).toBe(true);
  });

  it("flags overlapping windows on the same jurisdiction + rate_type", () => {
    const a = entry({ effective_from: "2024-04-06", effective_to: "2025-04-05" });
    const b = entry({ effective_from: "2025-01-01", effective_to: "2026-04-05" });
    const v = validateNoOverlappingRanges([a, b]);
    expect(v.ok).toBe(false);
    expect(v.overlaps[0]).toEqual({ first: 0, second: 1 });
  });

  it("treats null effective_to as open-ended", () => {
    const a = entry({ effective_from: "2024-04-06", effective_to: null });
    const b = entry({ effective_from: "2025-01-01", effective_to: "2026-04-05" });
    const v = validateNoOverlappingRanges([a, b]);
    expect(v.ok).toBe(false);
  });

  it("ignores entries on different jurisdictions", () => {
    const a = entry({ jurisdiction: "UK_ENGLAND_WALES" });
    const b = entry({ jurisdiction: "UK_SCOTLAND" });
    const v = validateNoOverlappingRanges([a, b]);
    expect(v.ok).toBe(true);
  });
});

describe("citedToStatutoryWeeklyPayCap → calculator integration", () => {
  it("returns a calculator-shaped cap from a valid cited entry", () => {
    const out = citedToStatutoryWeeklyPayCap(entry({}));
    expect("ok" in out && out.ok === false).toBe(false);
    if ("ok" in out && out.ok === false) return;
    // Use the transformed entry to drive the redundancy calculator.
    const calc = calculateStatutoryRedundancyPay(
      { ageAtDismissal: 35, yearsOfService: 5, weeklyPayGbp: 500, effectiveDate: "2024-09-01" },
      { ratesRegistry: { weeklyPayCaps: [out] } },
    );
    expect(calc.ok).toBe(true);
  });

  it("refuses to transform an invalid entry", () => {
    const out = citedToStatutoryWeeklyPayCap(entry({ source_url: "ftp://x" }));
    expect("ok" in out && out.ok === false).toBe(true);
  });

  it("with the production seed (empty) the calculator returns needs_verified_rate", () => {
    const calc = calculateStatutoryRedundancyPay(
      { ageAtDismissal: 35, yearsOfService: 5, weeklyPayGbp: 500, effectiveDate: "2024-09-01" },
      { ratesRegistry: { weeklyPayCaps: [] } },
    );
    expect(calc.ok).toBe(false);
    if (calc.ok) return;
    expect(calc.reason).toBe("needs_verified_rate");
  });
});
