import { describe, expect, it } from "vitest";

import { calculateStatutoryHolidayPay } from "../legalRules/holidayPayCalculator";

describe("calculateStatutoryHolidayPay — regular_hours mode", () => {
  it("5-day-a-week worker → 5.6 weeks / 28 days (statutory cap)", () => {
    const out = calculateStatutoryHolidayPay({ mode: "regular_hours", daysPerWeek: 5 });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.statutoryLeaveWeeks).toBe(5.6);
    expect(out.statutoryLeaveDays).toBe(28);
    expect(out.warnings).toEqual([]);
  });

  it("3-day-a-week part-time worker → 5.6 weeks / 16.8 days", () => {
    const out = calculateStatutoryHolidayPay({ mode: "regular_hours", daysPerWeek: 3 });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.statutoryLeaveDays).toBe(16.8);
  });

  it("6-day-a-week worker → capped at 28 days with warning", () => {
    const out = calculateStatutoryHolidayPay({ mode: "regular_hours", daysPerWeek: 6 });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.statutoryLeaveDays).toBe(28);
    expect(out.warnings.some((w) => w.includes("capped at 28"))).toBe(true);
  });

  it("with weeklyPayGbp supplied → pay = 5.6 × weeklyPay", () => {
    const out = calculateStatutoryHolidayPay({
      mode: "regular_hours",
      daysPerWeek: 5,
      weeklyPayGbp: 500,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.statutoryPayGbp).toBe(2800);
    expect(out.riskMarker).toBe("low");
  });

  it("variable-pay history < 52 weeks → riskMarker needs_more_facts + warning", () => {
    const out = calculateStatutoryHolidayPay({
      mode: "regular_hours",
      daysPerWeek: 5,
      weeklyPayGbp: 500,
      variablePayWeeksOfHistoryAvailable: 12,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.riskMarker).toBe("needs_more_facts");
    expect(out.warnings.some((w) => w.includes("< 52 weeks"))).toBe(true);
  });
});

describe("calculateStatutoryHolidayPay — irregular_hours mode", () => {
  it("100 hours worked → 12.07 hours accrued", () => {
    const out = calculateStatutoryHolidayPay({
      mode: "irregular_hours_or_part_year",
      hoursWorkedInPeriod: 100,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.accruedHours).toBe(12.07);
  });

  it("with hourlyRateGbp supplied → pay = accrued × hourlyRate", () => {
    const out = calculateStatutoryHolidayPay({
      mode: "irregular_hours_or_part_year",
      hoursWorkedInPeriod: 100,
      hourlyRateGbp: 12,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.statutoryPayGbp).toBe(round2(12.07 * 12));
  });

  it("with weeklyPayGbp supplied in irregular mode → warns + raises risk", () => {
    const out = calculateStatutoryHolidayPay({
      mode: "irregular_hours_or_part_year",
      hoursWorkedInPeriod: 100,
      weeklyPayGbp: 500,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.statutoryPayGbp).toBeUndefined();
    expect(out.riskMarker).toBe("needs_more_facts");
    expect(out.warnings.some((w) => w.toLowerCase().includes("weeklypaygbp supplied in irregular_hours mode"))).toBe(true);
  });

  it("0 hours → 0 accrued", () => {
    const out = calculateStatutoryHolidayPay({
      mode: "irregular_hours_or_part_year",
      hoursWorkedInPeriod: 0,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.accruedHours).toBe(0);
  });
});

describe("calculateStatutoryHolidayPay — refusals", () => {
  it("regular_hours mode without daysPerWeek → needs_more_facts", () => {
    const out = calculateStatutoryHolidayPay({ mode: "regular_hours" });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("needs_more_facts");
    expect(out.reasonCodes).toContain("holiday_calc:missing:daysPerWeek");
  });

  it("irregular_hours mode without hoursWorkedInPeriod → needs_more_facts", () => {
    const out = calculateStatutoryHolidayPay({ mode: "irregular_hours_or_part_year" });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("needs_more_facts");
    expect(out.reasonCodes).toContain("holiday_calc:missing:hoursWorkedInPeriod");
  });

  it("invalid daysPerWeek (0 or 8) → invalid_input", () => {
    for (const days of [0, 8]) {
      const out = calculateStatutoryHolidayPay({ mode: "regular_hours", daysPerWeek: days });
      expect(out.ok).toBe(false);
      if (out.ok) return;
      expect(out.reason).toBe("invalid_input");
    }
  });

  it("negative hours → invalid_input", () => {
    const out = calculateStatutoryHolidayPay({
      mode: "irregular_hours_or_part_year",
      hoursWorkedInPeriod: -1,
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("invalid_input");
  });

  it("invalid mode → invalid_input", () => {
    const out = calculateStatutoryHolidayPay({
      mode: "made_up_mode" as unknown as "regular_hours",
      daysPerWeek: 5,
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("invalid_input");
  });

  it("negative weeklyPay or hourlyRate → invalid_input", () => {
    const a = calculateStatutoryHolidayPay({
      mode: "regular_hours",
      daysPerWeek: 5,
      weeklyPayGbp: -100,
    });
    expect(a.ok).toBe(false);
    const b = calculateStatutoryHolidayPay({
      mode: "irregular_hours_or_part_year",
      hoursWorkedInPeriod: 50,
      hourlyRateGbp: -5,
    });
    expect(b.ok).toBe(false);
  });
});

describe("calculateStatutoryHolidayPay — assumptions + legal basis + jurisdiction", () => {
  it("includes statutory-minimum-only assumption", () => {
    const out = calculateStatutoryHolidayPay({ mode: "regular_hours", daysPerWeek: 5 });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.assumptions.some((a) => a.toLowerCase().includes("statutory minimum only"))).toBe(true);
  });

  it("legalBasis includes WTR 1998 reg 13 and ERA 1996 ss221-224", () => {
    const out = calculateStatutoryHolidayPay({ mode: "regular_hours", daysPerWeek: 5 });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.legalBasis.some((b) => b.citation.includes("WTR 1998 reg 13"))).toBe(true);
    expect(out.legalBasis.some((b) => b.citation.includes("ERA 1996 ss221"))).toBe(true);
  });

  it("jurisdiction marker is UK", () => {
    const out = calculateStatutoryHolidayPay({ mode: "regular_hours", daysPerWeek: 5 });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.jurisdiction).toBe("UK");
  });

  it("deterministic — same input yields same output", () => {
    const a = calculateStatutoryHolidayPay({ mode: "regular_hours", daysPerWeek: 4, weeklyPayGbp: 400 });
    const b = calculateStatutoryHolidayPay({ mode: "regular_hours", daysPerWeek: 4, weeklyPayGbp: 400 });
    expect(a).toEqual(b);
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
