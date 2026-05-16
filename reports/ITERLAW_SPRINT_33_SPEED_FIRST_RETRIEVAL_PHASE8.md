# IterLaw Sprint 33 — Speed-First Retrieval Phase 8 (Cache Invalidation)

## Scope

- Migration `129_sprint33_retrieval_cache_invalidation_rules.sql` — admin RLS.
- `retrievalCacheInvalidationPhase8.ts` — rule registry, pattern match, stale purge.
- `zone2RetrievalStub.suggestInvalidationTtl` — TTL tiers by cache type.
- Tests: `sprint33RetrievalCacheInvalidationPhase8.test.ts` (41).

## Verification

- `npm run typecheck` / `npm test` in `apps/legal-orchestrator`.

**Commit (code):** 67c6ccd115089ae669419dee5dd52a5e28ad8c16
