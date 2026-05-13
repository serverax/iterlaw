# IterLaw Statutory Calculator Registry (UK Employment)

> Foundation only. **Every calculator is `status: "planned"`.** No calculator is implemented by this sprint.

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

## Out of scope

- No calculator function exists.
- No `database` field — values that vary by date (statutory rate caps, NMW bands, Vento bands) require a separate sprint that builds a `statutory_rate` table with `effective_from` / `effective_to`.
- No production write.
