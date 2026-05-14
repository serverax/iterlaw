# IterLaw Statutory Calculator Registry (UK Employment)

> Sprint 20 foundation: 8 calculators registered, all PLANNED. **Sprint 21 update: `statutory_redundancy_pay` is now `implemented`** (deterministic, source-required). The other 7 calculators remain PLANNED.

Implementation: `apps/legal-orchestrator/src/legalRules/statutoryCalculatorRegistry.ts`.

## Calculators (all PLANNED)

| `calculatorId` | Title | Inputs | Official source |
|---|---|---|---|
| `limitation_dates` | Limitation dates (ET / EAT / civil) | claim_type, event_date, acas_ec_notified_at, acas_ec_certificate_at | s.111 ERA 1996 + ACAS early-conciliation rules |
| `statutory_redundancy_pay` | Statutory redundancy pay | age, years_of_service, weekly_pay, effective_date | s.162 ERA 1996; statutory cap by date |
| `notice_period` | Statutory minimum notice | years_of_service, notice_direction | s.86 ERA 1996 |
| `holiday_pay` | Statutory holiday entitlement / pay | work_pattern, weekly_hours, weeks_worked | WTR 1998 |
| `ssp` | Statutory Sick Pay | average_weekly_earnings, qualifying_days, linked_periods | SSPA 1994 |
| `nmw_nlw` | National Minimum Wage / National Living Wage | age, pay_reference_period, hours_worked, gross_pay | NMW Act 1998 + Regulations |
| `unfair_dismissal_cap` | Unfair-dismissal compensatory cap | effective_date, annual_gross_pay | s.124 ERA 1996 |
| `vento_bands` | Vento bands (injury to feelings) | band, claim_date | Presidential Guidance |

## Test contract

`apps/legal-orchestrator/src/tests/ukEmploymentIngestionPack.test.ts` asserts:

- All expected `calculatorId`s are registered.
- Every entry remains `status: "planned"` (no false claim of implementation).
- Every `officialSource` points at `legislation.gov.uk`, `gov.uk`, or `judiciary.uk` (other hosts are rejected at compile-time grep — drift would fail the test).

## Sprint 21 — statutory_redundancy_pay implementation

- `apps/legal-orchestrator/src/legalRules/redundancyPayCalculator.ts` — pure deterministic function `calculateStatutoryRedundancyPay(input, opts)` implementing ERA 1996 s162.
- `apps/legal-orchestrator/src/legalRules/statutoryRates.ts` — versioned cap registry (effective_from / effective_to). **Ships EMPTY by default.** Operators must add entries with real `source` URLs.
- `apps/legal-orchestrator/src/tests/redundancyPayCalculator.test.ts` — 15 vitest cases covering refusals, arithmetic, age-band walk, 20-year cap, weekly-pay cap, full-year truncation, zero / boundary cases.
- Refusal contract: when no statutory weekly-pay cap covers the supplied `effectiveDate`, the calculator returns `{ ok: false, reason: "needs_verified_rate" }` and refuses to guess.

## Sprint 31 — cited statutory rate sources

`apps/legal-orchestrator/src/legalRules/statutoryRateSources.ts` adds the validation + conversion layer that future operator-supplied seeds must pass through before they reach the calculator. Production seed `CITED_RATES_SEED` ships **empty**; the redundancy calculator therefore continues to return `needs_verified_rate` until an operator supplies validated entries. See `reports/ITERLAW_SPRINT_31_STATUTORY_RATES_REGISTRY.md`.

## Sprint 33 — second implemented calculator: notice_period

`apps/legal-orchestrator/src/legalRules/noticePeriodCalculator.ts` implements ERA 1996 s86 statutory minimum notice (both directions). The registry's `notice_period` entry flips from `planned` to `implemented`. 16 vitest cases at `apps/legal-orchestrator/src/tests/noticePeriodCalculator.test.ts`. See `docs/iterlaw/project/11-calculators/STATUTORY_NOTICE_PERIOD_CALCULATOR.md`.

Two of eight calculators are now `implemented` (`statutory_redundancy_pay` + `notice_period`). Six remain `planned`.

## Out of scope

- No DB-backed `statutory_rate` table — the rate registry is a Typescript module the operator supplies entries to.
- No production write.
- The other seven calculators remain PLANNED.
