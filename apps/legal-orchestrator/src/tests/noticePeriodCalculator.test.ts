import { describe, expect, it } from "vitest";

import { calculateStatutoryMinimumNotice } from "../legalRules/noticePeriodCalculator";

describe("calculateStatutoryMinimumNotice — employer_to_employee", () => {
  it("under 1 month → 0 weeks", () => {
    const out = calculateStatutoryMinimumNotice({ serviceMonths: 0.5, direction: "employer_to_employee" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.statutoryMinimumWeeks).toBe(0);
  });

  it("1 month to under 2 years → 1 week (lower boundary)", () => {
    const out = calculateStatutoryMinimumNotice({ serviceMonths: 1, direction: "employer_to_employee" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.statutoryMinimumWeeks).toBe(1);
  });

  it("1 month to under 2 years → 1 week (upper boundary; 23 months)", () => {
    const out = calculateStatutoryMinimumNotice({ serviceMonths: 23, direction: "employer_to_employee" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.statutoryMinimumWeeks).toBe(1);
  });

  it("2 years → 2 weeks", () => {
    const out = calculateStatutoryMinimumNotice({ serviceMonths: 24, direction: "employer_to_employee" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.statutoryMinimumWeeks).toBe(2);
    expect(out.fullYearsCounted).toBe(2);
  });

  it("5 years → 5 weeks", () => {
    const out = calculateStatutoryMinimumNotice({ serviceMonths: 60, direction: "employer_to_employee" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.statutoryMinimumWeeks).toBe(5);
  });

  it("12 years → 12 weeks", () => {
    const out = calculateStatutoryMinimumNotice({ serviceMonths: 144, direction: "employer_to_employee" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.statutoryMinimumWeeks).toBe(12);
  });

  it("20 years capped at 12 weeks with warning", () => {
    const out = calculateStatutoryMinimumNotice({ serviceMonths: 240, direction: "employer_to_employee" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.statutoryMinimumWeeks).toBe(12);
    expect(out.fullYearsCounted).toBe(20);
    expect(out.warnings.some((w) => w.includes("12 weeks"))).toBe(true);
  });

  it("uses full years only — fractional service does not bump notice", () => {
    const out = calculateStatutoryMinimumNotice({ serviceMonths: 35, direction: "employer_to_employee" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.fullYearsCounted).toBe(2);
    expect(out.statutoryMinimumWeeks).toBe(2);
  });
});

describe("calculateStatutoryMinimumNotice — employee_to_employer", () => {
  it("under 1 month → 0 weeks", () => {
    const out = calculateStatutoryMinimumNotice({ serviceMonths: 0.5, direction: "employee_to_employer" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.statutoryMinimumWeeks).toBe(0);
  });

  it("at or above 1 month → fixed 1 week regardless of years", () => {
    for (const months of [1, 6, 24, 120, 240]) {
      const out = calculateStatutoryMinimumNotice({ serviceMonths: months, direction: "employee_to_employer" });
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.statutoryMinimumWeeks).toBe(1);
    }
  });
});

describe("calculateStatutoryMinimumNotice — refusals", () => {
  it("rejects negative service", () => {
    const out = calculateStatutoryMinimumNotice({ serviceMonths: -1, direction: "employer_to_employee" });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("invalid_input");
    expect(out.violations).toContain("service_months_negative_or_not_finite");
  });

  it("rejects NaN service", () => {
    const out = calculateStatutoryMinimumNotice({ serviceMonths: Number.NaN, direction: "employer_to_employee" });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("invalid_input");
  });

  it("rejects invalid direction", () => {
    const out = calculateStatutoryMinimumNotice({ serviceMonths: 24, direction: "sideways" as unknown as "employer_to_employee" });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.violations).toContain("direction_invalid");
  });
});

describe("calculateStatutoryMinimumNotice — assumptions and reason codes", () => {
  it("every successful output includes statutory-minimum-only assumption", () => {
    const out = calculateStatutoryMinimumNotice({ serviceMonths: 24, direction: "employer_to_employee" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.assumptions.some((a) => a.includes("statutory MINIMUM only"))).toBe(true);
  });

  it("reason codes include band identifier", () => {
    const out = calculateStatutoryMinimumNotice({ serviceMonths: 24, direction: "employer_to_employee" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.reasonCodes.some((c) => c.startsWith("notice_calc:band:"))).toBe(true);
  });

  it("deterministic — same input yields same output", () => {
    const a = calculateStatutoryMinimumNotice({ serviceMonths: 60, direction: "employer_to_employee" });
    const b = calculateStatutoryMinimumNotice({ serviceMonths: 60, direction: "employer_to_employee" });
    expect(a).toEqual(b);
  });
});
