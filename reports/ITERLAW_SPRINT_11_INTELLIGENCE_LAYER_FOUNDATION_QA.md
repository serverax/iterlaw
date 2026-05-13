# IterLaw Sprint 11 Intelligence Layer Foundation — QA Report

> **Sprint numbering note.** The instruction title used "Sprint 11" but
> Sprint 11 in this repo is already closed (PASS — Local LLM gateway +
> RAG citation gate; commits `3681fab`, `120b9de`, `00f03f9` already on
> `origin/master`). To avoid regressing closed-sprint state, this
> Intelligence Layer work is recorded as **Sprint 14**. This QA report
> uses the filename specified in the instruction.

## 1. Status

**PASS — foundation / code-prepared only.**

The Intelligence Layer foundation is in place: types, 11 pure-function
modules, 7 vitest files, 6 architecture docs, 1 sprint plan. None of
it is wired into the production answer path. Existing `/ready`
envelope is unchanged. Existing legal-safety flags remain `true`.
Existing tests still pass.

## 2. Files changed

### New source files

| Path |
| --- |
| `apps/legal-orchestrator/src/intelligence/intelligence.types.ts` |
| `apps/legal-orchestrator/src/intelligence/queryClassifier.ts` |
| `apps/legal-orchestrator/src/intelligence/retrievalPlanner.ts` |
| `apps/legal-orchestrator/src/intelligence/rrfFusion.ts` |
| `apps/legal-orchestrator/src/intelligence/hybridRetriever.ts` |
| `apps/legal-orchestrator/src/intelligence/trustScorer.ts` |
| `apps/legal-orchestrator/src/intelligence/freshnessFilter.ts` |
| `apps/legal-orchestrator/src/intelligence/contextCompressor.ts` |
| `apps/legal-orchestrator/src/intelligence/semanticCache.ts` |
| `apps/legal-orchestrator/src/intelligence/ragEvaluator.ts` |
| `apps/legal-orchestrator/src/intelligence/intelligenceGateway.ts` |

### Modified source file

| Path | Change |
| --- | --- |
| `apps/legal-orchestrator/src/intelligence/index.ts` | Added Sprint 14 barrel exports alongside existing FastAnswer engine exports. |

### New test files

| Path | Test count |
| --- | --- |
| `apps/legal-orchestrator/src/tests/intelligenceGateway.test.ts` | 7 |
| `apps/legal-orchestrator/src/tests/hybridRetrievalPlanning.test.ts` | 9 |
| `apps/legal-orchestrator/src/tests/trustScorer.test.ts` | 9 |
| `apps/legal-orchestrator/src/tests/freshnessFilter.test.ts` | 8 |
| `apps/legal-orchestrator/src/tests/contextCompressor.test.ts` | 6 |
| `apps/legal-orchestrator/src/tests/semanticCache.test.ts` | 8 |
| `apps/legal-orchestrator/src/tests/ragEvaluator.test.ts` | 7 |
| **Total** | **54** |

### New documentation

| Path |
| --- |
| `docs/iterlaw/project/07-sprints/SPRINT_14_INTELLIGENCE_LAYER_PLAN.md` |
| `docs/iterlaw/architecture/ITERLAW_INTELLIGENCE_LAYER_ARCHITECTURE.md` |
| `docs/iterlaw/architecture/ITERLAW_WASM_POLICY_GATE_ARCHITECTURE.md` |
| `docs/iterlaw/architecture/ITERLAW_GRAPHRAG_ROADMAP.md` |
| `docs/iterlaw/architecture/ITERLAW_RAG_TRUST_AND_FRESHNESS_MODEL.md` |
| `docs/iterlaw/architecture/ITERLAW_SEMANTIC_CACHE_DESIGN.md` |
| `docs/iterlaw/architecture/ITERLAW_LEGAL_EVALUATION_HARNESS.md` |
| `reports/ITERLAW_SPRINT_11_INTELLIGENCE_LAYER_FOUNDATION_QA.md` (this file) |

## 3. Commands run

| Command (cwd `apps/legal-orchestrator`) | Exit | Summary |
| --- | --- | --- |
| `npx tsc --noEmit` | 0 | **PASS** |
| `npm run build` (`tsc`) | 0 | **PASS** |
| `npx vitest run` (full suite) | 0 | **68 files / 881 tests PASS** (was 61 / 827 → +7 files / +54 tests) |
| `npx vitest run src/tests/intelligenceGateway.test.ts src/tests/hybridRetrievalPlanning.test.ts src/tests/trustScorer.test.ts src/tests/freshnessFilter.test.ts src/tests/contextCompressor.test.ts src/tests/semanticCache.test.ts src/tests/ragEvaluator.test.ts` | 0 | **54 / 54 PASS** |

## 4. Safety scan result

### `rg -n "rightsnow\|RightsNow" docs apps k8s scripts reports`

- 0 hits in `apps/legal-orchestrator/src/intelligence/`.
- 0 hits in `docs/iterlaw/architecture/`.
- (Hits elsewhere are pre-existing historical references in legacy /
  archive paths, allowed by canonical naming policy.)

### `rg -n "openai\|anthropic\|gemini\|claude\|fetch\\(\|axios\\(" apps/legal-orchestrator/src/intelligence apps/legal-orchestrator/src/wasm`

- 0 hits in `apps/legal-orchestrator/src/intelligence/`.
- `apps/legal-orchestrator/src/wasm/` is the existing rule-runner host
  (Wasmtime); no new wasm code was added in this sprint, and the
  existing files there do not contain external-provider imports.

### `rg -n "DATABASE_URL=.*://\|password\|token\|secret" apps/legal-orchestrator/src/intelligence docs/iterlaw/architecture reports`

- 0 hits in `apps/legal-orchestrator/src/intelligence/`.
- 6 hits in `docs/iterlaw/architecture/`: all are **negative claims**
  ("no secret read", "no token, no password, no API key", "must not
  read or print secrets"). Classification: **safe docs warning**.
- 0 hits in this report beyond the present section's quoted scan
  command.

### Carry-over scans

- 0 `kubectl apply / delete / patch / edit / scale / rollout` under
  `apps/legal-orchestrator/src/intelligence/` or
  `docs/iterlaw/architecture/`.
- 0 literal `postgres://user:pw@host` credential-bearing DSN under
  Sprint 14 paths.

**No unsafe active usage.**

## 5. External LLM / network scan

- No `fetch(` literal in
  `apps/legal-orchestrator/src/intelligence/**`.
- No `axios(` literal in
  `apps/legal-orchestrator/src/intelligence/**`.
- No provider SDK import (`openai`, `@anthropic-ai`, `@google/generative-ai`, `cohere-ai`, `@mistralai/*`) in
  `apps/legal-orchestrator/src/intelligence/**`.
- The `semanticCache.ts` module imports `node:crypto` only.
- The `freshnessFilter.ts` module reads system clock via `new Date()`
  but takes `now_utc` as an option for deterministic tests.

## 6. Existing answer-path guarantees preserved

- `/ready` envelope shape: **unchanged**. Asserted by the Sprint 8
  `/ready` envelope tests and the Sprint 13 readiness smoke tests
  (both run as part of the 68-file / 881-test full suite).
- `legal_safety.citation_required`: **remains `true`**.
- `legal_safety.zero_citation_answer_blocked`: **remains `true`**.
- `llm.external_llm_enabled`: **remains `false`**.
- `handleLegalRequest` answer-path tests (Sprint 8 / 11 / 13):
  **all green**, no regressions.

## 7. Status protection

- **Sprint 10:** **PASS** — Docker staging replay PASS evidence at
  `reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md` (commit
  `5edf953` already on `origin/master`). **NOT marked PARTIAL by
  this report.**
- **Sprint 11:** **PASS** — Phase 1 + Phase 2A + hardening +
  Phase 2B + Phase 4 (commits `3681fab`, `120b9de`, `00f03f9`
  already on `origin/master`). **NOT marked production-unblocked.**
- **Sprint 12:** **PASS FOR DRY-RUN FOUNDATION ONLY.**
- **Sprint 13:** **PASS FOR OPERATOR-WORKSTATION READINESS ONLY.**
- **Sprint 14 (this work):** **FOUNDATION / CODE-PREPARED ONLY** —
  not production-unblocking; no live wiring; behind no feature flag
  yet.
- **Production:** **BLOCKED.**

## 8. Truth statement

- No production DB touched.
- No deployment performed.
- No `kubectl` mutating command performed.
- No `kubectl` of any kind performed against any cluster.
- No external LLM call performed.
- No `fetch(` added under `apps/legal-orchestrator/src/intelligence/**`.
- No secrets committed.
- Sprint 10 remains **PASS** (staging replay evidence already exists).
- Sprint 11 remains **PASS — code-prepared and production-blocked**
  (production unblock not asserted by this work).
- Sprint 14 Intelligence Layer is **FOUNDATION / CODE-PREP only**.
- Production status: **BLOCKED**.
