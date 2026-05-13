# Sprint 14 — Intelligence Layer Foundation (code-prep)

> **Note on sprint numbering.** The task contract was titled
> *SPRINT_11_INTELLIGENCE_LAYER_PLAN.md*. Sprint 11 in this repo is
> already closed (PASS — Local LLM gateway + RAG citation gate;
> commits `3681fab`, `120b9de`, `00f03f9` on `origin/master`).
> Sprint 12 (PASS-for-dry-run-foundation) and Sprint 13
> (PASS-for-operator-workstation-readiness) have closed since. To
> avoid regressing closed-sprint state, this Intelligence Layer
> work is recorded as **Sprint 14**.

## 0. Status

**Foundation only. Code-prepared.** Not wired into the production
answer path. Existing `handleLegalRequest` and `/ready` envelopes
are unchanged. Existing tests still pass.

## 1. Objective

Add an Intelligence Layer above the legal-orchestrator that makes
the algorithm and RAG stronger, faster, safer, and smarter — without
replacing existing working code. Sprint 14 ships the **safe
foundation** of that layer: types, pure-function modules, tests, and
architecture docs. A later sprint wires the layer behind a feature
flag.

## 2. In-scope deliverables (this sprint)

### Code skeleton

```
apps/legal-orchestrator/src/intelligence/
  intelligence.types.ts        types contract
  queryClassifier.ts           rule-based intent classifier
  retrievalPlanner.ts          intent → source priority + strategy
  rrfFusion.ts                 deterministic RRF (k=60)
  hybridRetriever.ts           orchestrates RRF over keyword + vector
  trustScorer.ts               0..100 scoring with legal-mode demotions
  freshnessFilter.ts           effective dates + superseded_by
  contextCompressor.ts         truncation + citation preservation
  semanticCache.ts             deterministic key builder + INVALIDATORS
  ragEvaluator.ts              citation coverage / block / review
  intelligenceGateway.ts       composes the above; pure
  index.ts                     barrel (merged with existing FAE exports)
```

### Tests

```
apps/legal-orchestrator/src/tests/
  intelligenceGateway.test.ts      (7 tests)
  hybridRetrievalPlanning.test.ts  (9 tests)
  trustScorer.test.ts              (9 tests)
  freshnessFilter.test.ts          (8 tests)
  contextCompressor.test.ts        (6 tests)
  semanticCache.test.ts            (8 tests)
  ragEvaluator.test.ts             (7 tests)
```

Total: **54 new tests**, all green.

### Architecture docs

```
docs/iterlaw/architecture/
  ITERLAW_INTELLIGENCE_LAYER_ARCHITECTURE.md
  ITERLAW_WASM_POLICY_GATE_ARCHITECTURE.md
  ITERLAW_GRAPHRAG_ROADMAP.md
  ITERLAW_RAG_TRUST_AND_FRESHNESS_MODEL.md
  ITERLAW_SEMANTIC_CACHE_DESIGN.md
  ITERLAW_LEGAL_EVALUATION_HARNESS.md
```

## 3. Out of scope

- Wiring into `handleLegalRequest` or `/api/legal/ask` — deferred to a
  later sprint behind a feature flag.
- Any change to the `/ready` envelope.
- Real BM25 + pgvector implementations — Sprint 14 takes ranked
  candidate arrays as inputs.
- Real WASM policy gate binary — separate ADR + sprint.
- Neo4j or any graph DB install — see GraphRAG roadmap.
- Real semantic cache store (Redis or table) — Sprint 14 ships the
  KEY builder only.
- Golden legal test suite + nightly eval CI.
- Production touch of any kind.
- External LLM call of any kind.
- Database mutation.
- `kubectl` of any kind.

## 4. Hard rules carried into every Sprint 14 deliverable

- Pure functions where possible.
- No I/O at module import time.
- No `fetch(` literal anywhere in `apps/legal-orchestrator/src/intelligence/**`.
- No provider SDK import (OpenAI / Anthropic / Cohere / Mistral / Gemini / Azure OpenAI).
- No live DB call.
- No secret read.
- Every decision carries `reason_codes: string[]`.
- Legal-mode demotions enforced in `trustScorer.ts`.
- Stale legal sources never reach the compressed evidence pack in
  legal mode (unless `allow_historical = true`).

## 5. Wiring plan (deferred)

A future sprint:

1. Adds an opt-in env flag (e.g. `ITERLAW_INTELLIGENCE_ENABLED=1`)
   or a per-request flag on `LegalRequest`.
2. When enabled, the controller calls `runIntelligenceGateway` first.
3. If `decision === "proceed"`, the compressed evidence pack is
   passed to `handleLegalRequest` via a new (additive)
   `intelligence_evidence` deps field.
4. If `decision !== "proceed"`, the controller returns the existing
   refusal envelope (`insufficient_sources`, `citation_failed`,
   `policy_failed`, `needs_more_facts`, `high_risk_deadline`, or a
   new mapping for `needs_review`).
5. Existing tests cover the disabled path end-to-end and remain
   green.

## 6. Acceptance criteria (Sprint 14)

- [x] All 12 source files exist under
  `apps/legal-orchestrator/src/intelligence/`.
- [x] All 7 test files exist under
  `apps/legal-orchestrator/src/tests/`.
- [x] All 6 architecture docs exist under
  `docs/iterlaw/architecture/`.
- [x] Typecheck PASS.
- [x] Build PASS.
- [x] Vitest full suite PASS (68 files / 881 tests — was 61 / 827
  at Sprint 13 close → **+7 files / +54 tests**).
- [x] No `fetch(` literal under
  `apps/legal-orchestrator/src/intelligence/`.
- [x] No OpenAI / Anthropic / Gemini / Claude / Cohere / Mistral
  import under `apps/legal-orchestrator/src/intelligence/`.
- [x] No DSN-like literal under
  `apps/legal-orchestrator/src/intelligence/` or under
  `docs/iterlaw/architecture/` (other than placeholder env-var names).
- [x] Existing `/ready` envelope unchanged.
- [x] Existing legal safety flags remain true.
- [x] No production DB touched.
- [x] No deployment performed.
- [x] No `kubectl` command performed.

## 7. Sprint 10 + 11 status protection

- Sprint 10 remains **PASS** (Docker staging replay, `5edf953`,
  report `reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`).
- Sprint 11 remains **PASS** (commits `3681fab` + `120b9de` +
  `00f03f9` already on `origin/master`).
- Sprint 12 remains **PASS FOR DRY-RUN FOUNDATION ONLY**.
- Sprint 13 remains **PASS FOR OPERATOR-WORKSTATION READINESS ONLY**.
- Sprint 14 (this sprint) is **FOUNDATION / CODE-PREPARED ONLY** —
  not production-unblocking, not authorising any new live path.
- Production remains **BLOCKED**.
