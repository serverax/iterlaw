# Sprint 36 — Wire pgvector adapter into the multi-tier gateway

## Verdict: PASS

Sprint 32 pgvector adapter wired into `runMultiTierRetrievalGateway` behind `ITERLAW_PGVECTOR_GATEWAY_ENABLED` (default OFF). Caller-supplied `vectorSearch` always wins. Adapter errors are swallowed without leak. Citation + entitlement gates are untouched by this sprint. 7 vitest cases.

## Files

- `apps/legal-orchestrator/src/config/featureFlags.ts` — `ITERLAW_PGVECTOR_GATEWAY_ENABLED` added (default OFF).
- `apps/legal-orchestrator/src/retrieval/multiTierRetrievalGateway.ts` — pgvector wiring block added; takes optional `pgvector: { client, embedder }` input.
- `apps/legal-orchestrator/src/tests/pgvectorGatewayFlag.test.ts` — 7 vitest cases (new).

## Wiring contract

| Condition | Behaviour |
|---|---|
| Flag OFF | No `pgvector_gateway:*` trace; planner runs with caller's deps as-is. |
| Flag ON + `deps.vectorSearch` supplied | Caller wins. Trace: `pgvector_gateway:skipped:caller_supplied_vector_search`. |
| Flag ON + no `pgvector.client` or `pgvector.embedder` | Trace: `pgvector_gateway:no_dependencies`. Vector tier remains skipped. |
| Flag ON + both client + embedder | Wired via `createPgvectorSearchFromEmbedder`. Trace: `pgvector_gateway:wired`. Vector tier active. |
| Flag ON + adapter throws (DSN-shaped error) | Adapter swallows. Trace shows `pgvector_gateway:wired` (the wire-up succeeded); adapter returns `[]`. **No DSN / password leaked in any decision-trace entry.** |

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/pgvectorGatewayFlag.test.ts
 ✓ src/tests/pgvectorGatewayFlag.test.ts (7 tests) 19ms
TEST_EXIT=0
```

Behaviour verified:

- Flag default OFF (env var unset).
- Flag parses canonical truthy/falsy strings.
- Flag OFF → no `pgvector_gateway:*` trace; legacy path preserved.
- Flag ON + no deps → `pgvector_gateway:no_dependencies`; vector tier skipped.
- Flag ON + client + embedder + adapter success → vector candidates surface in `finalCandidates`.
- Flag ON + caller's `vectorSearch` already injected → caller wins; trace records skip.
- Flag ON + client throws DSN-shaped error → adapter swallows; **no leak in trace**.

## Safety guarantees

- The `multiTierRetrievalGateway` file does not access `process.env` for `DATABASE_URL`; connection management is the operator's responsibility via the supplied `PgvectorClient`.
- The reranker pipeline is unchanged — it still runs after the planner if `ITERLAW_RERANKER_ENABLED=true`.
- The citation gate (legacy + Sprint 29 shadow) is unchanged.
- The entitlement gate (Sprint 30) is unchanged.

## Production gate impact

None. Default-OFF flag.

## What this sprint does NOT do

- Does **not** persist anything to a DB.
- Does **not** ship an embedder. The caller supplies one.
- Does **not** weaken the citation or entitlement gates.
- Does **not** invoke any LLM.
- Does **not** assert a production speed improvement.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
