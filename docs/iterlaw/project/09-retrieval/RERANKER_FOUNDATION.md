# Reranker Foundation (Sprint 23)

**Status:** PASS (foundation only; default-OFF feature flag).

## What this sprint delivered

- `apps/legal-orchestrator/src/retrieval/reranker.ts` — pure `rerankCandidates(candidates, ctx, weights?)` function.
- `apps/legal-orchestrator/src/tests/rerankerPolicy.test.ts` — 13 vitest cases.
- `apps/legal-orchestrator/src/config/featureFlags.ts` — `ITERLAW_RERANKER_ENABLED` flag (default OFF).
- Public re-export from `apps/legal-orchestrator/src/retrieval/index.ts`.

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/rerankerPolicy.test.ts
 ✓ src/tests/rerankerPolicy.test.ts (13 tests) 9ms
TEST_EXIT=0
```

Tests assert each of:

- Higher trust outranks lower trust.
- Fresh outranks stale (effective_to + superseded_by).
- Primary legislation outranks acas guidance.
- Exact-match boost reorders an otherwise-tied pair.
- Jurisdiction match adds a point when the URL carries the hint.
- Law-area match adds a point when the title carries the hint.
- Complete citation metadata outranks incomplete.
- Stale + low-trust + missing metadata stack to a negative-direction score.
- Stable sort preserves order on equal scores.
- Decision trace is present for every input.
- Feature flag defaults OFF.
- Feature flag parses only `true | 1 | yes | on` as ON.

## What this sprint does NOT do

- Does **not** call any external reranker model or LLM.
- Does **not** embed text.
- Does **not** wire itself into `handleLegalRequest`. The multi-tier gateway can compose `rerankCandidates` over its `final_candidates` when `ITERLAW_RERANKER_ENABLED=true`; that wiring is a future sprint under change control.
- Does **not** assert any production relevance improvement.

## Sprint 28 follow-up

Sprint 28 wires the reranker into `runMultiTierRetrievalGateway`. See `docs/iterlaw/architecture/ITERLAW_RERANKER_POLICY.md` "Sprint 28 — wired into the multi-tier retrieval gateway" and `reports/ITERLAW_SPRINT_28_RERANKER_GATEWAY_WIRING.md`. Tests at `apps/legal-orchestrator/src/tests/rerankerGatewayFlag.test.ts`.

## Architecture cross-reference

[`docs/iterlaw/architecture/ITERLAW_RERANKER_POLICY.md`](../../architecture/ITERLAW_RERANKER_POLICY.md).
