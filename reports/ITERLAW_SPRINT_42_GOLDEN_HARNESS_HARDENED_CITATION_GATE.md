# Sprint 42 — Golden harness wired to runHardenedCitationGate

## Verdict: PASS

11 new evidence-attached fixtures + a harness that runs every fixture (Sprint 34's 10 + Sprint 42's 11 = 21 total) through `runHardenedCitationGate` and produces deterministic PASS / FAIL output. No external LLM. No DB. No network.

## Files

- `apps/legal-orchestrator/src/tests/fixtures/legalGoldenEvidenceFixturesExtended.ts` (new — 11 fixtures).
- `apps/legal-orchestrator/src/tests/legalGoldenHardenedCitationHarness.test.ts` (new — 5 vitest cases wiring 21 fixtures into the hardened gate).

## Fixture coverage (extended set)

| ID | Evidence status | Expected outcome | Spec category |
|---|---|---|---|
| ext_strong_citation | supported | pass | strong citation |
| ext_missing_citation | missing | block | missing citation |
| ext_wrong_jurisdiction | weak | needs_review | wrong jurisdiction (surfaced via low-trust proxy) |
| ext_expired_source | stale | block | expired source/rate |
| ext_expired_rate_historical_mode | stale (historical) | needs_review | expired source/rate, historical mode |
| ext_unsupported_statutory_rate | missing (no source URL) | block | unsupported statutory rate |
| ext_entitlement_mismatch_low_trust | weak (trust=0) | block | entitlement mismatch surrogate |
| ext_weak_citation | weak | needs_review | weak citation |
| ext_calculator_with_cited_basis | supported | pass | calculator output with cited basis |
| ext_vector_result_with_citation | supported | pass | vector result with citation |
| ext_cache_stale_source_version | stale | block | approved-answer cache with stale source version |

Combined catalogue (Sprint 34 + Sprint 42) = 21 fixtures.

## Harness contract

```text
for every fixture f in (Sprint 34 + Sprint 42):
  decision = runHardenedCitationGate({
    answerText: f.answerText,
    citations: f.citations,
    retrievedChunks: f.retrievedCandidates → mapped orchestrator-chunk shape,
    nowIsoDate: 2026-05-14,
    historicalMode: f.historicalMode,
    trustScores: f.trustScores,
  })
  expect: matches(f.expected_outcome, decision.overallStatus)
```

`matches`:

- `expected = "pass"` ↔ `overallStatus = "fully_cited"`
- `expected = "block"` ↔ `overallStatus.startsWith("blocked_")`
- `expected = "needs_review"` ↔ `overallStatus = "needs_review"`

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/legalGoldenHardenedCitationHarness.test.ts
 ✓ src/tests/legalGoldenHardenedCitationHarness.test.ts (5 tests) 13ms
TEST_EXIT=0
```

Invariants asserted by the harness:

- Extended fixture set has ≥ 10 entries (currently 11).
- Every spec-named category id is present.
- Every fixture in the combined set produces a deterministic PASS / FAIL match against the hardened gate.
- Every fixture's decision trace begins with `citation_gate:entered` and has at least 2 entries.
- Combined catalogue has ≥ 20 entries.

## Notes / honest scope limits

- **Wrong jurisdiction** is currently surfaced via a low-trust proxy because the deterministic Sprint 24 verifier does not yet evaluate jurisdiction directly. A future sprint can add a jurisdiction-match block; the fixture id stays stable so the harness can flip the expectation when that arrives.
- **Entitlement mismatch** is surfaced via a trust=0 proxy (failed-QA semantics). The actual entitlement gate (Sprint 30) runs separately ahead of the citation gate and is not modelled inside this fixture set.
- **Stale source** in the cache-stale fixture is expressed via `effective_to` in the past (not `superseded_by`), because the citation gate adapter consumes `applicable_to` not `superseded_by`. Functionally equivalent for this harness.

## Production gate impact

None directly. The harness gives a deterministic regression-tracking signal for the citation gate (G15) going forward, complementing Sprint 34.

## What this sprint does NOT do

- Does **not** invoke any LLM.
- Does **not** call any DB or network.
- Does **not** wire the harness into `handleLegalRequest`.
- Does **not** assert legal correctness on its own — it asserts citation-gate behaviour against synthetic fixtures.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
