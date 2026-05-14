# IterLaw Multi-Tier Retrieval Engine Architecture

> **Foundation only.** This document and the code under `apps/legal-orchestrator/src/retrieval/` describe a deterministic, pure-function orchestration layer on top of the existing intelligence-layer primitives. The engine is **not** wired into the live answer path by this sprint, and **no** speed improvement is claimed until benchmarked under change control.

Reuse vs. new code:

- `apps/legal-orchestrator/src/intelligence/` already provides `queryClassifier`, `trustScorer`, `freshnessFilter`, `hybridRetriever`, `rrfFusion`, `contextCompressor`, `ragEvaluator`, `semanticCache`. Those modules are unchanged.
- Sprint 19 adds `apps/legal-orchestrator/src/retrieval/` as a thin tier-aware orchestration layer that composes the existing primitives.

## 1. Tiers

| # | Tier | Purpose | When selected |
|---|---|---|---|
| 1 | `exact_approved_qa` | Previously approved canonical answers | Always probed; short-circuits the rest when it hits |
| 2 | `rules_lookup` | Deterministic legal calculators (redundancy, NMW, limitation) | Only when `queryType === "legal_rules_calculation"` |
| 3 | `full_text` | BM25-style keyword search | All legal queries |
| 4 | `vector` | pgvector semantic search | All legal queries |
| 5 | metadata filter | Jurisdiction / law area / effective-date / min-source-tier | Always (post-fetch) |
| 6 | trust filter | Excludes failed-QA + low-trust draft AI output | Always (post-fetch) |
| 7 | freshness filter | Excludes superseded / out-of-effect content (unless historical mode) | Always (post-fetch) |
| 8 | RRF fusion | Deduplicates and ranks `full_text + vector` | Always (post-fetch) |
| 9 | reranker (placeholder) | Stable identifier in the tier list | Not implemented in Sprint 19 |
| 10 | `compressed_context` (placeholder) | `buildContextPack` placeholder ahead of `intelligence/contextCompressor` integration | Wired in a future sprint |

The planner records a decision trace for every tier, including `selected` / `skipped` / `no_results` / `blocked_by_trust` / `blocked_by_freshness` / `blocked_by_metadata`.

## 2. Planner contract

`planAndExecuteMultiTier(request, deps)`:

- **Pure orchestration.** No DB call. No network. No external LLM. Data sources are injected via `deps`.
- **Without injected deps**, every tier returns `status: "skipped"` or `"no_results"` with a clear reason code. The planner never invents data.
- **Short-circuit:** if the exact approved tier returns a hit, every other tier is recorded as `skipped`, and the exact hit becomes the only final candidate.
- **Historical mode:** when `queryType === "historical_comparison"`, the freshness filter keeps superseded content with a warning rather than excluding it.
- **Final candidate cap:** controlled by `maxFinalCandidates` (default 8).
- **Minimum trust score:** controlled by `minTrustScore` (default 60). Failed-QA candidates score 0 and are always blocked.

## 3. Type contract

See `apps/legal-orchestrator/src/retrieval/retrieval.types.ts`:

- `TierName` — eight stable identifiers including the two placeholders.
- `MetadataFilter` — jurisdiction, lawArea, minSourceTier, effectiveAtIsoDate, historicalMode.
- `MultiTierPlan` — tiers + reasonCodes recorded before execution.
- `TierResult` — per-tier status + candidates + reasonCodes.
- `MultiTierResult` — plan, per-tier results, fused output, final candidates, excluded-by-X lists, decision trace.

## 4. What this sprint deliberately does NOT do

- Does **not** wire the planner into `handleLegalRequest`. The orchestrator answer path remains unchanged until a separate wiring sprint approves the integration plan.
- Does **not** implement a real reranker (placeholder tier name only).
- Does **not** replace `intelligence/contextCompressor.ts` — the new `contextPackBuilder.ts` is a thin builder used by the planner's final step; full compression remains in the intelligence layer.
- Does **not** measure any speed improvement. No benchmark claim is made.

## 5. Test contract

`apps/legal-orchestrator/src/tests/multiTierRetrieval.test.ts` — 13 tests cover:

- Exact approved result outranks every other tier and short-circuits.
- `legal_rules_calculation` selects the rules tier.
- Normal `legal_question` uses full-text + vector and fuses with RRF.
- Stale (superseded) result is excluded outside historical mode.
- `historical_comparison` keeps superseded results with a warning.
- Failed-QA candidates are excluded.
- Decision trace is well-formed.
- RRF deduplication.
- Metadata filter rejects below-min-source-tier candidates.
- Trust filter blocks failed-QA with score 0.
- Freshness filter rejects effective-to-passed content outside historical mode.
- Freshness filter keeps superseded content in historical mode with reason code.
- Context pack builder preserves title/url and trims snippet length.

All 13 pass alongside the existing 924 vitest tests; the orchestrator suite is now **75 files / 937 tests PASS**.

## Sprint 19B — Postgres retrieval adapters

`apps/legal-orchestrator/src/retrieval/postgresRetrievalAdapters.ts` exposes:

- `createPostgresFullTextSearch(port, options)` — produces a `FullTextSearch` function suitable for `PlannerDependencies.fullTextSearch`. Delegates to a `RetrievalPort` (`apps/legal-orchestrator/src/rag/retrieval.port.ts`) — typically backed by `PostgresRetrieval` (`apps/legal-orchestrator/src/rag/postgresRetrieval.ts`). Maps `RetrievedLegalChunk` → `RetrievalCandidate` via `mapCorpusSourceType()`.
- `createPostgresVectorSearch(port, options)` — produces a `VectorSearch` function. Returns `[]` in this sprint because the underlying `PostgresRetrieval` is FTS-only; a future sprint can add a pgvector capability to the port.
- `createPostgresRetrievalAdapters(port, options)` — convenience factory that builds both at once.

Safety contract (verified by `apps/legal-orchestrator/src/tests/postgresRetrievalAdapters.test.ts`, 10 vitest cases):

- No port → empty result (mock-safe).
- Empty `chunks` array → empty result.
- Port `throw` → empty result + no error detail leaked (test exercises a thrown DSN-shaped string and asserts the adapter swallows it).
- Hard limit caps the result count below the tier limit.
- Jurisdiction + topic are forwarded to the underlying port's `RetrievalQuery`.
- `vectorSearch` always returns empty (FTS-only in this sprint).

The benchmark harness (`scripts/bench/iterlaw-retrieval-benchmark.mjs`) gains an opt-in fourth scenario behind `ITERLAW_BENCH_USE_LOCAL_POSTGRES=true` that uses these adapters against an optional local `DATABASE_URL`. The bench never prints the connection string; with `DATABASE_URL` unset it records an empty result honestly and exits 0.

## Sprint 32 — real pgvector vectorSearch adapter

`apps/legal-orchestrator/src/retrieval/pgvectorSearchAdapter.ts` adds:

- `createPgvectorSearch({ client, hardLimit? })` — returns `(embedding, options) => RetrievalCandidate[]`. Mock-safe: with no client returns []; with a client that throws returns []. Never reads or prints `DATABASE_URL`.
- `createPgvectorSearchFromEmbedder(client, embedder)` — bridges `(question, opts)` → embed → pgvector search → candidate mapping. Surfaces the existing `VectorSearch` shape so the planner can consume it.
- `PgvectorClient` interface — `searchByEmbedding(embedding, options)`; the operator's actual `pg` / `pgvector` integration owns connection management. The adapter never touches `process.env`.

11 vitest cases at `apps/legal-orchestrator/src/tests/pgvectorSearchAdapter.test.ts` verify: no-client returns [], empty embedding short-circuits without IO, row → candidate mapping with ascending `vector_rank`, hard-limit caps results, client exceptions swallowed, forwarded options, embedder failure handled.

The pgvector adapter is **not** wired into `runMultiTierRetrievalGateway` by default. A future sprint can wire it when an operator supplies a real client + embedder.
