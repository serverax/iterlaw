# Statutory Notice Period Calculator (UK Employment)

**Sprint 33 — implemented (deterministic, source-anchored).**

## Statutory basis

- **ERA 1996 s86** — statutory minimum notice:
  - `s86(1)(a)–(b)` — employer to employee:
    - service < 1 month → no statutory minimum
    - 1 month to < 2 years → 1 week
    - ≥ 2 years → 1 week per complete year, capped at **12 weeks**
  - `s86(2)` — employee to employer:
    - service < 1 month → no statutory minimum
    - service ≥ 1 month → **1 week**, regardless of length of service

## Implementation files

- `apps/legal-orchestrator/src/legalRules/noticePeriodCalculator.ts`
- `apps/legal-orchestrator/src/tests/noticePeriodCalculator.test.ts` — 16 vitest cases.
- Registry update: `apps/legal-orchestrator/src/legalRules/statutoryCalculatorRegistry.ts` — `notice_period` flipped `planned` → `implemented`.

## Public surface

```ts
calculateStatutoryMinimumNotice({
  serviceMonths: number,
  direction: "employer_to_employee" | "employee_to_employer",
}): NoticePeriodOutcome
```

Result: `{ ok: true, statutoryMinimumWeeks, fullYearsCounted, assumptions, warnings, reasonCodes }` on success; `{ ok: false, reason: "invalid_input", violations, reasonCodes }` on validation failure.

## Refusal contract

- Negative or non-finite `serviceMonths` → `invalid_input`.
- Invalid `direction` value → `invalid_input`.

## Cap behaviour

For employer-to-employee notice at `serviceMonths >= 240` (20 years), the raw weeks would exceed 12; the calculator caps at 12 and emits the warning `Statutory minimum notice capped at 12 weeks (ERA 1996 s86(1)(b))`.

## What this calculator does NOT do

- Does **not** consume the contract notice period. The statutory minimum is returned; contract notice prevails if longer (the caller must compare).
- Does **not** apply statutory continuous-service exclusions (ERA 1996 ss210–219). The caller supplies `serviceMonths` directly.
- Does **not** invoke any LLM.
- Does **not** call any DB or network.
