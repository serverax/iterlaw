# IterLaw Retrieval Benchmark Harness

> **Mock benchmark only.** This harness exercises `planAndExecuteMultiTier` against three synthetic scenarios. **It does NOT prove production performance.** No DB. No network. No external LLM.

Script: `scripts/bench/iterlaw-retrieval-benchmark.mjs`.

## Run

```
# Build the orchestrator dist first (the harness imports the compiled planner)
cd apps/legal-orchestrator
npm run build
cd ../..

# Run the harness
node scripts/bench/iterlaw-retrieval-benchmark.mjs

# Optional: write a markdown report under reports/logs/
node scripts/bench/iterlaw-retrieval-benchmark.mjs --write-report
```

## Scenarios (mock data)

1. **No adapters.** Tier planner runs with no injected sources. Expected: zero final candidates, every tier reported `skipped` or `no_results`, decision trace captured.
2. **Exact short-circuit.** Injected `exactApprovedLookup` returns a single approved candidate. Expected: planner short-circuits, every later tier reported `skipped`, one final candidate.
3. **Full-text + vector with filters.** Injected `fullTextSearch` and `vectorSearch` return a mix of:
   - one trusted fresh candidate;
   - one stale (superseded) candidate;
   - one failed-QA candidate;
   - one effective-to-passed candidate.
   Expected: stale + failed-QA + expired candidates excluded; final set contains only the two trusted fresh candidates.

## What the harness reports

For each scenario:

- `selected_tiers` — list of tier names that returned `selected`.
- `final_count` — number of candidates in the final set.
- `excluded_trust` — number of candidates the trust filter rejected.
- `excluded_freshness` — number rejected by freshness filter.
- `excluded_metadata` — number rejected by metadata filter.
- `context_pack_size` — size of the context pack the planner would hand downstream.
- `elapsed_ms` — wall-clock duration for `planAndExecuteMultiTier`.

## What this harness does NOT do

- Does **not** call any production DB.
- Does **not** call any external LLM provider.
- Does **not** open any network socket.
- Does **not** claim production speed improvements.
- Does **not** flip any production-readiness gate.

## Optional local-Postgres scenario (Sprint 19B)

Set `ITERLAW_BENCH_USE_LOCAL_POSTGRES=true` to add a fourth scenario that exercises the Sprint 19B `createPostgresRetrievalAdapters(...)` against an optional local `DATABASE_URL`. The scenario:

- Loads `PostgresRetrieval` from the orchestrator dist build (must be built first).
- Constructs a `RetrievalPort` instance — which itself short-circuits to an empty result when `DATABASE_URL` is unset.
- Builds `fullTextSearch` + `vectorSearch` adapters via `createPostgresRetrievalAdapters(...)`.
- Runs the planner against a sample legal question with those adapters injected.

**The bench will NOT print the connection string.** The adapter swallows port errors and never logs `DATABASE_URL`. When `DATABASE_URL` is unset the planner records the empty result honestly and the bench exits 0.

**No production speed claim** is made by either mode. The harness remains a developer tool for plan-shape diagnostics; rigorous performance comparison still requires a controlled baseline run.

## When to extend further

A production-quality benchmark requires:

- An explicit local / staging DB target supplied via env vars (the operator's responsibility).
- Operator authorisation (the existing Sprint 12G authorisation pack already governs production access).
- A baseline-comparison report showing the harness ran against the new tier-aware planner AND the existing single-tier path with the same query set.

The Sprint 19B opt-in adds the first half of the first bullet only. The other items remain operator decisions.

## Sprint 32 — pgvector adapter availability

Sprint 32 ships `createPgvectorSearchFromEmbedder(...)` (see `pgvectorSearchAdapter.ts`). The bench harness does NOT enable it by default — the adapter needs both a real `PgvectorClient` (operator-managed connection) and an embedder. Wiring is left to a future operator-controlled sprint. Mock-only bench scenarios are unchanged.
