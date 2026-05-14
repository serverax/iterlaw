# Sprint 21 — Deterministic statutory redundancy pay calculator

## Verdict: PASS

Pure deterministic function. No LLM. No DB. No network. Implements ERA 1996 s162 with the s227 weekly-pay cap. Refuses (`needs_verified_rate`) when no statutory cap source is supplied. 15 vitest cases. The default statutory rates registry ships **EMPTY** — operators must supply citeable rate entries before the calculator can return numbers.

## Files

- **New code:** `apps/legal-orchestrator/src/legalRules/redundancyPayCalculator.ts` (≈195 lines).
- **New code:** `apps/legal-orchestrator/src/legalRules/statutoryRates.ts` (versioned rate registry; ships empty).
- **New tests:** `apps/legal-orchestrator/src/tests/redundancyPayCalculator.test.ts` (15 vitest cases).
- **Registry flip:** `apps/legal-orchestrator/src/legalRules/statutoryCalculatorRegistry.ts` — `statutory_redundancy_pay` status flipped `planned` → `implemented`.
- **Sprint 20 test updated:** `apps/legal-orchestrator/src/tests/ukEmploymentIngestionPack.test.ts` — old "all planned" assertion split into "official source" + "only statutory_redundancy_pay is implemented" cases.
- **Docs:**
  - `docs/iterlaw/project/11-calculators/STATUTORY_REDUNDANCY_PAY_CALCULATOR.md` (new).
  - `docs/iterlaw/architecture/ITERLAW_STATUTORY_CALCULATOR_REGISTRY.md` (Sprint 21 addendum).

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/redundancyPayCalculator.test.ts
 ✓ src/tests/redundancyPayCalculator.test.ts (15 tests) 21ms
 Test Files  1 passed (1)
      Tests  15 passed (15)
TEST_EXIT=0

$ cd apps/legal-orchestrator && npm test
 Test Files  81 passed (81)
      Tests  1014 passed (1014)
ORCH_TEST_EXIT=0
```

Suite grew from 80 / 998 to 81 / 1014 (+1 file, +16 tests — Sprint 20 test split adds one, calculator adds 15).

## Rules covered (with assertions)

| Rule | Test case |
|---|---|
| 41+ band → 1.5 week/year | "45-year-old, 10 years service ... = 12.5 weeks" |
| 22–40 band → 1.0 week/year | "35-year-old, 10 years service ... = 10 weeks × £500 = £5000" |
| Under-22 band → 0.5 week/year | "21-year-old, 4 years service ... = 2 weeks" |
| 20-year service cap (s162(3)) | "caps years of service at 20 even when input is 30" |
| Weekly-pay statutory cap (s227) | "caps weekly pay at statutory cap and emits a warning" |
| Full years only (s162(1)) | "truncates fractional years to full years" |
| `needs_verified_rate` refusal | 2 tests — empty registry; date outside window |
| Invalid-input refusals | 4 tests — age below 16, negative service, zero/negative pay, non-ISO date |
| Source citation included | "includes the source citation in the result" |
| Zero years → £0 | "zero years of service returns 0 pay (boundary)" |
| Walk-back below working age stops | "a worker whose age-walk would drop below the working-age stops the walk" |

## Refusal contract evidence

```ts
calculateStatutoryRedundancyPay(
  { ageAtDismissal: 35, yearsOfService: 10, weeklyPayGbp: 500, effectiveDate: "2024-09-01" },
  { ratesRegistry: { weeklyPayCaps: [] } },
);
// → { ok: false, reason: "needs_verified_rate", missingFor: "2024-09-01",
//     reasonCodes: ["redundancy_calc:needs_verified_rate", ...] }
```

## Production gate impact

None directly. `statutory_redundancy_pay` flips inside the calculator registry from `planned` → `implemented`, but the 17-gate production readiness JSON is unchanged.

## What this sprint does NOT do

- Does **not** ship statutory cap values. The default registry is empty by design.
- Does **not** wire the calculator into `handleLegalRequest` or any HTTP route.
- Does **not** assess what counts as a "week's pay" (ERA 1996 s221–s229).
- Does **not** apply continuous-service exclusions.
- Does **not** call any LLM.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite.
- No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
- Statutory cap values are NOT hard-coded into product code. The fixture cap (£700) used in test code only is illustrative and labelled as such in the test file.
