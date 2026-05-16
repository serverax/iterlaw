# IterLaw Sprint 30 — Speed-First Retrieval Phase 5 (Latency SLA)

## Scope

- Migration `126_sprint30_retrieval_latency_metrics.sql` — `retrieval_latency_metrics` (admin RLS).
- `retrievalLatencySLAPhase5.ts` — percentiles, SLA check, measurement snapshot + row serializer.
- `zone2RetrievalStub.computeLatencyBudget` — bounded mock SLA target vs request size.
- Tests: `sprint30RetrievalLatencySLAPhase5.test.ts` (46).

## Verification

- `npm run typecheck` / `npm test` in `apps/legal-orchestrator`.

**Commit (code):** 9be876f6fd91c2625b552dd8de3786a906daa352
