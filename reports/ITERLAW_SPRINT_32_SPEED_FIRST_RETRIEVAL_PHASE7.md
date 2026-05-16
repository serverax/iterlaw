# IterLaw Sprint 32 — Speed-First Retrieval Phase 7 (Batch Queries)

## Scope

- Migration `128_sprint32_retrieval_batch_query_jobs.sql` — `retrieval_batch_query_jobs` (user-scoped RLS).
- `retrievalBatchPhase7.ts` — `queueBatchQueries`, `processBatchParallel`, `aggregateBatchResults`.
- `zone2RetrievalStub.processBatchRemote` — deterministic per-query summaries.
- Tests: `sprint32RetrievalBatchPhase7.test.ts` (47).

## Verification

- `npm run typecheck` / `npm test` in `apps/legal-orchestrator`.

**Commit (code):** 7987f3711f1a258baf10ef62e3f01bc4af914bae
