// Sprint 20 — UK Employment statutory calculator registry (foundation).
//
// Declarative registry of statutory calculators we plan to support. Every
// entry has `status: "planned"` unless a passing test proves an implementation
// exists. This file does NOT implement any calculator. It exists so the
// answer path can advertise the calculator catalogue without lying about
// which calculators are wired.

export type StatutoryCalculatorStatus = "planned" | "implemented";

export interface StatutoryCalculator {
  readonly calculatorId: string;
  readonly title: string;
  readonly inputs: ReadonlyArray<string>;
  readonly officialSource: string;
  readonly status: StatutoryCalculatorStatus;
  readonly notes: string;
}

export const UK_EMPLOYMENT_STATUTORY_CALCULATORS: ReadonlyArray<StatutoryCalculator> = [
  {
    calculatorId: "limitation_dates",
    title: "Limitation dates (ET / EAT / civil)",
    inputs: ["claim_type", "event_date", "acas_ec_notified_at", "acas_ec_certificate_at"],
    officialSource: "https://www.legislation.gov.uk/ukpga/1996/18/section/111",
    status: "planned",
    notes: "Section 111 ERA 1996 + ACAS early conciliation effect on time limits.",
  },
  {
    calculatorId: "statutory_redundancy_pay",
    title: "Statutory redundancy pay",
    inputs: ["age", "years_of_service", "weekly_pay", "effective_date"],
    officialSource: "https://www.gov.uk/calculate-your-redundancy-pay",
    status: "implemented",
    notes: "Section 162 ERA 1996; subject to statutory cap (weekly_pay) at the effective date. Implemented in Sprint 21 — `apps/legal-orchestrator/src/legalRules/redundancyPayCalculator.ts` (15 vitest cases). Default statutory rates registry ships EMPTY; operator must supply verified cap entries.",
  },
  {
    calculatorId: "notice_period",
    title: "Statutory minimum notice",
    inputs: ["service_months", "notice_direction"],
    officialSource: "https://www.legislation.gov.uk/ukpga/1996/18/section/86",
    status: "implemented",
    notes: "Section 86 ERA 1996. Direction = employer or employee notice. Implemented in Sprint 33 — `apps/legal-orchestrator/src/legalRules/noticePeriodCalculator.ts` (16 vitest cases). Returns statutory minimum only; contract notice prevails if longer.",
  },
  {
    calculatorId: "holiday_pay",
    title: "Statutory holiday entitlement / pay",
    inputs: ["mode", "daysPerWeek_or_hoursWorkedInPeriod", "weeklyPayGbp_or_hourlyRateGbp"],
    officialSource: "https://www.gov.uk/holiday-entitlement-rights",
    status: "implemented",
    notes: "Working Time Regulations 1998 (reg 13, 13A, 15B) + ERA 1996 ss221-224. Implemented in Sprint 38 — apps/legal-orchestrator/src/legalRules/holidayPayCalculator.ts (19 vitest cases). Returns statutory minimum only; caller must supply a verified 'week's pay' figure for variable-pay workers.",
  },
  {
    calculatorId: "ssp",
    title: "Statutory Sick Pay",
    inputs: ["average_weekly_earnings", "qualifying_days", "linked_periods"],
    officialSource: "https://www.gov.uk/statutory-sick-pay",
    status: "planned",
    notes: "SSPA 1994 + SSP regulations.",
  },
  {
    calculatorId: "nmw_nlw",
    title: "National Minimum Wage / National Living Wage",
    inputs: ["age", "pay_reference_period", "hours_worked", "gross_pay"],
    officialSource: "https://www.gov.uk/national-minimum-wage-rates",
    status: "planned",
    notes: "NMW Act 1998 + NMW Regulations.",
  },
  {
    calculatorId: "unfair_dismissal_cap",
    title: "Unfair dismissal compensatory award cap",
    inputs: ["effective_date", "annual_gross_pay"],
    officialSource: "https://www.legislation.gov.uk/ukpga/1996/18/section/124",
    status: "planned",
    notes: "Section 124 ERA 1996. Lower of statutory cap and 52 weeks' pay.",
  },
  {
    calculatorId: "vento_bands",
    title: "Vento bands (injury to feelings)",
    inputs: ["band", "claim_date"],
    officialSource: "https://www.judiciary.uk/courts-and-tribunals/employment/employment-tribunal-presidential-guidance-vento-bands/",
    status: "planned",
    notes: "Presidential Guidance issued annually. Lower / middle / upper band thresholds vary by claim_date.",
  },
];

export function listStatutoryCalculators(): ReadonlyArray<StatutoryCalculator> {
  return UK_EMPLOYMENT_STATUTORY_CALCULATORS;
}

export function findStatutoryCalculator(id: string): StatutoryCalculator | undefined {
  return UK_EMPLOYMENT_STATUTORY_CALCULATORS.find((c) => c.calculatorId === id);
}
