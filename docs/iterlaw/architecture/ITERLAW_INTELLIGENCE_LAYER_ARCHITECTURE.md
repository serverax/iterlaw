# IterLaw Intelligence Layer — Architecture

> **Status:** Foundation only. Code-prepared. **NOT wired into the
> production answer path.** Existing `handleLegalRequest` and `/ready`
> contracts unchanged.

## 0. Why this layer

The current orchestrator answer path is:

```
user → handleLegalRequest → retrieval (single port) → module pipeline → response
```

Strong on safety; thin on intelligence. The Intelligence Layer sits
ABOVE the orchestrator and below the user-facing controller, adding:

- intent classification;
- planned multi-source retrieval;
- hybrid (keyword + vector) retrieval with RRF fusion;
- trust scoring of every candidate;
- freshness filtering of legal sources;
- context compression with full citation preservation;
- semantic cache keying;
- RAG evaluation (block / needs_review / proceed).

Everything below is mock-safe and pure-function in this sprint. No DB,
no network, no LLM. A future sprint wires it behind a feature flag.

## 1. Target flow

```
User question
  → OrchestrAI / IterLaw controller
  → Intelligence Gateway
      → queryClassifier        (rule-based, keyword-driven)
      → retrievalPlanner       (intent → source-priority list)
      → hybridRetriever        (BM25 + pgvector mock inputs)
          → rrfFusion          (k=60 reciprocal rank fusion)
      → trustScorer            (0..100 by source + qa_status)
      → freshnessFilter        (effective dates, superseded_by)
      → contextCompressor      (truncate + preserve citation metadata)
      → semanticCache          (deterministic SHA-256 key builder)
      → ragEvaluator           (citation coverage, trust threshold,
                                source diversity, block/review/proceed)
  → WASM safety/policy gates   (deferred — see WASM doc)
  → model router               (existing — apps/.../legal/llm)
  → legal answer generator     (existing handleLegalRequest path)
  → critic / citation verifier (deferred)
  → final response
  → save memory + events       (deferred)
```

## 2. Module boundaries

| Module | File | Pure? | Reason codes? |
| --- | --- | --- | --- |
| Query classifier | `apps/legal-orchestrator/src/intelligence/queryClassifier.ts` | yes | yes |
| Retrieval planner | `…/retrievalPlanner.ts` | yes | yes |
| RRF fusion | `…/rrfFusion.ts` | yes | yes |
| Hybrid retriever | `…/hybridRetriever.ts` | yes | yes |
| Trust scorer | `…/trustScorer.ts` | yes | yes |
| Freshness filter | `…/freshnessFilter.ts` | yes | yes |
| Context compressor | `…/contextCompressor.ts` | yes | yes |
| Semantic cache | `…/semanticCache.ts` | yes (sha-256 on inputs) | n/a |
| RAG evaluator | `…/ragEvaluator.ts` | yes | yes |
| Intelligence gateway | `…/intelligenceGateway.ts` | yes (composes the above) | yes |

## 3. Hard rules (carried into every component)

- Pure functions. No I/O at import time.
- No external network call. No `fetch(`. No provider SDK import.
- No real DB call.
- No `kubectl` shell-out.
- No secret read. The semantic cache key is built from non-secret inputs.
- Every decision carries a `reason_codes: string[]` field.
- Legal-mode demotions apply: `draft_ai_output` cannot outrank a
  statutory source; `architecture_decision` cannot outrank a tribunal
  case.

## 4. Decision states

`IntelligenceResult.decision` is one of:

- `proceed` — evidence is sufficient + trust threshold met +
  citation coverage met + no stale legal sources.
- `block` — uncited legal claim, stale legal source, or
  citation_coverage below legal threshold (0.9 by default).
- `needs_review` — below trust threshold, below source diversity,
  or legal source missing effective dates / `last_verified_at`.
- `insufficient_sources` — zero compressed evidence blocks after
  filtering.

## 5. What this layer does NOT do (yet)

- It does NOT call an LLM.
- It does NOT enforce WASM policy gates (separate module — see
  `ITERLAW_WASM_POLICY_GATE_ARCHITECTURE.md`).
- It does NOT write to a database. The semantic cache returns a KEY;
  the eventual store sits outside this layer.
- It does NOT generate answers. It produces a curated evidence pack
  that the existing `handleLegalRequest` path can consume in a
  future wiring sprint.
- It does NOT run any GraphRAG retrieval. GraphRAG comes after
  Hybrid + Trust + Freshness + Compression + Cache mature.

## 6. Wiring plan (deferred to a later sprint, behind a feature flag)

The eventual wiring will be:

1. Add an opt-in `intelligence_enabled` boolean to `LegalRequest` or
   to a small env feature flag.
2. When set, the controller calls `runIntelligenceGateway` first.
3. If decision is `proceed`, the compressed evidence pack is passed
   to `handleLegalRequest` via a new `intelligence_evidence` field
   on the existing deps object.
4. If decision is `block` / `needs_review` / `insufficient_sources`,
   the controller returns the existing refusal envelope (no LLM
   call, no answer generation).

The feature flag default is `false`. Existing tests cover that path
end-to-end and continue to pass.

## 7. Observability hooks (mock-safe)

Every Intelligence Gateway invocation should emit a single
`IntelligenceDecisionTrace` with:

- `request_id` (operator-supplied)
- `intent`
- `plan` (sources, strategy)
- `hybrid` (RRF scores)
- `trust_scores` (per candidate)
- `freshness` (per candidate)
- `compressed` (evidence pack)
- `cache_key` (deterministic)
- `evaluation` (block/review/proceed signals)
- `reason_codes` (cumulative)

The trace is intentionally large for offline analysis. The redacted
audit envelope that ships in `/api/legal/ask` responses will be a
strict subset; the full trace stays in the orchestrator's audit log.

## 8. Sprint 15 wiring status

| Item | State |
| --- | --- |
| Feature flag config | **landed** (`apps/legal-orchestrator/src/config/featureFlags.ts`) |
| Default mode | **off** — Intelligence Layer disabled in every deployment that does not explicitly set both env vars |
| Shadow-mode invocation | **landed** in `handleLegalRequest` — gateway runs, result discarded, response unchanged |
| Active-mode invocation | **PARTIAL** in `handleLegalRequest` — gateway runs, result discarded, response unchanged (functionally identical to shadow until a later sprint authorises richer wiring) |
| `/ready` field | **added** — `intelligence_layer: {configured, mode, external_network_enabled: false, external_llm_enabled: false}` |
| Sprint 15 tests | 26 new tests across 4 files; full suite **72 files / 907 tests PASS** |
| Public response impact | **none** — Intelligence Layer never adds fields to `/api/legal/ask` responses |
| Production default | **disabled** |

The wiring contract is governed by
`docs/iterlaw/project/15-intelligence-layer-wiring/ADR_SPRINT_15_INTELLIGENCE_LAYER_FEATURE_FLAGGED_WIRING.md`.
