# Sprint 23 — Deterministic reranker foundation

## Verdict: PASS

Pure deterministic reranker. No external model. No external LLM. No network. `ITERLAW_RERANKER_ENABLED` default OFF. 13 vitest cases. Score components per the plan: trust, freshness, exact-match boost, source tier, jurisdiction match, law-area match, citation metadata completeness, stale penalty, low-trust penalty.

## Files

- `apps/legal-orchestrator/src/retrieval/reranker.ts` (new — ≈195 lines).
- `apps/legal-orchestrator/src/tests/rerankerPolicy.test.ts` (new — 13 cases).
- `apps/legal-orchestrator/src/config/featureFlags.ts` (`ITERLAW_RERANKER_ENABLED` added; default OFF).
- `apps/legal-orchestrator/src/retrieval/index.ts` (public re-export).
- `docs/iterlaw/architecture/ITERLAW_RERANKER_POLICY.md` (new).
- `docs/iterlaw/project/09-retrieval/RERANKER_FOUNDATION.md` (new).

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/rerankerPolicy.test.ts
 ✓ src/tests/rerankerPolicy.test.ts (13 tests) 9ms
TEST_EXIT=0
```

Suite grew to 83 files / 1038 tests after this sprint (verified by the full orchestrator run earlier in this bundle — see Sprint 22 evidence).

## Behaviour contract (verified)

| Claim | Test case |
|---|---|
| Higher trust outranks lower trust | "higher trust outranks lower trust (failed-QA falls to bottom)" |
| Fresh outranks stale (effective_to) | "fresh source outranks stale source (effective_to in the past)" |
| Live outranks superseded | "non-superseded outranks superseded" |
| Source-tier ordering | "primary legislation outranks acas guidance (source-tier rank)" |
| Exact-match boost | "exact-match boost lifts a candidate above an otherwise equal one" |
| Jurisdiction match | "jurisdiction match adds a point when the source_url carries the jurisdiction hint" |
| Law-area match | "law-area match adds a point when the source_title carries the law-area hint" |
| Citation metadata completeness | "complete citation metadata outranks incomplete metadata when other signals tie" |
| Combined penalties | "stale + low-trust + missing metadata all stack into a sub-zero score" |
| Stable sort on ties | "stable sort preserves order on equal scores" |
| Decision trace present | "decision trace exists for every input" |
| Flag default OFF | "defaults to OFF when env var is unset" |
| Flag parsing | "turns ON only when env var is exactly true / 1 / yes / on" |

## Production gate impact

None. Architectural / foundation progress only.

## What this sprint does NOT do

- Does **not** call any external reranker (Cohere, Voyage, etc.) or LLM.
- Does **not** embed text.
- Does **not** wire the reranker into `handleLegalRequest`.
- Does **not** assert any production relevance improvement.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite.
- No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
