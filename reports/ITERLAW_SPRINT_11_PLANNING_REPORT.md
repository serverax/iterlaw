# Sprint 11 — Planning Report

**Status:** PASS (planning only). **Sprint 11 implementation NOT STARTED.** Blocker: Sprint 10 staging DB verification PENDING.

## Files inspected (read-only)

Small project docs (Task 2):

- `docs/iterlaw/project/00-index/AI_TOOL_START_HERE.md` (49 lines)
- `docs/iterlaw/project/README.md` (65)
- `docs/iterlaw/project/01-architecture/ARCHITECTURE_SUMMARY.md` (54)
- `docs/iterlaw/project/03-rag/RAG_SUMMARY.md` (66)
- `docs/iterlaw/project/04-ai-llm/LOCAL_LLM_AND_WASM.md` (85)
- `docs/iterlaw/project/08-qa/QA_PROCESS.md` (75)
- `docs/iterlaw/project/09-operations/OPERATIONS_RULES.md` (68)
- `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` (49)

Source inventory (Tasks 3–4):

- `apps/legal-orchestrator/src/legal/llm/` — 5 files (`localOllamaGateway.ts`, `llmGateway.types.ts`, `localLlmGateway.ts`, `boundedSynthesis.ts`, `index.ts`).
- `apps/legal-orchestrator/src/pipeline/` — 6 files (`buildLegalPrompt.ts`, `classifyRequest.ts`, `immediateRiskCheck.ts`, `policyGate.ts`, `verifyCitations.ts`, `handleLegalRequest.ts`).
- `apps/legal-orchestrator/src/rag/` — 9 files (canonical 001-chain retrieval port + temporal filter + mock + Postgres adapter + repository).
- `apps/legal-orchestrator/src/modules/` — 9 deterministic modules (citationVerifier, deadlineChecker, policyGate, piiRedactor, ruleEngine, sourceRanker + supporting).
- `apps/legal-orchestrator/src/wasm/` — wasmRunner + 3 rule modules (deadlineCalculator, redundancyCalculator, ventoBandSelector).

Existing Sprint 11 deep doc: `docs/iterlaw/SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md` (83 lines) — companion to the new small plan.
Benchmark plan + checklist: `docs/benchmarks/SPRINT_11_LOCAL_LLM_BENCHMARK_PLAN.md` + `SPRINT_11_LOCAL_LLM_BENCHMARK_EXECUTION_CHECKLIST.md`.

## Code findings (no edits made)

- `localLlmGateway.ts` already implements env-driven `describeLocalLlmGateway()` returning `{configured, mode, available, reason}`. Default `mode='disabled'`, fail-closed when GUCs absent.
- `boundedSynthesis.ts` already implements the refusal guard. Returns `insufficient_sources` / `citation_failed` / `llm_unavailable` / `blocked_by_policy`. The `synthesised` branch is the only one Sprint 11 will activate.
- `handleLegalRequest.ts` already enforces RAG retrieval → citation gate → safe-default refusal. Sprint 11 inserts the bounded-synthesis call between the citation gate and the final `verifyCitations`.
- Grep across `apps/legal-orchestrator/src/`: no production-path import of `openai`, `anthropic`, `generativelanguage`, `node-fetch`, `undici`, or `axios`. Every external-provider string appears only in **test deny-lists** (`fastAnswerPlanner.test.ts`, `ingestDryRunStatic.test.ts`, `handleEmploymentLawQuestion.test.ts`, `sprint10LiveRagWiring.test.ts`, `sprint11LlmGateway.test.ts`, `ingestion.sprint11.framework.test.ts`, `wasm/__tests__/wasmRunner.test.ts`, `migration010LegalDocumentsStatutorySeed.test.ts`, `migrationSprint11QaCacheSchema.test.ts`).
- WASM deterministic-gate runner is in place; Sprint 11 does NOT extend it. WASM-for-gates remains the Sprint 12/13 polish target.

## Planned architecture (summary)

See `docs/iterlaw/project/07-sprints/SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md` for the full plan.

1. **Model router** — pure function from task → local Ollama tag (no I/O, no external fallback).
2. **Gateway HTTP client** — injected transport, no top-level `fetch` import in `legal/llm/`.
3. **Bounded synthesis extension** — call gateway only when `available=true`; map response to `BoundedSynthesisOutput`; preserve citations strictly.
4. **Pipeline integration** — invoke bounded synthesis between retrieval+citation gate and the final `verifyCitations` stage.
5. **Audit log** — sanitised entry into `rag_runs` (no prompt body, no user facts, no DSN, no PEM).
6. **/ready** — add `model_router_configured` + `default_route` fields; never expose model tag, base URL, or API key.
7. **Tests** — six new test files covering router / transport / bounded-synthesis integration / audit redaction / static safety / pipeline integration.

## Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| 1 | An adapter calls `fetch()` against a public host. | Static safety test pinned to `legal/llm/` directory. |
| 2 | Operator misconfiguration of env. | Default-disabled gateway + fail-closed semantics already in repo. |
| 3 | Citation verifier weakened to accommodate hallucinations. | Hard-coded test that every cited URL is in the retrieved set. |
| 4 | Audit log leaks prompt / user facts. | Redaction unit test enumerates banned fields. |
| 5 | Performance claim added without benchmark evidence. | `verify-iterlaw-v3-safety.sh` rejects unverified claims. |
| 6 | Bounded-synthesis writer attempts to insert into `rag_runs` before migration 101 is applied. | Sprint 11 implementation is gated on Sprint 10 staging PASS — `rag_runs` is created by migration 101. |

## No implementation performed

This turn produced only planning documents and a sprint-index row update. No file under `apps/legal-orchestrator/src/`, `apps/legal-orchestrator/db/migrations/`, `apps/legal-orchestrator/src/tests/`, or `k8s/**` was edited.

## Sprint 10 dependency

`rag_runs`, `source_update_log`, `answer_verification_log`, and `verified_answers_cache` (added by migration `101_reconcile_legal_rag_schema.sql`) are required for the Sprint 11 audit log path. The `legal_case_records` / `legal_case_sources` rows added by Sprint 10 migration `105_case_workspace.sql` and the RLS in `106_enable_rls.sql` together back the per-case audit join. Without the staging DB applied and verified, the Sprint 11 integration test cannot demonstrate the end-to-end audit row.

**Sprint 11 implementation cannot start until the operator returns a `PASS` staging-DB sign-off log** per `docs/iterlaw/project/09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`.

## Files created / updated this turn

| File | Action | Lines |
| --- | --- | --- |
| `docs/iterlaw/project/07-sprints/SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md` | NEW | ~150 |
| `docs/iterlaw/project/07-sprints/SPRINT_11_IMPLEMENTATION_CHECKLIST.md` | NEW | ~110 |
| `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` | UPDATED (Sprint 11 row added) | +1 row |
| `reports/ITERLAW_SPRINT_11_PLANNING_REPORT.md` | NEW (this file) | ~80 |

No source code changed. No migration SQL changed. No tests changed. No Kubernetes manifest changed.

## Next action

**After** Sprint 10 staging DB verification returns `PASS`:

1. Operator commits the sign-off log per checklist §13.
2. Agent flips `SPRINT_INDEX.md` Sprint 10 row to `staging DB verification: PASS (YYYY-MM-DD)`.
3. Agent starts Sprint 11 Phase 1 (types only) per `SPRINT_11_IMPLEMENTATION_CHECKLIST.md`.

## Truth statement

> No source code changed.
> No migrations changed.
> No tests changed.
> No Kubernetes manifests changed.
> No push performed.
> No deployment performed.
> No kubectl mutating command performed.
> No database touched.
> No external LLM calls performed.
> No secret values printed.
