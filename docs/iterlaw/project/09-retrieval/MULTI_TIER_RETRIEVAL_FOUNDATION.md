# Sprint 19 — Multi-Tier Retrieval Foundation

> **Status: PASS for foundation only.** No production speed claim. No live answer-path wiring.

Cross-reference: [`docs/iterlaw/architecture/ITERLAW_MULTI_TIER_RETRIEVAL_ENGINE.md`](../../architecture/ITERLAW_MULTI_TIER_RETRIEVAL_ENGINE.md).

## What landed

Tier-aware retrieval orchestration under `apps/legal-orchestrator/src/retrieval/`:

- `retrieval.types.ts` — types only (TierName, MetadataFilter, MultiTierPlan, MultiTierResult, etc.).
- `retrievalPlanner.ts` — `planAndExecuteMultiTier(request, deps)`.
- `exactMatchTier.ts` — exact approved Q&A tier (lookup injected).
- `rulesLookupTier.ts` — deterministic rules lookup tier (lookup injected).
- `fullTextTier.ts` — keyword retrieval tier (search injected).
- `vectorTier.ts` — pgvector tier (search injected).
- `metadataFilter.ts` — jurisdiction / law-area / effective-date / min-source-tier.
- `rrfFusion.ts` — deterministic Reciprocal Rank Fusion.
- `retrievalTrustFilter.ts` — trust-based exclusion (failed-QA → 0).
- `retrievalFreshnessFilter.ts` — freshness + historical-mode handling.
- `contextPackBuilder.ts` — final context pack builder.
- `index.ts` — public surface.

Tests: `apps/legal-orchestrator/src/tests/multiTierRetrieval.test.ts` — 13 vitest cases PASS.

## Reuse decision

The existing intelligence layer at `apps/legal-orchestrator/src/intelligence/` already provides query classification, trust scoring, freshness filtering, hybrid retrieval, RRF fusion, context compression, RAG evaluation, and semantic caching. **Those modules were not duplicated.** Sprint 19 adds a tier-aware orchestration layer that composes them. The retrieval-layer trust + freshness + RRF helpers are explicit, smaller implementations sized for the tier semantics (e.g., decision-trace fields are surfaced); they live in parallel to the intelligence-layer primitives without replacing them.

## What this sprint does NOT claim

- No production retrieval improvement.
- No speed measurement.
- No wiring into `handleLegalRequest`.
- No reranker implementation (placeholder tier name only).
- No live DB dependency.

## Next steps

- Wire `planAndExecuteMultiTier` into `handleLegalRequest` behind a feature flag (separate sprint). **DONE** in Sprint 19A.
- Provide real `fullTextSearch` and `vectorSearch` adapters that delegate to `apps/legal-orchestrator/src/rag/postgresRetrieval.ts`. **DONE for FTS** in Sprint 19B (`apps/legal-orchestrator/src/retrieval/postgresRetrievalAdapters.ts`). Vector adapter is intentionally empty until a pgvector port lands.
- Add benchmark harness; measure speed only after the wiring sprint and operator approval. **Harness added** in Sprint 19A (mock-only). Sprint 19B adds an opt-in local-Postgres scenario behind `ITERLAW_BENCH_USE_LOCAL_POSTGRES=true`; no speed claim is asserted.
