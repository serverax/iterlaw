# Sprint 26 — Speed-first retrieval phase 1: approved-answer fast path

## Verdict: PASS

Foundation. Deterministic cache key + approved-answer fast path. Refuses stale / uncited / failed entries. No production speed claim. No external LLM. No DB. 18 vitest cases. Bench harness scenario added.

## Files

- `apps/legal-orchestrator/src/retrieval/retrievalCacheKey.ts` (new).
- `apps/legal-orchestrator/src/retrieval/approvedAnswerFastPath.ts` (new).
- `apps/legal-orchestrator/src/tests/approvedAnswerFastPath.test.ts` (new — 18 cases).
- `apps/legal-orchestrator/src/retrieval/index.ts` — public re-export of `buildRetrievalCacheKey`, `normaliseQuestion`, `runApprovedAnswerFastPath`, and the surrounding types.
- `scripts/bench/iterlaw-retrieval-benchmark.mjs` — adds `scenario:fast_path_mock` (default ON; mock lookup; no DB).
- `docs/iterlaw/project/09-retrieval/SPEED_FIRST_RETRIEVAL_PHASE_1.md` (new).

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/approvedAnswerFastPath.test.ts
 ✓ src/tests/approvedAnswerFastPath.test.ts (18 tests) 8ms
TEST_EXIT=0

$ node scripts/bench/iterlaw-retrieval-benchmark.mjs | tail -n 4
[BENCH] scenario:fast_path_mock
  fast_path_hit    = true
  reason           = hit
  elapsed_ms       = 0.83
BENCH_EXIT=0
```

## Behaviour contract (verified)

| Case | Result |
|---|---|
| Same inputs → same key (deterministic) | PASS |
| Different workspace / project / module / jurisdiction / law_area / context-hash | different key |
| Whitespace / case / trailing punctuation in question | **same** key |
| No lookup supplied | `no_lookup_configured` |
| Lookup returns undefined | `cache_miss` |
| Entry's `expiresAt` in the past | `expired` |
| Entry's `citationCount <= 0` | `no_citations` (citation gate preserved) |
| Entry's `qaStatus === "failed"` | `failed_qa` |
| Entry's `qaStatus` in `"draft"` / `"unreviewed"` | `draft_or_unreviewed` |
| Approved + cited + fresh entry | `hit: true` |

## Production gate impact

None. Architectural / foundation progress only. The fast path is **not** wired into `handleLegalRequest`. A future sprint will integrate it ahead of `runMultiTierRetrievalGateway` behind a feature flag.

## What this sprint does NOT do

- Does **not** call any LLM.
- Does **not** persist anything — the lookup is dependency-injected.
- Does **not** assert a production speed improvement.
- Does **not** wire the fast path into `handleLegalRequest`.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite.
- No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
