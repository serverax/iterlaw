# Speed-First Retrieval — Phase 1: Approved-Answer Fast Path

**Sprint 26.** Foundation only. **No production speed claim.** No live DB. No external LLM.

## What this phase delivers

- `apps/legal-orchestrator/src/retrieval/retrievalCacheKey.ts` — deterministic SHA-256 cache key from `workspace + project + module + jurisdiction + law_area + normalised question + context/source hash`.
- `apps/legal-orchestrator/src/retrieval/approvedAnswerFastPath.ts` — `runApprovedAnswerFastPath(input)` consumes an injected `ApprovedAnswerLookup` and returns either a hit or a structured miss reason.
- `apps/legal-orchestrator/src/tests/approvedAnswerFastPath.test.ts` — 18 vitest cases.
- Bench harness scenario `scenario:fast_path_mock` (default ON; runs purely against an in-memory mock lookup).

## Cache key contract

```
sha256("workspace:<id>|project:<id>|module:<id>|jurisdiction:<j>|law_area:<la>|q:<normalised>|ctx:<hash>")
```

Changing **any** of those components produces a different cache key. The normalised question lowercases, trims whitespace, and strips trailing punctuation — non-substantive variations of the same question reuse the same entry.

## Refusal contract

A cached entry returns a `hit: false` decision when any of:

| Condition | Reason |
|---|---|
| No lookup supplied | `no_lookup_configured` |
| Lookup returns undefined | `cache_miss` |
| `expiresAt` in the past | `expired` |
| `citationCount <= 0` | `no_citations` |
| `qaStatus === "failed"` | `failed_qa` |
| `qaStatus !== "approved"` (and not failed) | `draft_or_unreviewed` |

This preserves IterLaw's citation gate: a cached answer with zero citations or a failed QA verdict is never served, even on a key-match.

## What this phase does NOT do

- Does **not** wire the fast path into `handleLegalRequest`. The wiring sprint will sit ahead of `runMultiTierRetrievalGateway` behind a feature flag.
- Does **not** persist anything. The lookup is dependency-injected; future sprints can wire it to Redis / Postgres / an in-memory cache.
- Does **not** assert speed improvements.
- Does **not** invoke any LLM.

## Bench harness scenario

`scripts/bench/iterlaw-retrieval-benchmark.mjs` now includes a fourth scenario `scenario:fast_path_mock` that runs the fast path against an in-memory lookup returning a valid approved entry. The scenario is purely informational; no production-speed comparison is asserted.
