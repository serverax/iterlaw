# ADR — Sprint 11 Local LLM Transport and Cited Pipeline Wiring

**Date:** 2026-05-13.
**Status:** **Proposed.** Operator approval required before any code implementation under this ADR may begin.

## 1. Decision title

Sprint 11 Local LLM Transport and Cited Pipeline Wiring.

## 2. Status

**Proposed / operator-approved required before implementation.** This ADR exists to authorise the remaining Sprint 11 work (Phase 2B + Phase 4) without ambiguity. Implementation **must not** begin until an operator records explicit approval — either as a commit annotation referencing this ADR's filename or as a separate `OPERATOR_APPROVAL_*.md` artefact alongside it.

Standing rules continue to apply: no push without operator instruction, no deploy, no `kubectl` mutating commands, no production DB writes, no external LLM call, no secrets in logs.

## 3. Context

- Sprint 11 is currently **PARTIAL**:
  - Phase 1 (foundation) **PASS** (`b896764`).
  - Phase 2A (audit / transport guardrails) **PASS** (`b14fd2d`).
  - Sprint 11 hardening tests **PASS** (`c102f51` + QA report `reports/ITERLAW_SPRINT_11_LOCAL_LLM_RAG_GATEWAY_QA_2026-05-13.md`).
  - Live HTTP local transport: **NOT STARTED**.
  - `runLocalDraftingStep` is **not wired** into `handleLegalRequest`.
- External LLMs (OpenAI, Anthropic, Gemini, Cohere, Mistral) are **forbidden** in the live answer path. `apps/legal-orchestrator/src/legal/llm/localTransportPolicy.ts` denies their hostnames at runtime; the Sprint 11 hardening tests assert zero provider SDK in `apps/legal-orchestrator/package.json`.
- The local LLM is **drafting only**, never a source of legal truth. The citation gate, policy gate, and deterministic rule checks (PII, deadline, risk classifier, source ranker) are the source-of-truth controls. The LLM cannot override any of them.
- Sprint 10 closed PASS in Docker staging scope (`reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`). The Postgres RAG mode + `/ready` field shape + citation safety flags are all verified live.
- Production remains **BLOCKED**.

## 4. Decision

1. **Implement a local HTTP transport** — an `OllamaTransport` adapter that POSTs to an internal Ollama / vLLM / llama.cpp endpoint — for **approved local / internal endpoints only**. The transport must be:
   - Pluggable: instantiated by the orchestrator at startup, injectable for tests.
   - Disabled by default (`ITERLAW_LOCAL_LLM_ENABLED` env flag; `ITERLAW_LLM_GATEWAY_MODE` env flag; default mode `disabled`).
   - Validated by `evaluateLocalTransportPolicy` before any request is dispatched. A request to a non-allowed host is **rejected at the call site**, not at the HTTP layer.
   - Bounded by hard timeouts (default 15s; configurable via the env var). The transport must abort on timeout and return `{ status: "timeout" }`.
   - Failure-safe: any non-`ok` transport response collapses to `llm_unavailable` in the answer envelope.
   - Audited: every send emits a redacted `LocalLlmAuditEvent` via the Phase 2A audit sink contract.
2. **Wire `runLocalDraftingStep` into `handleLegalRequest`** only after:
   - The subscription / module / country gate (where applicable for the target country / module) passes.
   - Retrieval has returned at least one citation-complete chunk.
   - The citation gate, policy gate, and deterministic rule checks have **all** approved the evidence pack and the (currently empty) draft.
   - If any earlier gate refused, the orchestrator returns the corresponding refusal status without ever calling the drafter.
3. **Citation gate and final safety gate remain mandatory.** They run before and after the drafter respectively. Any failure → safe-refusal status; never a fabricated answer.
4. **Safe failure statuses must be returned where appropriate** (see §7 below).

## 5. Allowed local endpoints

The transport adapter may dispatch only to:

- `localhost`
- `127.0.0.1` (or `::1` for IPv6)
- Kubernetes cluster-DNS hosts (`*.svc` / `*.svc.cluster.local`) — only when the operator has configured an explicit internal Ollama / vLLM / llama.cpp service.
- An explicit allow-listed internal hostname (passed to `evaluateLocalTransportPolicy({ allowedInternalHosts: [...] })`).

Any of these are also subject to:

- Scheme allow-list: `http://` (preferred for in-cluster), `https://` only for hosts on the explicit allow-list.
- Port allow-list: no restriction by default, but configurable per operator policy.

## 6. Forbidden endpoints

Permanently denied at runtime by `EXTERNAL_PROVIDER_HOSTS`:

- `api.openai.com`, `openai.com`
- `api.anthropic.com`, `anthropic.com`
- `generativelanguage.googleapis.com`, `googleapis.com`
- `api.cohere.ai`, `api.cohere.com`, `cohere.ai`, `cohere.com`
- `api.mistral.ai`, `mistral.ai`
- Any other **public hosted AI API** unless this ADR is amended.

The deny-list is enforced at three layers:

1. `localTransportPolicy.ts` — runtime rejection before HTTP is opened.
2. The Sprint 11 hardening test — static-safety scan asserts none of these hostnames appear in `apps/legal-orchestrator/src` production code.
3. `apps/legal-orchestrator/package.json` — no `openai` / `@anthropic-ai/sdk` / `@google/generative-ai` / `cohere-ai` / `@mistralai/mistralai` dependency may be added.

## 7. Required failure statuses

The wired pipeline must be able to return each of:

| Status | Trigger |
| --- | --- |
| `insufficient_sources` | Empty retrieval, or all chunks failed the citation gate before drafting. |
| `citation_failed` | Drafter produced output but the citation verifier rejected it (hallucinated chunk id, missing metadata). |
| `policy_failed` | Policy gate rejected the draft (jurisdiction, off-topic, banned-claim). |
| `high_risk_deadline` | Statutory deadline imminent / past — short-circuits before drafting. |
| `human_review_required` | Confidence below floor; uncertain authority tier; quality-degradation flag. |
| `llm_unavailable` | Gateway disabled, transport missing, transport timeout, transport non-`ok`. |
| `bad_request` | Malformed intake (missing required fields, oversized payload, malformed JSON). |

The pipeline **must not** invent new statuses; the response envelope already documents this set.

## 8. Audit rules

For every drafting attempt the audit envelope **must** store:

- `eventId`, `requestId`, `traceId`
- `taskType` (e.g. `legal_drafting`)
- `selectedModel` (one of the `LocalModelTag` union values)
- `routeReason`
- `retrievedChunkCount`, `citationCount`, `citedChunkIds[]`
- `refusalReason` (when refused)
- `safetyFlags[]`
- `latencyMs` (transport latency)
- `status` (one of: `disabled`, `skipped`, `success`, `timeout`, `malformed_output`, `citation_failed`, `unavailable`, `error`, `blocked_by_policy`, `insufficient_sources`)
- `createdAt`

The audit envelope **must never** store:

- Raw prompt (`prompt`, `userPrompt`, `systemPrompt`, `rawPrompt`).
- Full unsafe draft (`draft`, `draftText`, `rawAnswer`, `modelOutput`, `modelText`).
- Raw chunk text (`chunks`, `retrievedChunks`, `chunkText`, `documentText`).
- Raw sensitive user text (`facts`, `question`, `userInput`, `caseData`, `privateData`).
- `DATABASE_URL`, `databaseUrl`, `apiKey`, `api_key`, `apikey`, `secret`, `secrets`, `password`, `token`.

These rules are already enforced by `redactLlmAuditEvent` + `assertSafeLlmAuditEvent` in `apps/legal-orchestrator/src/legal/llm/llmAuditRedactor.ts`. Any addition to the audit shape requires updating the redactor first.

## 9. Acceptance criteria

Sprint 11 Phase 2B + Phase 4 are PASS only when **all** of the following hold:

- `npx tsc --noEmit` (cwd `apps/legal-orchestrator`) — exit 0.
- `npm run build` (cwd `apps/legal-orchestrator`) — exit 0.
- `npx vitest run` (full suite) — exit 0.
- **No external-provider scan findings** in production code beyond the existing `localTransportPolicy.ts` deny-list constants.
- **No secret / DSN leakage** in any committed artefact, log, or `/ready` body.
- **No uncited legal answer path** — every code path that produces a successful answer traces through the citation gate.
- **Local gateway disabled returns `llm_unavailable`.**
- **Empty retrieval never calls the LLM** (transport receives zero calls when `retrievedChunks` is empty).
- **Citation failure never calls the LLM** (transport receives zero calls when the pre-drafting citation gate refuses).
- **Deterministic answer skips the LLM** (when the deterministic rule pack fully answers a question, the drafter is not invoked).
- **Valid cited retrieval can call local drafting** (end-to-end happy-path test with a mock transport produces a successful `ok` response with citations).
- **Final response envelope is safe** — no DSN / password / `sk-…` / `POSTGRES_PASSWORD` / `DATABASE_URL` literal in any successful or failure response.

A QA report at `reports/ITERLAW_SPRINT_11_CLOSEOUT_QA_<YYYY-MM-DD>.md` must record evidence for each criterion before Sprint 11 is moved to PASS.

## 10. Production

**Production remains BLOCKED** under this ADR. Phase 2B + Phase 4 ship to staging only (the same Docker-staging scope used by Sprint 10's PASS). Production promotion is a separate operator decision and requires:

1. Sprint 11 closeout QA report at PASS.
2. Operator-approved production-readiness checklist (separate ADR).
3. Backup uploader image digest pinned (Sprint 12 work).
4. Storage Box CIDR pinned (Sprint 12 work).
5. Ingress TLS plan complete.
6. Pod-security verifier PASS.

## 11. Related

- Sprint 11 task contract: [`../07-sprints/SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md`](../07-sprints/SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md).
- Sprint 11 closeout implementation plan: [`../07-sprints/SPRINT_11_CLOSEOUT_IMPLEMENTATION_PLAN.md`](../07-sprints/SPRINT_11_CLOSEOUT_IMPLEMENTATION_PLAN.md).
- Offline-first ADR (locked architectural decision): [`../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md).
- Documentation truth protocol: [`./DOCUMENTATION_TRUTH_PROTOCOL.md`](./DOCUMENTATION_TRUTH_PROTOCOL.md).
- Naming consistency policy: [`./NAMING_CONSISTENCY_POLICY.md`](./NAMING_CONSISTENCY_POLICY.md).
- Sprint 11 hardening QA: `reports/ITERLAW_SPRINT_11_LOCAL_LLM_RAG_GATEWAY_QA_2026-05-13.md`.

## 12. Truth statement

> No push performed by this ADR.
> No deployment performed.
> No production DB touched.
> No kubectl mutating command performed.
> No external LLM call performed.
> No secret values printed.
> This ADR proposes implementation; no Sprint 11 phase is marked complete by its presence.
