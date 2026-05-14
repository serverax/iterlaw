# Sprint 28 — Wire deterministic reranker into multi-tier retrieval

## Verdict: PASS

`runMultiTierRetrievalGateway` now applies `rerankCandidates` over the planner's `finalCandidates` when `ITERLAW_RERANKER_ENABLED=true`. Flag default OFF. 6 vitest cases. No external LLM. No DB. No network.

## Files

- `apps/legal-orchestrator/src/retrieval/multiTierRetrievalGateway.ts` — Sprint 28 reranker block added.
- `apps/legal-orchestrator/src/tests/rerankerGatewayFlag.test.ts` — 6 vitest cases (new).
- `docs/iterlaw/architecture/ITERLAW_RERANKER_POLICY.md` — Sprint 28 addendum.
- `docs/iterlaw/project/09-retrieval/RERANKER_FOUNDATION.md` — Sprint 28 follow-up note.

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/rerankerGatewayFlag.test.ts
 ✓ src/tests/rerankerGatewayFlag.test.ts (6 tests) 24ms
TEST_EXIT=0
```

Behaviour verified:

- Flag OFF → no `reranker_gateway:*` trace; planner ordering preserved.
- Flag ON + primary legislation vs ACAS guidance → legislation ranked first; `reranker_gateway:applied` in trace.
- Flag ON + tied scores → stable input order preserved.
- Flag ON + <2 candidates → `reranker_gateway:skipped:not_enough_candidates`.
- Decision trace deterministic (`reranker_gateway:applied`, `reranker_gateway:count:<n>`).
- No external network / LLM call.

## Production gate impact

None. Default-OFF flag.

## What this sprint does NOT do

- Does **not** call any external reranker (Cohere, Voyage, etc.) or LLM.
- Does **not** embed text.
- Does **not** weaken any existing trust / freshness / metadata filter — reranker runs **after** the planner's existing filters.
- Does **not** assert any production relevance improvement.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
