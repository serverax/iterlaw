# Sprint 11 — Implementation Checklist

> **CLOSED — Sprint 11 PASS.** This checklist was authored before Sprint 11 closed. The state header below is preserved as the historical planning record. Current state: Sprint 10 Docker staging gate met (2026-05-13); Sprint 11 Phase 2B + Phase 4 landed (commits `3681fab`, `120b9de`); Sprint 11 closeout QA at `docs/iterlaw/project/11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md`.

**Status (historical, at authoring):** PLANNED. DO NOT START. Blocker: Sprint 10 staging DB verification PENDING.
**Status (current):** **CLOSED / PASS** (Sprint 11 ended; Sprint 11 does not unblock production).

Phases below were executed **only after** the staging sign-off log was committed. Each phase had its own commit; no phase merged out of order.

## Phase 1 — contracts / types only

- Extend `apps/legal-orchestrator/src/legal/llm/llmGateway.types.ts`:
  - `ModelRoute = 'legal_drafting' | 'document_summary' | 'drafting_letter' | 'small_helper' | 'reranker'`.
  - `GatewayRequest`, `GatewayResponse` shapes (see plan §"Gateway contract").
  - `LlmAuditEntry` shape (trace_id, model, chunk_ids, citation_ids, refusal_reason, latency_ms — no user data).
- Add `apps/legal-orchestrator/src/legal/llm/modelRouter.types.ts` if needed for separation.
- Tests: type-presence assertions only.

Acceptance: typecheck PASS, no runtime change.

## Phase 2 — local gateway client (mocked)

- Add `apps/legal-orchestrator/src/legal/llm/ollamaHttpClient.ts`. Inject the HTTP transport via a `fetch`-like port; the module does NOT import `node-fetch`, `undici`, or `axios` at top level.
- Mock transport for tests; real transport stays behind `mode='ollama'` + `ITERLAW_LOCAL_LLM_ENABLED=true`.
- Tests:
  - 200 OK with valid JSON → `{status:'ok', answer, citations, model_used, latency_ms}`.
  - 200 OK with malformed JSON → `{status:'malformed'}`.
  - Non-2xx response → `{status:'unavailable'}`.
  - Transport throws → `{status:'unavailable'}`.
  - Timeout (`AbortSignal.timeout`) → `{status:'timeout'}`.
- No external-host call.

Acceptance: all transport branches covered; static test asserts no `fetch(` at module scope.

## Phase 3 — model router

- Add `apps/legal-orchestrator/src/legal/llm/modelRouter.ts`. Pure function: `(task) → Ollama tag string`.
- Reads tags from `apps/legal-orchestrator/src/legal/llm/modelRouter.types.ts` constants (built from the synthesis-worker ConfigMap names, not from a network call).
- Tests:
  - Every `ModelRoute` resolves to a tag.
  - No tag references an external provider.
  - Fallback policy: if a route's model is unset in env, return the legal-drafting tag.

Acceptance: 100% branch coverage, no I/O.

## Phase 4 — pipeline integration

- Extend `apps/legal-orchestrator/src/legal/llm/boundedSynthesis.ts`:
  - When `gateway.available === true`, build a `GatewayRequest` from the input chunks and route, send via the transport from Phase 2, and map the response into `BoundedSynthesisOutput`.
  - On `status !== 'ok'` → emit `llm_unavailable`.
  - Pass response answer through the existing citation gate before returning `synthesised`.
- Extend `apps/legal-orchestrator/src/pipeline/handleLegalRequest.ts`:
  - Call bounded synthesis **after** the retrieval+citation gate, **before** the existing `verifyCitations` final stage.
  - Persist `LlmAuditEntry` into `rag_runs` via a new `ragRunRepository.appendLlmAuditEntry()` method.
- Tests:
  - Retrieval empty → `insufficient_sources`, gateway never called.
  - Retrieval OK + citation gate OK + gateway disabled → `llm_unavailable`.
  - Retrieval OK + citation gate OK + gateway available → `synthesised` (mocked transport).
  - Citation verifier rejects model output → `citation_failed`.

Acceptance: integration test asserts the gateway is invoked iff every prior gate passed.

## Phase 5 — safety / refusal tests

- Add `apps/legal-orchestrator/src/tests/sprint11BoundedSynthesisIntegration.test.ts` covering every status branch from §"Failure handling" of the plan.
- Add `apps/legal-orchestrator/src/tests/sprint11AuditLogRedaction.test.ts`:
  - Audit entry never contains `app.user_id`, DSN fragments, PEM blocks, prompt body.
- Add `apps/legal-orchestrator/src/tests/sprint11StaticSafety.test.ts` (extends `sprint11LlmGateway.test.ts`):
  - No `openai` / `anthropic` / `generativelanguage` / `node-fetch` / `undici` / global `fetch(` import in `apps/legal-orchestrator/src/legal/llm/`.

Acceptance: all six safety tests green; existing 615/51 vitest count grows by the new tests.

## Phase 6 — readiness endpoint

- Extend `apps/legal-orchestrator/src/server.ts` `/ready` `llm` slice:
  - Add `model_router_configured: boolean`.
  - Add `default_route: ModelRoute` if a default is set.
  - **Never** expose model tag, base URL, or API key.
- Update `apps/legal-orchestrator/src/tests/sprint8Ready.test.ts` strict-equality assertion to include the new fields.

Acceptance: `/ready` returns the new fields; no test breaks.

## Phase 7 — QA report

- Write `reports/ITERLAW_QA_REPORT_SPRINT_11_LOCAL_LLM_GATEWAY.md`:
  - Commands run, exit codes, test counts.
  - Static safety scan results (no external LLM in `legal/llm/`).
  - Gateway-disabled posture confirmation.
  - Truth statement (no push, no deploy, no kubectl mutate, no production DB, no external LLM call, no secrets printed).
- Flip `SPRINT_INDEX.md` Sprint 11 row from `PLANNED / BLOCKED BY SPRINT 10` to `PARTIAL — code-side DONE`. **Production remains BLOCKED.**

Acceptance: report committed; benchmark execution (per `docs/benchmarks/SPRINT_11_LOCAL_LLM_BENCHMARK_EXECUTION_CHECKLIST.md`) is the operator follow-up and is **not** required for the code-side close-out.
