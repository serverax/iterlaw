// Sprint 21 — UK statutory redundancy pay calculator (deterministic).
//
// Pure function. No LLM. No DB. No network.
//
// Implements ERA 1996 s162 redundancy pay calculation:
//   * Age band rule for each full year of service:
//       - aged 41+ during that year         → 1.5 week's pay
//       - aged 22–40 (inclusive) during that year → 1.0 week's pay
//       - aged under 22 during that year    → 0.5 week's pay
//   * Maximum 20 years of service counted (ERA 1996 s162(3)).
//   * Weekly pay capped at the statutory weekly-pay cap (ERA 1996 s227) that
//     was in force at the effective date of dismissal.
//   * Only full years of service count (s162(1)).
//
// Refusal contract (ERA 1996 forbids unsourced legal answers in IterLaw):
//   - If the statutory weekly-pay cap for the supplied `effectiveDate` is not
//     present in the supplied rates registry, the calculator returns
//     `{ ok: false, reason: "needs_verified_rate", ... }` and refuses to guess.
//
// Age-walk convention (documented):
//   The age applied to year-i (0 = most-recent year, N-1 = oldest) is
//   `ageAtDismissal - i`. This counts the age the worker reached during that
//   year — the conservative reading of s162(2) consistent with the GOV.UK
//   redundancy pay calculator on the dates this implementation matches.

import {
  findStatutoryWeeklyPayCap,
  type StatutoryRatesRegistry,
  type StatutoryWeeklyPayCapEntry,
} from "./statutoryRates";

export interface RedundancyPayInput {
  /** Worker's age at the effective date of dismissal. Whole years. */
  readonly ageAtDismissal: number;
  /** Years of continuous service (decimal allowed; truncated to full years internally). */
  readonly yearsOfService: number;
  /** Worker's weekly pay in GBP (whole pounds or fractional — the cap is applied before rounding). */
  readonly weeklyPayGbp: number;
  /** ISO date of the effective date of dismissal — controls which cap applies. */
  readonly effectiveDate: string;
}

export interface RedundancyPayAgeBandBreakdown {
  readonly yearsAtBand_under22: number;
  readonly yearsAtBand_22_to_40: number;
  readonly yearsAtBand_41_plus: number;
}

export interface RedundancyPayResult {
  readonly ok: true;
  readonly input: RedundancyPayInput;
  readonly capAppliedGbp: number;
  readonly cappedWeeklyPayGbp: number;
  readonly cappedYearsOfService: number;
  readonly ageBandBreakdown: RedundancyPayAgeBandBreakdown;
  readonly totalWeeks: number;
  readonly totalStatutoryPayGbp: number;
  readonly source: StatutoryWeeklyPayCapEntry;
  readonly assumptions: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly reasonCodes: ReadonlyArray<string>;
}

export type RedundancyPayRefusal =
  | {
      readonly ok: false;
      readonly reason: "needs_verified_rate";
      readonly missingFor: string;
      readonly reasonCodes: ReadonlyArray<string>;
    }
  | {
      readonly ok: false;
      readonly reason: "invalid_input";
      readonly violations: ReadonlyArray<string>;
      readonly reasonCodes: ReadonlyArray<string>;
    };

export type RedundancyPayOutcome = RedundancyPayResult | RedundancyPayRefusal;

export interface RedundancyPayOptions {
  readonly ratesRegistry: StatutoryRatesRegistry;
}

const MIN_WORKING_AGE = 16;
const MAX_COUNTED_YEARS = 20;

export function calculateStatutoryRedundancyPay(
  input: RedundancyPayInput,
  opts: RedundancyPayOptions,
): RedundancyPayOutcome {
  // ----------- Validation ----------------------------------------------------
  const violations: string[] = [];
  if (!Number.isFinite(input.ageAtDismissal) || input.ageAtDismissal < MIN_WORKING_AGE) {
    violations.push("age_below_minimum_working_age");
  }
  if (!Number.isFinite(input.yearsOfService) || input.yearsOfService < 0) {
    violations.push("years_of_service_negative");
  }
  if (!Number.isFinite(input.weeklyPayGbp) || input.weeklyPayGbp <= 0) {
    violations.push("weekly_pay_not_positive");
  }
  if (typeof input.effectiveDate !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(input.effectiveDate)) {
    violations.push("effective_date_not_iso_date");
  }
  if (violations.length > 0) {
    return {
      ok: false,
      reason: "invalid_input",
      violations,
      reasonCodes: ["redundancy_calc:invalid_input", ...violations.map((v) => `redundancy_calc:${v}`)],
    };
  }

  // ----------- Rate sourcing -------------------------------------------------
  const cap = findStatutoryWeeklyPayCap(opts.ratesRegistry, input.effectiveDate);
  if (!cap) {
    return {
      ok: false,
      reason: "needs_verified_rate",
      missingFor: input.effectiveDate,
      reasonCodes: [
        "redundancy_calc:needs_verified_rate",
        `redundancy_calc:no_cap_for_effective_date:${input.effectiveDate}`,
      ],
    };
  }

  // ----------- Core calculation ---------------------------------------------
  const fullYears = Math.floor(input.yearsOfService);
  const cappedYears = Math.min(fullYears, MAX_COUNTED_YEARS);
  const cappedWeeklyPay = Math.min(input.weeklyPayGbp, cap.amountGbp);

  const breakdown: { under22: number; band22_40: number; band41plus: number } = {
    under22: 0,
    band22_40: 0,
    band41plus: 0,
  };
  let totalWeeks = 0;

  for (let i = 0; i < cappedYears; i += 1) {
    const ageDuringYear = input.ageAtDismissal - i;
    if (ageDuringYear >= 41) {
      breakdown.band41plus += 1;
      totalWeeks += 1.5;
    } else if (ageDuringYear >= 22) {
      breakdown.band22_40 += 1;
      totalWeeks += 1.0;
    } else if (ageDuringYear >= MIN_WORKING_AGE) {
      breakdown.under22 += 1;
      totalWeeks += 0.5;
    } else {
      // Pre-working-age years cannot count toward service. Stop the walk.
      break;
    }
  }

  // Round to two decimal places using bank-safe arithmetic.
  const totalStatutoryPayGbp = Math.round(totalWeeks * cappedWeeklyPay * 100) / 100;

  // ----------- Warnings + assumptions ---------------------------------------
  const warnings: string[] = [];
  if (fullYears > MAX_COUNTED_YEARS) {
    warnings.push(`Years of service capped at ${MAX_COUNTED_YEARS} (ERA 1996 s162(3)).`);
  }
  if (input.weeklyPayGbp > cap.amountGbp) {
    warnings.push(
      `Weekly pay capped at the statutory weekly-pay cap of £${cap.amountGbp} (effective ${cap.effectiveFrom} to ${cap.effectiveTo ?? "open"}).`,
    );
  }
  if (input.yearsOfService !== fullYears) {
    warnings.push("Years of service truncated to full years (ERA 1996 s162(1)).");
  }

  const assumptions: string[] = [
    "Continuous-service definition assumed; no statutory exclusions applied (e.g. fixed-term renewal interruption).",
    "Age applied to year-i (0 = most recent) = ageAtDismissal - i; conservative reading of ERA 1996 s162(2).",
    "Weekly pay used is the figure supplied by the caller; calculator does not assess whether it is a 'week's pay' under ERA 1996 s221–s229.",
  ];

  const reasonCodes: string[] = [
    "redundancy_calc:ok",
    `redundancy_calc:effective_date:${input.effectiveDate}`,
    `redundancy_calc:counted_years:${cappedYears}`,
    `redundancy_calc:cap_source:${cap.source}`,
    `redundancy_calc:age_band:under22:${breakdown.under22}`,
    `redundancy_calc:age_band:22_to_40:${breakdown.band22_40}`,
    `redundancy_calc:age_band:41_plus:${breakdown.band41plus}`,
  ];

  return {
    ok: true,
    input,
    capAppliedGbp: cap.amountGbp,
    cappedWeeklyPayGbp: cappedWeeklyPay,
    cappedYearsOfService: cappedYears,
    ageBandBreakdown: {
      yearsAtBand_under22: breakdown.under22,
      yearsAtBand_22_to_40: breakdown.band22_40,
      yearsAtBand_41_plus: breakdown.band41plus,
    },
    totalWeeks: Math.round(totalWeeks * 100) / 100,
    totalStatutoryPayGbp,
    source: cap,
    assumptions,
    warnings,
    reasonCodes,
  };
}
