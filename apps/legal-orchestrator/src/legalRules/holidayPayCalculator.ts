// Sprint 38 — UK holiday pay calculator under the Working Time Regulations 1998.
//
// Pure deterministic function. No LLM. No DB. No network.
//
// Statutory basis (UK):
//   * Working Time Regulations 1998 (WTR) reg 13 + reg 13A → 5.6 weeks paid
//     annual leave for a full-time worker, pro-rated for part-time workers.
//   * WTR 1998 reg 15B (as amended for irregular-hours / part-year workers from
//     1 April 2024) → leave accrues at the rate of 12.07% of hours worked
//     in a pay period.
//   * 'A week's pay' for holiday pay purposes is governed by ERA 1996
//     ss221–224, supplemented by the Employment Rights (Amendment) Regulations
//     2020 which introduced the 52-week reference period for variable-pay
//     workers. This calculator does NOT attempt to compute average weekly pay
//     itself — the caller must supply the relevant `weeklyPayGbp` figure.
//
// The calculator returns STATUTORY MINIMUM only. Contractual leave / pay
// prevails if more generous. The calculator never asserts that the answer
// is final legal advice.

export type HolidayPayMode = "regular_hours" | "irregular_hours_or_part_year";

export interface HolidayPayInput {
  readonly mode: HolidayPayMode;
  /** Days the worker normally works each week (regular_hours mode). 1–7. */
  readonly daysPerWeek?: number;
  /**
   * Total hours worked in the pay period being accrued (irregular_hours mode).
   * Whole hours recommended.
   */
  readonly hoursWorkedInPeriod?: number;
  /**
   * Optional: caller-supplied 'a week's pay' figure (GBP). When provided,
   * the calculator computes statutory holiday PAY in addition to leave.
   * For variable-pay workers the caller MUST compute the 52-week reference
   * average elsewhere — this calculator does not estimate it.
   */
  readonly weeklyPayGbp?: number;
  /**
   * Optional: caller-supplied hourly rate (GBP) for irregular_hours mode.
   * Pay is computed as accruedHours × hourlyRate when both are present.
   */
  readonly hourlyRateGbp?: number;
  /**
   * Optional: how many of the last 52 weeks of variable pay history the caller
   * has on hand. The calculator emits a `needs_more_facts` warning if a
   * variable-pay worker is asked for pay with < 52 weeks of history.
   */
  readonly variablePayWeeksOfHistoryAvailable?: number;
}

export interface HolidayPayResult {
  readonly ok: true;
  readonly input: HolidayPayInput;
  readonly statutoryLeaveWeeks: number;
  readonly statutoryLeaveDays: number;
  readonly accruedHours?: number;
  readonly statutoryPayGbp?: number;
  readonly assumptions: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly riskMarker: "low" | "medium" | "needs_more_facts";
  readonly jurisdiction: "UK";
  readonly legalBasis: ReadonlyArray<{ readonly citation: string; readonly url: string }>;
  readonly reasonCodes: ReadonlyArray<string>;
}

export type HolidayPayRefusal =
  | {
      readonly ok: false;
      readonly reason: "invalid_input";
      readonly violations: ReadonlyArray<string>;
      readonly reasonCodes: ReadonlyArray<string>;
    }
  | {
      readonly ok: false;
      readonly reason: "needs_more_facts";
      readonly missing: ReadonlyArray<string>;
      readonly reasonCodes: ReadonlyArray<string>;
    };

export type HolidayPayOutcome = HolidayPayResult | HolidayPayRefusal;

const FULL_TIME_LEAVE_WEEKS = 5.6;
const FULL_TIME_DAYS_PER_WEEK = 5;
const STAT_MAX_LEAVE_DAYS = 28; // 5.6 × 5 = 28; statutory cap
const IRREGULAR_HOURS_ACCRUAL_RATE = 0.1207; // 12.07%

const LEGAL_BASIS = [
  {
    citation: "WTR 1998 reg 13",
    url: "https://www.legislation.gov.uk/uksi/1998/1833/regulation/13",
  },
  {
    citation: "WTR 1998 reg 13A",
    url: "https://www.legislation.gov.uk/uksi/1998/1833/regulation/13A",
  },
  {
    citation: "WTR 1998 reg 15B (irregular hours / part-year)",
    url: "https://www.legislation.gov.uk/uksi/1998/1833/regulation/15B",
  },
  {
    citation: "ERA 1996 ss221–224 (a week's pay)",
    url: "https://www.legislation.gov.uk/ukpga/1996/18/section/221",
  },
];

const COMMON_ASSUMPTIONS: ReadonlyArray<string> = [
  "Returns STATUTORY MINIMUM only. Contractual leave / pay prevails if more generous.",
  "Calculator does not compute the 52-week reference average for variable-pay workers; the caller must supply `weeklyPayGbp`.",
  "Calculator does not assess what counts as 'normal remuneration' under post-Bear Scotland authorities; the caller must include relevant elements.",
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateStatutoryHolidayPay(input: HolidayPayInput): HolidayPayOutcome {
  // ----------- Mode-agnostic validation ----------------------------------
  const violations: string[] = [];
  if (input.mode !== "regular_hours" && input.mode !== "irregular_hours_or_part_year") {
    violations.push("mode_invalid");
  }
  if (input.weeklyPayGbp !== undefined && (!Number.isFinite(input.weeklyPayGbp) || input.weeklyPayGbp < 0)) {
    violations.push("weekly_pay_invalid");
  }
  if (input.hourlyRateGbp !== undefined && (!Number.isFinite(input.hourlyRateGbp) || input.hourlyRateGbp < 0)) {
    violations.push("hourly_rate_invalid");
  }
  if (violations.length > 0) {
    return {
      ok: false,
      reason: "invalid_input",
      violations,
      reasonCodes: ["holiday_calc:invalid_input", ...violations.map((v) => `holiday_calc:${v}`)],
    };
  }

  if (input.mode === "regular_hours") {
    if (input.daysPerWeek === undefined) {
      return {
        ok: false,
        reason: "needs_more_facts",
        missing: ["daysPerWeek"],
        reasonCodes: ["holiday_calc:needs_more_facts", "holiday_calc:missing:daysPerWeek"],
      };
    }
    if (!Number.isFinite(input.daysPerWeek) || input.daysPerWeek < 1 || input.daysPerWeek > 7) {
      return {
        ok: false,
        reason: "invalid_input",
        violations: ["days_per_week_out_of_range"],
        reasonCodes: ["holiday_calc:invalid_input", "holiday_calc:days_per_week_out_of_range"],
      };
    }
    // Statutory leave in weeks is 5.6 regardless of days/week. Days = days/week × 5.6, capped at 28.
    const leaveDaysRaw = input.daysPerWeek * FULL_TIME_LEAVE_WEEKS;
    const leaveDays = Math.min(leaveDaysRaw, STAT_MAX_LEAVE_DAYS);
    const warnings: string[] = [];
    if (leaveDaysRaw > STAT_MAX_LEAVE_DAYS) {
      warnings.push(`Statutory leave capped at ${STAT_MAX_LEAVE_DAYS} days (WTR 1998 reg 13A).`);
    }
    let statutoryPayGbp: number | undefined;
    let riskMarker: "low" | "medium" | "needs_more_facts" = "low";
    if (input.weeklyPayGbp !== undefined) {
      if (
        input.variablePayWeeksOfHistoryAvailable !== undefined &&
        input.variablePayWeeksOfHistoryAvailable < 52
      ) {
        warnings.push(
          `Variable-pay reference period is < 52 weeks (caller reported ${input.variablePayWeeksOfHistoryAvailable}); weekly pay figure may not satisfy the 2020 Reference Period Regulations.`,
        );
        riskMarker = "needs_more_facts";
      }
      statutoryPayGbp = round2(FULL_TIME_LEAVE_WEEKS * input.weeklyPayGbp);
    }
    return {
      ok: true,
      input,
      statutoryLeaveWeeks: FULL_TIME_LEAVE_WEEKS,
      statutoryLeaveDays: round2(leaveDays),
      statutoryPayGbp,
      assumptions: COMMON_ASSUMPTIONS,
      warnings,
      riskMarker,
      jurisdiction: "UK",
      legalBasis: LEGAL_BASIS,
      reasonCodes: [
        "holiday_calc:ok",
        "holiday_calc:mode:regular_hours",
        `holiday_calc:days_per_week:${input.daysPerWeek}`,
        `holiday_calc:leave_days:${round2(leaveDays)}`,
      ],
    };
  }

  // irregular_hours_or_part_year
  if (input.hoursWorkedInPeriod === undefined) {
    return {
      ok: false,
      reason: "needs_more_facts",
      missing: ["hoursWorkedInPeriod"],
      reasonCodes: ["holiday_calc:needs_more_facts", "holiday_calc:missing:hoursWorkedInPeriod"],
    };
  }
  if (!Number.isFinite(input.hoursWorkedInPeriod) || input.hoursWorkedInPeriod < 0) {
    return {
      ok: false,
      reason: "invalid_input",
      violations: ["hours_worked_invalid"],
      reasonCodes: ["holiday_calc:invalid_input", "holiday_calc:hours_worked_invalid"],
    };
  }
  const accruedHours = round2(input.hoursWorkedInPeriod * IRREGULAR_HOURS_ACCRUAL_RATE);
  const warnings: string[] = [];
  let statutoryPayGbp: number | undefined;
  let riskMarker: "low" | "medium" | "needs_more_facts" = "low";
  if (input.hourlyRateGbp !== undefined) {
    statutoryPayGbp = round2(accruedHours * input.hourlyRateGbp);
  } else if (input.weeklyPayGbp !== undefined) {
    warnings.push(
      "weeklyPayGbp supplied in irregular_hours mode; for irregular-hours workers pay is normally computed as accruedHours × hourlyRate. Calculator did not compute a pay figure.",
    );
    riskMarker = "needs_more_facts";
  }
  return {
    ok: true,
    input,
    statutoryLeaveWeeks: FULL_TIME_LEAVE_WEEKS,
    statutoryLeaveDays: STAT_MAX_LEAVE_DAYS,
    accruedHours,
    statutoryPayGbp,
    assumptions: COMMON_ASSUMPTIONS,
    warnings,
    riskMarker,
    jurisdiction: "UK",
    legalBasis: LEGAL_BASIS,
    reasonCodes: [
      "holiday_calc:ok",
      "holiday_calc:mode:irregular_hours_or_part_year",
      `holiday_calc:accrued_hours:${accruedHours}`,
      `holiday_calc:rate:0.1207`,
    ],
  };
}
