# Sprint 25 — Legal golden evaluation harness

## Verdict: PASS

Deterministic harness for UK Employment law scenarios. Oracle-injected. No external LLM. Every fixture without evidence expects `insufficient_sources`. Ten scenarios. 7 vitest cases.

## Files

- `apps/legal-orchestrator/src/evaluation/legalGoldenHarness.ts` (new).
- `apps/legal-orchestrator/src/tests/fixtures/legalGoldenScenarios.ts` (new — 10 scenarios).
- `apps/legal-orchestrator/src/tests/legalGoldenHarness.test.ts` (new — 7 cases).
- `docs/iterlaw/project/13-evaluation/LEGAL_GOLDEN_TEST_HARNESS.md` (new).

## Scenarios

| id | label |
|---|---|
| unfair_dismissal_1 | Unfair dismissal — 2-year qualifying service, fair-reasons check |
| redundancy_1 | Statutory redundancy pay — 35yo, 10 years, £500/wk |
| discrimination_1 | Discrimination — protected characteristic + less favourable treatment |
| holiday_pay_1 | Holiday pay — irregular hours worker |
| notice_pay_1 | Statutory minimum notice — 7 years service |
| settlement_agreement_1 | Settlement agreement — without independent legal advice |
| whistleblowing_1 | Whistleblowing — protected disclosure test |
| employment_status_1 | Employment status — Uber / Pimlico / Autoclenz tests |
| acas_early_conciliation_1 | ACAS early conciliation — limitation extension |
| limitation_dates_1 | Limitation dates — ET claim s111 ERA 1996 |

All ten ship with `evidenceAvailable: false` → expected outcome `insufficient_sources`.

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/legalGoldenHarness.test.ts
 ✓ src/tests/legalGoldenHarness.test.ts (7 tests) 11ms
TEST_EXIT=0
```

## Behaviour contract (verified)

- Fixture has all 10 required scenarios.
- Every no-evidence scenario expects `insufficient_sources`.
- Without an oracle, every scenario records `insufficient_sources` and `golden:no_oracle_injected`.
- A wrong-outcome oracle is flagged for every scenario.
- `reasonContains` is checked when supplied.
- Harness counts oracle invocations correctly (one per scenario; no hidden retries).

## Production gate impact

None. Foundation only.

## What this sprint does NOT do

- Does **not** call any LLM.
- Does **not** ship evidence fixtures — that is a follow-up sprint.
- Does **not** wire the harness into `handleLegalRequest`.
- Does **not** assert legal correctness on its own.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite.
- No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
