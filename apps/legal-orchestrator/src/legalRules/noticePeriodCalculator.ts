// Sprint 33 — UK statutory minimum notice period calculator.
//
// Pure deterministic function. No LLM. No DB. No network.
//
// Implements ERA 1996 s86(1)(a)–(b) — the statutory minimum notice the
// employer must give the employee:
//
//   * Service < 1 month:              no statutory minimum notice.
//   * Service 1 month to < 2 years:   1 week.
//   * Service >= 2 years:             1 week per complete year of continuous
//                                     service, capped at 12 weeks (s86(1)(b)).
//   * Full years only (after the 2-year threshold).
//
// Refusal contract: invalid inputs (negative service, non-finite numbers,
// invalid direction) return `{ ok: false, reason: "invalid_input" }`.
//
// The calculator returns the STATUTORY MINIMUM only. If the employee's
// contract provides a longer notice period, the contract prevails; this
// calculator does not consume the contract value.

export type NoticeDirection = "employer_to_employee" | "employee_to_employer";

export interface NoticePeriodInput {
  /** Continuous service in months, as a number. Whole months recommended. */
  readonly serviceMonths: number;
  /**
   * Notice direction. ERA 1996 s86(1) governs employer-to-employee; s86(2)
   * governs employee-to-employer (fixed 1 week regardless of service, after
   * 1 month). Both are implemented.
   */
  readonly direction: NoticeDirection;
}

export interface NoticePeriodResult {
  readonly ok: true;
  readonly input: NoticePeriodInput;
  readonly statutoryMinimumWeeks: number;
  readonly fullYearsCounted: number;
  readonly assumptions: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly reasonCodes: ReadonlyArray<string>;
}

export type NoticePeriodRefusal = {
  readonly ok: false;
  readonly reason: "invalid_input";
  readonly violations: ReadonlyArray<string>;
  readonly reasonCodes: ReadonlyArray<string>;
};

export type NoticePeriodOutcome = NoticePeriodResult | NoticePeriodRefusal;

const MAX_WEEKS = 12;
const ONE_YEAR_IN_MONTHS = 12;
const TWO_YEARS_IN_MONTHS = 24;
const ONE_MONTH = 1;

export function calculateStatutoryMinimumNotice(input: NoticePeriodInput): NoticePeriodOutcome {
  const violations: string[] = [];
  if (!Number.isFinite(input.serviceMonths) || input.serviceMonths < 0) {
    violations.push("service_months_negative_or_not_finite");
  }
  if (input.direction !== "employer_to_employee" && input.direction !== "employee_to_employer") {
    violations.push("direction_invalid");
  }
  if (violations.length > 0) {
    return {
      ok: false,
      reason: "invalid_input",
      violations,
      reasonCodes: ["notice_calc:invalid_input", ...violations.map((v) => `notice_calc:${v}`)],
    };
  }

  const assumptions: string[] = [
    "Continuous service supplied directly; calculator does not assess interruption rules (ERA 1996 ss210–219).",
    "Returns statutory MINIMUM only — contract notice prevails if longer.",
  ];
  const warnings: string[] = [];
  const reasonCodes: string[] = ["notice_calc:ok"];

  if (input.direction === "employee_to_employer") {
    // ERA 1996 s86(2): 1 week's notice after 1 month's continuous employment,
    // regardless of length of service. Below 1 month: no statutory minimum.
    if (input.serviceMonths < ONE_MONTH) {
      reasonCodes.push("notice_calc:direction:employee_to_employer", "notice_calc:band:under_1_month");
      return {
        ok: true,
        input,
        statutoryMinimumWeeks: 0,
        fullYearsCounted: 0,
        assumptions,
        warnings,
        reasonCodes,
      };
    }
    reasonCodes.push("notice_calc:direction:employee_to_employer", "notice_calc:fixed_1_week_min");
    return {
      ok: true,
      input,
      statutoryMinimumWeeks: 1,
      fullYearsCounted: 0,
      assumptions,
      warnings,
      reasonCodes,
    };
  }

  // employer_to_employee
  if (input.serviceMonths < ONE_MONTH) {
    reasonCodes.push("notice_calc:band:under_1_month");
    return {
      ok: true,
      input,
      statutoryMinimumWeeks: 0,
      fullYearsCounted: 0,
      assumptions,
      warnings,
      reasonCodes,
    };
  }
  if (input.serviceMonths < TWO_YEARS_IN_MONTHS) {
    reasonCodes.push("notice_calc:band:1_month_to_under_2_years");
    return {
      ok: true,
      input,
      statutoryMinimumWeeks: 1,
      fullYearsCounted: 0,
      assumptions,
      warnings,
      reasonCodes,
    };
  }
  // >= 2 years: 1 week per complete year, cap 12.
  const fullYears = Math.floor(input.serviceMonths / ONE_YEAR_IN_MONTHS);
  const rawWeeks = fullYears;
  const cappedWeeks = Math.min(rawWeeks, MAX_WEEKS);
  if (rawWeeks > MAX_WEEKS) {
    warnings.push(`Statutory minimum notice capped at ${MAX_WEEKS} weeks (ERA 1996 s86(1)(b)).`);
  }
  reasonCodes.push("notice_calc:band:2_years_or_more", `notice_calc:full_years_counted:${fullYears}`);
  return {
    ok: true,
    input,
    statutoryMinimumWeeks: cappedWeeks,
    fullYearsCounted: fullYears,
    assumptions,
    warnings,
    reasonCodes,
  };
}
