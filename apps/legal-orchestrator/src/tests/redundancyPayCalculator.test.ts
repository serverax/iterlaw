import { describe, expect, it } from "vitest";

import { calculateStatutoryRedundancyPay } from "../legalRules/redundancyPayCalculator";
import type { StatutoryRatesRegistry } from "../legalRules/statutoryRates";

// Test-only rate registry. The production registry ships EMPTY by design; this
// fixture exists purely to exercise the calculator's arithmetic. The cap value
// is illustrative only and is documented in the test, not in product code.
const TEST_REGISTRY: StatutoryRatesRegistry = {
  weeklyPayCaps: [
    {
      effectiveFrom: "2024-04-06",
      effectiveTo: "2025-04-05",
      amountGbp: 700,
      source: "https://www.legislation.gov.uk/uksi/2024/test/fixture",
      citationLabel: "Test fixture — illustrative only",
    },
  ],
};

const VALID_INPUT = {
  ageAtDismissal: 35,
  yearsOfService: 10,
  weeklyPayGbp: 500,
  effectiveDate: "2024-09-01",
};

describe("calculateStatutoryRedundancyPay — refusals", () => {
  it("returns needs_verified_rate when registry has no cap for the date", () => {
    const out = calculateStatutoryRedundancyPay(VALID_INPUT, {
      ratesRegistry: { weeklyPayCaps: [] },
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("needs_verified_rate");
    expect(out.reasonCodes).toContain("redundancy_calc:needs_verified_rate");
  });

  it("returns needs_verified_rate when the date is outside every entry's window", () => {
    const out = calculateStatutoryRedundancyPay(
      { ...VALID_INPUT, effectiveDate: "2020-01-01" },
      { ratesRegistry: TEST_REGISTRY },
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("needs_verified_rate");
  });

  it("rejects age below minimum working age", () => {
    const out = calculateStatutoryRedundancyPay(
      { ...VALID_INPUT, ageAtDismissal: 15 },
      { ratesRegistry: TEST_REGISTRY },
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("invalid_input");
    expect(out.violations).toContain("age_below_minimum_working_age");
  });

  it("rejects negative years of service", () => {
    const out = calculateStatutoryRedundancyPay(
      { ...VALID_INPUT, yearsOfService: -1 },
      { ratesRegistry: TEST_REGISTRY },
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("invalid_input");
    expect(out.violations).toContain("years_of_service_negative");
  });

  it("rejects zero or negative weekly pay", () => {
    const zero = calculateStatutoryRedundancyPay(
      { ...VALID_INPUT, weeklyPayGbp: 0 },
      { ratesRegistry: TEST_REGISTRY },
    );
    expect(zero.ok).toBe(false);
    if (zero.ok) return;
    expect(zero.violations).toContain("weekly_pay_not_positive");

    const neg = calculateStatutoryRedundancyPay(
      { ...VALID_INPUT, weeklyPayGbp: -100 },
      { ratesRegistry: TEST_REGISTRY },
    );
    expect(neg.ok).toBe(false);
  });

  it("rejects non-ISO effective date", () => {
    const out = calculateStatutoryRedundancyPay(
      { ...VALID_INPUT, effectiveDate: "tomorrow" as string },
      { ratesRegistry: TEST_REGISTRY },
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("invalid_input");
    expect(out.violations).toContain("effective_date_not_iso_date");
  });
});

describe("calculateStatutoryRedundancyPay — arithmetic", () => {
  it("35-year-old, 10 years service, £500 weekly pay → 10 × 1.0 = 10 weeks × £500 = £5000", () => {
    const out = calculateStatutoryRedundancyPay(VALID_INPUT, { ratesRegistry: TEST_REGISTRY });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.cappedYearsOfService).toBe(10);
    expect(out.totalWeeks).toBe(10);
    expect(out.cappedWeeklyPayGbp).toBe(500);
    expect(out.totalStatutoryPayGbp).toBe(5000);
    expect(out.ageBandBreakdown).toEqual({
      yearsAtBand_under22: 0,
      yearsAtBand_22_to_40: 10,
      yearsAtBand_41_plus: 0,
    });
  });

  it("45-year-old, 10 years service: 5 years at 41+ band (1.5w each) + 5 years at 22-40 band (1w each) = 12.5 weeks", () => {
    // Walking back from age 45: years at age 45, 44, 43, 42, 41 = 5 × 1.5 = 7.5
    // then age 40, 39, 38, 37, 36 = 5 × 1.0 = 5.0; total = 12.5 weeks.
    const out = calculateStatutoryRedundancyPay(
      { ageAtDismissal: 45, yearsOfService: 10, weeklyPayGbp: 600, effectiveDate: "2024-09-01" },
      { ratesRegistry: TEST_REGISTRY },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.totalWeeks).toBe(12.5);
    expect(out.ageBandBreakdown.yearsAtBand_41_plus).toBe(5);
    expect(out.ageBandBreakdown.yearsAtBand_22_to_40).toBe(5);
    expect(out.totalStatutoryPayGbp).toBe(12.5 * 600);
  });

  it("21-year-old, 4 years service: all under-22 band (0.5 weeks each) = 2 weeks", () => {
    // Walking back from age 21: ages 21, 20, 19, 18 → all < 22 → 0.5 each → 2 weeks.
    const out = calculateStatutoryRedundancyPay(
      { ageAtDismissal: 21, yearsOfService: 4, weeklyPayGbp: 400, effectiveDate: "2024-09-01" },
      { ratesRegistry: TEST_REGISTRY },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.totalWeeks).toBe(2);
    expect(out.ageBandBreakdown.yearsAtBand_under22).toBe(4);
    expect(out.totalStatutoryPayGbp).toBe(2 * 400);
  });

  it("caps years of service at 20 even when input is 30", () => {
    const out = calculateStatutoryRedundancyPay(
      { ageAtDismissal: 60, yearsOfService: 30, weeklyPayGbp: 500, effectiveDate: "2024-09-01" },
      { ratesRegistry: TEST_REGISTRY },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.cappedYearsOfService).toBe(20);
    expect(out.warnings.some((w) => w.includes("capped at 20"))).toBe(true);
  });

  it("caps weekly pay at statutory cap and emits a warning", () => {
    const out = calculateStatutoryRedundancyPay(
      { ageAtDismissal: 50, yearsOfService: 5, weeklyPayGbp: 1500, effectiveDate: "2024-09-01" },
      { ratesRegistry: TEST_REGISTRY },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.cappedWeeklyPayGbp).toBe(700);
    expect(out.warnings.some((w) => w.includes("statutory weekly-pay cap"))).toBe(true);
    // 50, 49, 48, 47, 46 all 41+ → 5 × 1.5 = 7.5 weeks × £700 = £5250
    expect(out.totalWeeks).toBe(7.5);
    expect(out.totalStatutoryPayGbp).toBe(5250);
  });

  it("truncates fractional years to full years", () => {
    const out = calculateStatutoryRedundancyPay(
      { ageAtDismissal: 30, yearsOfService: 3.9, weeklyPayGbp: 400, effectiveDate: "2024-09-01" },
      { ratesRegistry: TEST_REGISTRY },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.cappedYearsOfService).toBe(3);
    expect(out.warnings.some((w) => w.includes("full years"))).toBe(true);
  });

  it("includes the source citation in the result", () => {
    const out = calculateStatutoryRedundancyPay(VALID_INPUT, { ratesRegistry: TEST_REGISTRY });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.source.source).toBe("https://www.legislation.gov.uk/uksi/2024/test/fixture");
    expect(out.reasonCodes.some((r) => r.startsWith("redundancy_calc:cap_source:"))).toBe(true);
  });

  it("zero years of service returns 0 pay (boundary)", () => {
    const out = calculateStatutoryRedundancyPay(
      { ageAtDismissal: 35, yearsOfService: 0, weeklyPayGbp: 500, effectiveDate: "2024-09-01" },
      { ratesRegistry: TEST_REGISTRY },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.cappedYearsOfService).toBe(0);
    expect(out.totalWeeks).toBe(0);
    expect(out.totalStatutoryPayGbp).toBe(0);
  });

  it("a worker whose age-walk would drop below the working-age stops the walk", () => {
    // ageAtDismissal=18, yearsOfService=4 → walk back i=0..3, ages 18,17,16,15.
    // age 15 < 16 (working-age floor) → year-3 is not counted.
    const out = calculateStatutoryRedundancyPay(
      { ageAtDismissal: 18, yearsOfService: 4, weeklyPayGbp: 400, effectiveDate: "2024-09-01" },
      { ratesRegistry: TEST_REGISTRY },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.ageBandBreakdown.yearsAtBand_under22).toBe(3);
    expect(out.totalWeeks).toBe(1.5);
  });
});
