// Deterministic UK statutory redundancy pay calculator.
//
// Formula (Employment Rights Act 1996 §162):
//   * 0.5 weeks' pay for each full year of service under age 22.
//   * 1.0 weeks' pay for each full year between 22 and 40 inclusive.
//   * 1.5 weeks' pay for each full year aged 41 or over.
//   * Service capped at 20 years (most recent years counted).
//   * Weekly pay capped at the statutory maximum at the effective date.
//   * Age computed at the start of each year of service.

import type { LegalRuleModule } from "../ruleModule.types";

export interface RedundancyCalcInput {
  date_of_birth_iso: string;
  employment_start_iso: string;
  effective_date_iso: string; // date redundancy takes effect
  gross_weekly_pay: number;
  weekly_pay_cap?: number; // optional override; defaults to 700 (placeholder)
}

export interface RedundancyCalcOutput {
  weeks_due: number;
  capped_weekly_pay: number;
  total_payable: number;
  years_counted: number;
  age_at_effective_date: number;
}

const SERVICE_YEAR_CAP = 20;
const DEFAULT_WEEKLY_PAY_CAP = 700; // GBP — caller should pass the live cap

function parseDate(iso: string): Date {
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid ISO date: ${iso}`);
  }
  return d;
}

function fullYearsBetween(start: Date, end: Date): number {
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  const m = end.getUTCMonth() - start.getUTCMonth();
  if (m < 0 || (m === 0 && end.getUTCDate() < start.getUTCDate())) {
    years -= 1;
  }
  return Math.max(0, years);
}

function ageOnDate(dob: Date, on: Date): number {
  return fullYearsBetween(dob, on);
}

function roundCurrency(n: number): number {
  return Math.round(n * 100) / 100;
}

export const redundancyCalculator: LegalRuleModule<RedundancyCalcInput, RedundancyCalcOutput> = {
  id: "redundancy_calculator",
  wasmPath: "redundancy_calculator.wasm",

  validateInput(input: unknown): RedundancyCalcInput {
    if (!input || typeof input !== "object") {
      throw new Error("redundancyCalculator: input must be an object");
    }
    const r = input as Record<string, unknown>;
    const required = [
      "date_of_birth_iso",
      "employment_start_iso",
      "effective_date_iso",
      "gross_weekly_pay",
    ];
    for (const k of required) {
      if (r[k] === undefined || r[k] === null || r[k] === "") {
        throw new Error(`redundancyCalculator: missing required input '${k}'`);
      }
    }
    if (typeof r.date_of_birth_iso !== "string") {
      throw new Error("redundancyCalculator: date_of_birth_iso must be a string");
    }
    if (typeof r.employment_start_iso !== "string") {
      throw new Error("redundancyCalculator: employment_start_iso must be a string");
    }
    if (typeof r.effective_date_iso !== "string") {
      throw new Error("redundancyCalculator: effective_date_iso must be a string");
    }
    if (typeof r.gross_weekly_pay !== "number" || !Number.isFinite(r.gross_weekly_pay) || r.gross_weekly_pay < 0) {
      throw new Error("redundancyCalculator: gross_weekly_pay must be a non-negative number");
    }
    if (r.weekly_pay_cap !== undefined) {
      if (typeof r.weekly_pay_cap !== "number" || !Number.isFinite(r.weekly_pay_cap) || r.weekly_pay_cap < 0) {
        throw new Error("redundancyCalculator: weekly_pay_cap must be a non-negative number");
      }
    }

    const dob = parseDate(r.date_of_birth_iso);
    const start = parseDate(r.employment_start_iso);
    const eff = parseDate(r.effective_date_iso);
    if (start.getTime() < dob.getTime()) {
      throw new Error("redundancyCalculator: employment_start_iso is before date_of_birth_iso");
    }
    if (eff.getTime() < start.getTime()) {
      throw new Error("redundancyCalculator: effective_date_iso is before employment_start_iso");
    }
    return {
      date_of_birth_iso: r.date_of_birth_iso,
      employment_start_iso: r.employment_start_iso,
      effective_date_iso: r.effective_date_iso,
      gross_weekly_pay: r.gross_weekly_pay,
      weekly_pay_cap: r.weekly_pay_cap as number | undefined,
    };
  },

  fallback(input: RedundancyCalcInput): RedundancyCalcOutput {
    const dob = parseDate(input.date_of_birth_iso);
    const start = parseDate(input.employment_start_iso);
    const eff = parseDate(input.effective_date_iso);
    const totalServiceYears = Math.min(fullYearsBetween(start, eff), SERVICE_YEAR_CAP);

    // Walk back from the effective date, year by year, applying the
    // age-banded multiplier for the age at the start of each year of
    // service. This matches the statutory "most recent years count first".
    let weeks = 0;
    for (let i = 0; i < totalServiceYears; i++) {
      const yearStart = new Date(eff.getTime());
      yearStart.setUTCFullYear(yearStart.getUTCFullYear() - (i + 1));
      const ageThatYear = ageOnDate(dob, yearStart);
      let multiplier: number;
      if (ageThatYear < 22) multiplier = 0.5;
      else if (ageThatYear <= 40) multiplier = 1.0;
      else multiplier = 1.5;
      weeks += multiplier;
    }

    const cap = input.weekly_pay_cap ?? DEFAULT_WEEKLY_PAY_CAP;
    const cappedWeeklyPay = Math.min(input.gross_weekly_pay, cap);
    const total = roundCurrency(weeks * cappedWeeklyPay);

    return {
      weeks_due: weeks,
      capped_weekly_pay: roundCurrency(cappedWeeklyPay),
      total_payable: total,
      years_counted: totalServiceYears,
      age_at_effective_date: ageOnDate(dob, eff),
    };
  },

  summarise(output: RedundancyCalcOutput): string {
    return `redundancy_calculator:weeks=${output.weeks_due}:years=${output.years_counted}:total=${output.total_payable}`;
  },
};
