# IterLaw Sprint 31 — Speed-First Retrieval Phase 6 (Query Optimization)

## Scope

- Migration `127_sprint31_retrieval_query_plan_cache.sql` — `retrieval_query_plan_cache` (admin RLS).
- `retrievalQueryOptPhase6.ts` — plan analysis, index suggestions, plan vs actual ratio, in-memory plan cache.
- `zone2RetrievalStub.optimizeQueryRemote` — deterministic fingerprint + `estRows`.
- Tests: `sprint31RetrievalQueryOptPhase6.test.ts` (46).

## Verification

- `npm run typecheck` / `npm test` in `apps/legal-orchestrator`.

**Commit (code):** 663711a2b6f1bfac1049496ec12c44814653d0bb
