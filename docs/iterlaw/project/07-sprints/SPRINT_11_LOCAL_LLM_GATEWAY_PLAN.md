# Sprint 11 — Local LLM Gateway + Model Routing Plan

**Status:** PLANNED. **Implementation BLOCKED** until Sprint 10 staging DB verification is `PASS`. Production remains BLOCKED.

Companion deep doc: `docs/iterlaw/SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md` (83 lines, long-form). Companion benchmark: `docs/benchmarks/SPRINT_11_LOCAL_LLM_BENCHMARK_PLAN.md`.

## Goal

The legal-orchestrator drafts answers through an **internal** local LLM gateway after RAG retrieval and the citation gate. No external provider call ever appears in the request path.

## Current repo findings (read-only inventory)

- `apps/legal-orchestrator/src/legal/llm/` already exists with five files:
  - `llmGateway.types.ts` — `LlmGatewayMode`, `LlmGatewayStatus`, `BoundedSynthesisInput/Output`, `RetrievedLegalChunkForSynthesis`.
  - `localLlmGateway.ts` — env-driven `describeLocalLlmGateway()`. **Default mode `disabled`. Fail-closed when GUCs absent.**
  - `boundedSynthesis.ts` — refusal guard returning `insufficient_sources` / `citation_failed` / `llm_unavailable` / `blocked_by_policy` / (future) `synthesised`.
  - `localOllamaGateway.ts` — older probe (pre-Sprint 11), still returns `OLLAMA_UNAVAILABLE`.
  - `index.ts`.
- `apps/legal-orchestrator/src/pipeline/` — request handler, classifier, immediate-risk check, prompt builder, policy gate, citation verifier.
- `apps/legal-orchestrator/src/rag/` — port + Postgres + mock + temporal filter. Sprint 10 wired to canonical schema.
- `apps/legal-orchestrator/src/modules/` — deterministic modules (citationVerifier, deadlineChecker, policyGate, piiRedactor, ruleEngine, sourceRanker).
- `apps/legal-orchestrator/src/wasm/` — deterministic gate runner + 3 rule modules.
- Grep across `src/`: no external-provider import (`openai`, `anthropic`, etc.) outside test deny-lists.
- Five refusal-status producers: `boundedSynthesis.ts`, `llmGateway.types.ts`, `handleEmploymentLawQuestion.ts`, `legalRag.types.ts`, `ragRunRepository.ts`.

**Sprint 11 is interface + integration, not a green-field build.** The default-disabled gateway and bounded-synthesis guard already land in the repo.

## Files to add/change in Sprint 11 implementation (DO NOT TOUCH NOW)

| File | Action |
| --- | --- |
| `apps/legal-orchestrator/src/legal/llm/modelRouter.ts` | NEW — pure routing decision (legal-drafting vs small-helper vs document-summary). |
| `apps/legal-orchestrator/src/legal/llm/ollamaHttpClient.ts` | NEW — minimal HTTP client behind `localLlmGateway` when `mode='ollama'`. **No global fetch — adapter only.** |
| `apps/legal-orchestrator/src/legal/llm/auditLog.ts` | NEW — sanitised audit row builder. |
| `apps/legal-orchestrator/src/legal/llm/boundedSynthesis.ts` | EXTEND — call gateway when `available=true`. |
| `apps/legal-orchestrator/src/pipeline/handleLegalRequest.ts` | EXTEND — invoke bounded synthesis between retrieval-success and `verifyCitations`. |
| `apps/legal-orchestrator/src/tests/sprint11ModelRouter.test.ts` | NEW. |
| `apps/legal-orchestrator/src/tests/sprint11LlmGatewayClient.test.ts` | NEW (mock HTTP). |
| `apps/legal-orchestrator/src/tests/sprint11BoundedSynthesisIntegration.test.ts` | NEW. |
| `apps/legal-orchestrator/src/server.ts` | EXTEND `/ready` — already exposes gateway slice; add `model_router_configured`. |

## Gateway contract

**Request** (sent to internal gateway):

```
{
  trace_id:      string                  // ulid; correlates to rag_runs row
  model:         string                  // resolved by modelRouter
  prompt:        string                  // sanitised, redacted
  context_chunks: RetrievedLegalChunkForSynthesis[]  // citation_label + url required per item
  temperature:   number                  // 0.0–1.0
  max_tokens:    number                  // hard cap (e.g. 800)
  timeout_ms:    number                  // hard cap (e.g. 15000)
  stop:          string[] | undefined
}
```

**Response**:

```
{
  status:        'ok' | 'unavailable' | 'timeout' | 'malformed'
  model_used:    string | undefined
  answer:        string | undefined
  citations:     BoundedSynthesisCitation[]   // strict pass-through, never invented
  tokens_used:   number | undefined
  latency_ms:    number | undefined
  safety_notes:  string[]
}
```

**Logging rule:** trace_id + model + retrieved chunk IDs + final citation IDs + refusal reason + latency. **Never** the prompt body, the user's facts, or any DSN. The audit-log builder strips `app.user_id`, DSN fragments, and PEM headers.

## Model routing rules

| Task | Model class | Local Ollama tag (existing in repo) |
| --- | --- | --- |
| Final legal drafting | strong instruct | `uk-employment-qwen:latest` |
| Document summarisation | summariser | `uk-employment-document:latest` |
| Drafting letters / grievances | drafting | `uk-employment-drafting:latest` |
| Small helper (fact extraction, missing-fact prompts) | small | reuse drafting model with `temperature=0` |
| Reranker | reranker | TBD by AI Architect AIA |

**Routing is pure** (no I/O). Tested by mocking the input and asserting the chosen tag. **No external-provider fallback.** If the local gateway is unavailable, the bounded-synthesis guard returns `llm_unavailable`.

## Safety gates (order is invariant)

1. RAG retrieval returns chunks → if empty, `insufficient_sources`. **LLM NEVER called.**
2. Citation gate on retrieved chunks → if any chunk missing `chunk_id`/`document_id`/`title`/`url`/`citation_label`/`text`, `citation_failed`. **LLM NEVER called.**
3. Bounded synthesis sends prompt + context to gateway.
4. Citation verifier on draft → if any cited URL is not in the retrieved set, `citation_failed`. LLM output discarded.
5. Policy gate on draft → if banned phrasing / off-topic / jurisdiction-mismatch, `policy_failed`.
6. Otherwise `synthesised` (Sprint 11 first time this status returns text).

## Failure handling

| Failure | Response |
| --- | --- |
| Gateway unreachable | `llm_unavailable`; citations preserved for "no answer; here are the sources we would have used". |
| Gateway timeout (> `timeout_ms`) | `llm_unavailable` (logged as timeout). |
| Malformed JSON / empty body | `llm_unavailable` (logged as malformed). |
| Hallucinated citation | `citation_failed` (citation verifier rejects). |
| Empty answer string | `llm_unavailable`. |
| Low-confidence answer (model self-reports < threshold) | `human_review_required`. |

## Tests required

| Area | Test idea |
| --- | --- |
| Model router | All 4 task types resolve to the correct local tag; no external tag chosen. |
| Gateway client | Mocked HTTP layer: 200 / 404 / 500 / timeout / malformed body all map cleanly. |
| Bounded synthesis | `available=true` + good chunks → `synthesised`; missing citation → `citation_failed`; gateway down → `llm_unavailable`. |
| Pipeline integration | `handleLegalRequest` returns `synthesised` only when every prior gate passes. |
| Audit-log redaction | No PEM, no `postgres://`, no `app.user_id` in log payload. |
| Static safety | No `openai` / `anthropic` / `generativelanguage` / `node-fetch` / `undici` / global `fetch(` in `legal/llm/`. |

## Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| 1 | An adapter accidentally calls `fetch()` against a public hostname. | Static test asserts only the gateway's HTTP layer uses an injected client; `legal/llm/*` cannot import `fetch` at module scope. |
| 2 | Operator sets `ITERLAW_LLM_GATEWAY_MODE` without `_LOCAL_LLM_ENABLED`. | Default `disabled`; gateway returns `DISABLED` reason; bounded synthesis returns `llm_unavailable`. |
| 3 | Citation verifier weakens to accommodate hallucinated answers. | Test asserts every cited URL is present in the retrieved set. Hardcoded. |
| 4 | Audit log leaks prompt / user facts. | Redaction unit test enumerates banned fields. |
| 5 | Performance claim added without measurement. | `verify-iterlaw-v3-safety.sh` rejects "sub-second" / "fastest" wording unless inside a benchmark-results file. |

## Acceptance criteria

- Default-disabled posture preserved (already in repo).
- `model_router_configured` exposed on `/ready` without leaking model paths.
- All Sprint 11 tests pass on `cd apps/legal-orchestrator && npx vitest run`.
- Static safety scans pass.
- Bounded synthesis returns `synthesised` only when every prior gate passes.
- No external-provider URL appears anywhere in `apps/legal-orchestrator/src/legal/`.

## Blocker

**Sprint 11 implementation cannot start until Sprint 10 staging DB verification is `PASS`.**

`rag_runs` audit rows produced by the bounded-synthesis path land in tables created by `101_*`. Without an applied staging DB, the integration test for the audit row cannot run end-to-end.
