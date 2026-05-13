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

## When to extend

A real-DB benchmark requires:

- An explicit local / staging DB target supplied via env vars.
- Operator authorisation (the existing Sprint 12G authorisation pack already governs production access).
- A baseline-comparison report showing the harness ran against the new tier-aware planner AND the existing single-tier path with the same query set.

None of those preconditions is met yet. Until they are, the harness remains a **mock-only** developer tool.
