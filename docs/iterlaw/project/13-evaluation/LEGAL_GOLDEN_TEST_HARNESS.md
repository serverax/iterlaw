# Legal Golden Test Harness (Sprint 25)

**Status:** PASS (deterministic; oracle-injected; no external LLM).

## Purpose

Runs a fixed list of UK Employment law scenarios against an injected `LegalGoldenOracle` and compares each oracle output to the scenario's expected outcome. The harness itself does **not** answer legal questions — it consumes the oracle the caller supplies.

## Files

- `apps/legal-orchestrator/src/evaluation/legalGoldenHarness.ts` — pure `runLegalGoldenScenarios(scenarios, oracle?)` function.
- `apps/legal-orchestrator/src/tests/fixtures/legalGoldenScenarios.ts` — ten UK Employment scenarios.
- `apps/legal-orchestrator/src/tests/legalGoldenHarness.test.ts` — 7 vitest cases.

## Scenario coverage (10)

1. `unfair_dismissal_1` — qualifying service + fair-reasons.
2. `redundancy_1` — statutory redundancy entitlement.
3. `discrimination_1` — protected characteristic + less favourable treatment.
4. `holiday_pay_1` — irregular-hours worker reference window.
5. `notice_pay_1` — statutory minimum notice period.
6. `settlement_agreement_1` — independent legal advice + writing requirement.
7. `whistleblowing_1` — protected disclosure test.
8. `employment_status_1` — Uber / Pimlico / Autoclenz tests.
9. `acas_early_conciliation_1` — limitation extension after EC.
10. `limitation_dates_1` — ET claim window (ERA 1996 s111).

## Contract

- Every fixture without evidence (`evidenceAvailable: false`) expects `insufficient_sources`. This is the IterLaw safe default — the oracle MUST surface that outcome when source / citation evidence is absent.
- When no oracle is injected, the harness records `insufficient_sources` for every scenario and tags `golden:no_oracle_injected` + `golden:safe_default`.
- `expected.reasonContains` enables strict reason-code assertion when the oracle is wired up.

## What this harness does NOT do

- Does **not** call any LLM. The harness is dependency-injected.
- Does **not** read any production DB or network resource.
- Does **not** ship answer fixtures — every scenario without evidence expects `insufficient_sources`, not a fixed "correct answer". Sprint 25 explicitly avoids encoding a legal correctness oracle into product code.
- Does **not** wire itself into `handleLegalRequest` or any HTTP endpoint.

## Next steps

- Sprint 25.x — Add evidence-attached fixtures (citations + retrieved candidates) so the oracle has the inputs it needs to produce an `answered` outcome.
- Sprint 25.y — Run the harness against the real orchestrator answer path (the oracle becomes `handleLegalRequest` itself) under a CI gate.
