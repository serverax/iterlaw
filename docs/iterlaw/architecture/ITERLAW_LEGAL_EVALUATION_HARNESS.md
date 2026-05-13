# IterLaw Legal Evaluation Harness — Design

> Status: Design only. Sprint 14 ships the pure `ragEvaluator.ts`
> module and the supporting types. A future sprint adds the golden
> test suite and the periodic eval CI job.

## 1. What it evaluates

The harness evaluates a candidate legal answer + its evidence pack
against these gates:

1. **Citation coverage** — fraction of legal claims whose cited
   sources appear in the evidence pack. Legal threshold: 0.9.
2. **Trust threshold** — at least one evidence block at or above the
   trust threshold. Legal threshold: 80.
3. **Freshness** — no stale legal source in the pack.
4. **Source diversity** — `#unique source_types / #blocks ≥ 0.5`.
5. **Block recommendation** — set if any of the above fail hard.
6. **Needs review** — set if the answer is borderline or missing
   review metadata.
7. **Uncited legal claim detection** — any answer claim whose cited
   source isn't in the evidence pack.

The pure module `apps/legal-orchestrator/src/intelligence/ragEvaluator.ts`
implements 1–7 deterministically with reason codes.

## 2. Golden legal test suite (deferred)

A future sprint will ship a fixture-based golden suite covering at
minimum:

- unfair dismissal,
- direct + indirect discrimination,
- redundancy + collective redundancy,
- holiday pay,
- notice pay,
- settlement agreement carve-outs,
- whistleblowing / protected disclosure,
- employment status (employee / worker / self-employed),
- ACAS early conciliation timing,
- limitation dates.

Each fixture provides:

- the input question,
- the input facts,
- the expected `IntelligenceResult.decision`,
- the expected high-trust sources,
- a hand-crafted reference answer with citations.

The harness runs the gateway → evaluator → assertion.

## 3. Periodic eval CI (deferred)

A future GitHub Actions workflow runs the golden suite nightly,
posts a report, and fails CI if regression is detected:

- decision flips (proceed ↔ block),
- citation coverage drops below threshold,
- new uncited legal claims appear.

The workflow is mock-safe (no external LLM, no real DB) — it
exercises the Intelligence Layer with fixture inputs.

## 4. Reason-code stability

Reason codes are part of the evaluator's contract. CI must fail when
expected reason codes disappear without an ADR explanation. This is
how the harness catches silent regressions in the policy machinery.

## 5. Out of scope right now

- No golden fixture files committed in Sprint 14.
- No CI workflow added.
- No periodic run.
- No integration with the existing answer-path tests beyond the
  Sprint 14 unit tests in `apps/legal-orchestrator/src/tests/`.
