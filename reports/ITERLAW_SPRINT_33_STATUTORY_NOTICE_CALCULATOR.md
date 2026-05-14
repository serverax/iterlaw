# Sprint 33 — Statutory notice period calculator

## Verdict: PASS

Pure deterministic ERA 1996 s86 implementation. No LLM. No DB. No network. 16 vitest cases. Calculator returns statutory minimum only; contract notice prevails if longer (calculator does not consume contract value).

## Files

- `apps/legal-orchestrator/src/legalRules/noticePeriodCalculator.ts` (new).
- `apps/legal-orchestrator/src/tests/noticePeriodCalculator.test.ts` (new, 16 cases).
- `apps/legal-orchestrator/src/legalRules/statutoryCalculatorRegistry.ts` — `notice_period` status flipped `planned` → `implemented`.
- `apps/legal-orchestrator/src/tests/ukEmploymentIngestionPack.test.ts` — assertion updated to "redundancy + notice are implemented; rest planned".
- `docs/iterlaw/project/11-calculators/STATUTORY_NOTICE_PERIOD_CALCULATOR.md` (new).
- `docs/iterlaw/architecture/ITERLAW_STATUTORY_CALCULATOR_REGISTRY.md` — Sprint 33 addendum.

## Rules implemented (ERA 1996 s86)

- Service < 1 month → 0 weeks (both directions).
- 1 month ≤ service < 2 years (employer→employee) → 1 week.
- service ≥ 2 years (employer→employee) → 1 week per complete year, capped at 12 weeks.
- service ≥ 1 month (employee→employer) → fixed 1 week regardless of years.
- Full years only.
- Invalid inputs (negative / non-finite service; invalid direction) → `{ ok: false, reason: "invalid_input" }`.

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/noticePeriodCalculator.test.ts
 ✓ src/tests/noticePeriodCalculator.test.ts (16 tests) 15ms
TEST_EXIT=0
```

Boundary cases covered explicitly:

- 0.5 month / employer → 0 weeks.
- 1 month / employer → 1 week (lower band boundary).
- 23 months / employer → 1 week (upper band boundary).
- 24 months / employer → 2 weeks (band transition).
- 60 months / employer → 5 weeks.
- 144 months / employer → 12 weeks (cap boundary).
- 240 months / employer → 12 weeks + cap warning.
- 35 months / employer → 2 weeks (full-year truncation).
- 0.5 month / employee → 0 weeks.
- ≥1 month / employee → 1 week, every range tested.
- Negative / NaN service → `invalid_input`.
- Invalid direction → `invalid_input`.
- Deterministic: same input → identical output.

## Production gate impact

None directly. `notice_period` flips inside the calculator registry from `planned` to `implemented`; the 17-gate production-readiness JSON is unchanged.

## What this sprint does NOT do

- Does **not** consume the contract notice period.
- Does **not** apply continuous-service exclusion rules.
- Does **not** invoke any LLM.
- Does **not** persist or read any DB.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
