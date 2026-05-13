# Sprint 19 — Multi-Tier Retrieval Foundation Report

## STATUS: PASS

Tier-aware retrieval orchestration layer added under `apps/legal-orchestrator/src/retrieval/`. Builds on top of existing intelligence-layer primitives; no duplication. 13 new vitest cases all PASS. Orchestrator suite grew 74/924 → **75 / 937 tests PASS**. No live answer-path wiring, no speed claim, no benchmark — explicitly out of scope per Sprint 19 rules.

---

## 1. Files added

- `apps/legal-orchestrator/src/retrieval/retrieval.types.ts`
- `apps/legal-orchestrator/src/retrieval/retrievalPlanner.ts`
- `apps/legal-orchestrator/src/retrieval/exactMatchTier.ts`
- `apps/legal-orchestrator/src/retrieval/rulesLookupTier.ts`
- `apps/legal-orchestrator/src/retrieval/fullTextTier.ts`
- `apps/legal-orchestrator/src/retrieval/vectorTier.ts`
- `apps/legal-orchestrator/src/retrieval/metadataFilter.ts`
- `apps/legal-orchestrator/src/retrieval/rrfFusion.ts`
- `apps/legal-orchestrator/src/retrieval/retrievalTrustFilter.ts`
- `apps/legal-orchestrator/src/retrieval/retrievalFreshnessFilter.ts`
- `apps/legal-orchestrator/src/retrieval/contextPackBuilder.ts`
- `apps/legal-orchestrator/src/retrieval/index.ts`
- `apps/legal-orchestrator/src/tests/multiTierRetrieval.test.ts`
- `docs/iterlaw/architecture/ITERLAW_MULTI_TIER_RETRIEVAL_ENGINE.md`
- `docs/iterlaw/project/09-retrieval/MULTI_TIER_RETRIEVAL_FOUNDATION.md`
- `reports/ITERLAW_SPRINT_19_MULTI_TIER_RETRIEVAL_FOUNDATION.md` (this report)

## 2. Reuse-vs-new design decision

`apps/legal-orchestrator/src/intelligence/` already provides `queryClassifier`, `trustScorer`, `freshnessFilter`, `hybridRetriever`, `rrfFusion`, `contextCompressor`, `ragEvaluator`, `semanticCache`. **None of those were modified or duplicated.** Sprint 19 places the new tier-aware orchestration under `apps/legal-orchestrator/src/retrieval/` as a separate, parallel layer that composes intelligence primitives where appropriate and exposes smaller, decision-trace-friendly helpers where the tier semantics require explicit reasoning (`applyMetadataFilter`, `applyTrustFilter`, `applyFreshnessFilter`, `fuseRrf`, `buildContextPack`).

This decision is recorded in the architecture doc + the foundation doc + this report.

## 3. Test contract (acceptance evidence)

```
$ npx vitest run src/tests/multiTierRetrieval.test.ts
 ✓ src/tests/multiTierRetrieval.test.ts (13 tests)
 Test Files  1 passed (1)
      Tests  13 passed (13)
(exit 0)
```

The 13 cases cover every Sprint 19 acceptance gate:

- Exact approved result outranks every other tier and short-circuits.
- `legal_rules_calculation` selects the rules tier.
- Normal `legal_question` uses full-text + vector + RRF fusion.
- Stale (superseded) result excluded outside historical mode.
- `historical_comparison` mode keeps superseded content with reason code.
- Failed-QA candidates blocked by trust filter (score 0).
- Decision trace is present and well-formed.
- RRF deduplicates by `candidate_id`.
- Metadata filter rejects below-minimum-source-tier.
- Trust filter blocks failed-QA with score 0 and reason `trust_blocked_failed_qa`.
- Freshness filter rejects `effective_to`-passed content.
- Freshness filter keeps superseded content in historical mode with reason `freshness_superseded`.
- Context pack builder preserves source title / url and trims snippet length.

## 4. Full QA results

```
$ npm run typecheck                              →   exit 0
$ npm run lint                                   →   exit 0 ("✔ No ESLint warnings or errors")
$ npm test                                       →   41 suites / 185 tests PASS   exit 0
$ cd apps/legal-orchestrator && npm run typecheck →   exit 0
$ cd apps/legal-orchestrator && npm run build    →   exit 0
$ cd apps/legal-orchestrator && npm test         →   75 files / 937 tests PASS    exit 0   (+1 file / +13 tests from Sprint 19)
```

No regressions. Orchestrator vitest suite grew from 74 / 924 to **75 / 937** (Sprint 19 contributes 13 tests).

## 5. What was deliberately NOT done

- Planner is **not** wired into `handleLegalRequest` (separate sprint required after operator-approved integration plan).
- No reranker implementation; only the tier name `rerank_placeholder` is reserved.
- No live DB call; the actual full-text and vector adapters remain in `src/rag/postgresRetrieval.ts` and are injected if/when wiring sprint authorises.
- No benchmark; no production speed claim. The architecture doc explicitly states "no speed improvement is claimed until benchmarked under change control".

## 6. Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl`. No production DB touched. No external LLM call. No secrets committed.
- No force-push. No git history rewrite.
- No `npm audit fix --force`.
- No production retrieval improvement claimed; foundation only.
- The new retrieval layer is independent of, and does not modify, the existing intelligence layer.

## 7. Sprint 19 verdict

**STATUS: PASS** for the named foundation scope. Tier orchestration + types + tests in place; QA green; no false production claim.
