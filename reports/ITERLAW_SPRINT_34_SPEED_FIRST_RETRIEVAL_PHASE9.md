# IterLaw Sprint 34 — Speed-First Retrieval Phase 9 (Fallback Strategy)

## Scope

- Migration `130_sprint34_retrieval_fallback_strategy_log.sql` — fallback audit log (member RLS).
- `retrievalFallbackPhase9.ts` — failure detection, chain selection, event logging.
- Fallback chain: **HNSW → Ollama → BM25 → static FAQ**.
- `zone2RetrievalStub.recommendFallback` — Zone 2 mock recommendation.
- Tests: `sprint34RetrievalFallbackPhase9.test.ts` (45).

## Verification

- `npm run typecheck` / `npm test` in `apps/legal-orchestrator`.

**Commit (code):** b9a493bb51f0a9e21e9bf8c6e9f5e5923bd7fe88
