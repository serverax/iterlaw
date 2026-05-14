# Sprint 38 — Holiday pay calculator under WTR 1998

## Verdict: PASS

Deterministic statutory holiday entitlement + pay calculator under the Working Time Regulations 1998 (regs 13, 13A, 15B) and ERA 1996 ss221–224. Returns statutory minimum only; never gives final legal advice; never invents rates. Two modes: regular-hours and irregular-hours (2024 12.07% accrual). Fail-closed on insufficient input. 19 vitest cases.

## Files

- `apps/legal-orchestrator/src/legalRules/holidayPayCalculator.ts` (new).
- `apps/legal-orchestrator/src/tests/holidayPayCalculator.test.ts` (new — 19 cases).
- `apps/legal-orchestrator/src/legalRules/statutoryCalculatorRegistry.ts` — `holiday_pay` status flipped `planned` → `implemented`.
- `apps/legal-orchestrator/src/tests/ukEmploymentIngestionPack.test.ts` — assertion updated to "three calculators implemented".

## Public surface

```ts
calculateStatutoryHolidayPay({
  mode: "regular_hours" | "irregular_hours_or_part_year",
  daysPerWeek?: number,            // regular_hours
  hoursWorkedInPeriod?: number,    // irregular
  weeklyPayGbp?: number,           // optional — produces pay figure
  hourlyRateGbp?: number,          // optional — irregular mode pay
  variablePayWeeksOfHistoryAvailable?: number,
}): HolidayPayOutcome
```

Outcome includes `statutoryLeaveWeeks`, `statutoryLeaveDays`, optional `accruedHours`, optional `statutoryPayGbp`, `assumptions`, `warnings`, `riskMarker: "low" | "medium" | "needs_more_facts"`, `jurisdiction: "UK"`, `legalBasis[]` with citation + URL, and `reasonCodes[]`.

## Rules implemented

- WTR 1998 reg 13 + 13A → 5.6 weeks per year, pro-rated. Statutory days cap = 28 (5.6 × 5).
- WTR 1998 reg 15B (irregular-hours / part-year from 2024-04-01) → 12.07% accrual on hours worked.
- ERA 1996 ss221–224 → caller responsible for "a week's pay" / hourly rate. Calculator emits `needs_more_facts` warning when variable-pay history < 52 weeks per the 2020 Reference Period Regulations.

## Refusal contract

- Invalid mode / negative pay / negative hours → `invalid_input`.
- Regular mode without `daysPerWeek` → `needs_more_facts`.
- Irregular mode without `hoursWorkedInPeriod` → `needs_more_facts`.
- `daysPerWeek` outside 1–7 → `invalid_input`.

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/holidayPayCalculator.test.ts
 ✓ src/tests/holidayPayCalculator.test.ts (19 tests) 10ms
TEST_EXIT=0
```

Test coverage:

- Regular-hours: 5 days/week → 28 days; 3 days/week → 16.8 days; 6 days/week → 28 + cap warning; with weeklyPay → 2800 pay; variable-pay history < 52 weeks → `needs_more_facts` risk marker.
- Irregular-hours: 100 hours → 12.07 accrued; with hourlyRate → pay = accrued × rate; with weeklyPay → warns + raises risk; 0 hours → 0 accrued.
- Refusals: missing daysPerWeek; missing hoursWorkedInPeriod; daysPerWeek 0 or 8; negative hours; invalid mode; negative pay / hourly rate.
- Metadata: assumptions include statutory-minimum-only; legalBasis includes WTR 1998 reg 13 + ERA 1996 ss221; jurisdiction = "UK"; deterministic.

## Citation gates not bypassed

The calculator emits a structured `legalBasis` array with `legislation.gov.uk` URLs only, and a `riskMarker` that surfaces "needs_more_facts" when reference data is incomplete. It never claims final legal certainty.

## Production gate impact

None directly. `holiday_pay` calculator-registry status flips `planned` → `implemented`; the 17-gate production-readiness JSON is unchanged.

## What this sprint does NOT do

- Does **not** invent any rate.
- Does **not** assess what counts as "normal remuneration" under post-Bear-Scotland case law.
- Does **not** compute a 52-week variable-pay average — the caller supplies `weeklyPayGbp` if needed.
- Does **not** invoke any LLM.
- Does **not** call any DB or network.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
