# Sprint 34 — Golden harness evidence-attached fixtures

## Verdict: PASS

10 evidence-attached fixtures added; each runs through Sprint 24's `buildEvidencePack` and produces the declared outcome. 8 vitest cases. No external LLM. No DB. No network.

## Files

- `apps/legal-orchestrator/src/tests/fixtures/legalGoldenEvidenceFixtures.ts` (new — 10 fixtures).
- `apps/legal-orchestrator/src/tests/legalGoldenEvidenceHarness.test.ts` (new — 8 cases).
- `docs/iterlaw/project/13-evaluation/LEGAL_GOLDEN_TEST_HARNESS.md` — Sprint 34 addendum.
- `docs/iterlaw/architecture/ITERLAW_CITATION_VERIFICATION_AND_EVIDENCE_PACKS.md` — Sprint 34 addendum.

## Fixture coverage

| ID | Evidence status | Expected outcome |
|---|---|---|
| unfair_dismissal_supported | supported | pass |
| redundancy_supported | supported | pass |
| discrimination_missing_citation | missing | block |
| holiday_pay_stale | stale | block |
| holiday_pay_stale_historical_mode | stale (historical mode) | needs_review |
| notice_pay_supported | supported | pass |
| settlement_no_source_url | missing (no source URL) | block |
| whistleblowing_weak_trust | weak | needs_review |
| employment_status_supported | supported | pass |
| limitation_dates_supported | supported | pass |

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/legalGoldenEvidenceHarness.test.ts
 ✓ src/tests/legalGoldenEvidenceHarness.test.ts (8 tests) 10ms
TEST_EXIT=0
```

Harness invariants asserted by the test suite:

- Fixture catalogue has ≥ 10 entries.
- Every fixture has both `evidence_status` and `expected_outcome`.
- `missing` evidence → expects `block`.
- `stale` evidence → expects `block` unless `historicalMode: true` (then `needs_review`).
- `weak` evidence → expects `needs_review`.
- `pass` expectation requires `supported` evidence (no unsupported answer can pass).
- Every fixture produces a non-empty `reasonCodes` array on the pack.

## Production gate impact

None directly — but the harness gives a deterministic regression-tracking signal for the citation gate (G15) going forward.

## What this sprint does NOT do

- Does **not** invoke any LLM.
- Does **not** call any DB or network.
- Does **not** assert legal correctness on its own — it asserts citation-gate behaviour against synthetic fixtures.
- Does **not** wire itself into `handleLegalRequest`. The legacy answer path is unchanged.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
