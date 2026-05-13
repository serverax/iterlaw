# Sprint 11 Closeout Implementation Plan

**Date:** 2026-05-13.
**Status:** **Planned.** Implementation gated on the ADR `../11-ai-governance/ADR_SPRINT_11_LOCAL_LLM_TRANSPORT_AND_PIPELINE_WIRING.md` being marked **Accepted** by the operator.
**Scope:** the two remaining Sprint 11 phases — Phase 2B (live local HTTP transport) and Phase 4 (pipeline wiring of `runLocalDraftingStep` into `handleLegalRequest`).

This document does **not** mark either phase complete. Every plan item below is **planned**.

---

## Phase 2B — Live local HTTP transport

### Files to inspect

- `apps/legal-orchestrator/src/legal/llm/llm.types.ts` — `OllamaTransport`, `OllamaTransportRequest`, `OllamaTransportResponse` already defined.
- `apps/legal-orchestrator/src/legal/llm/localLlmGateway.ts` — gateway-status describer + env-flag selector (`ITERLAW_LLM_GATEWAY_MODE`, `ITERLAW_LOCAL_LLM_ENABLED`, `ITERLAW_OLLAMA_BASE_URL`).
- `apps/legal-orchestrator/src/legal/llm/localTransportPolicy.ts` — host allow-list / deny-list (already enforces public-provider deny + loopback / cluster-DNS allow).
- `apps/legal-orchestrator/src/legal/llm/runLocalDraftingStep.ts` — drafting orchestration; currently accepts an injected `OllamaTransport`.
- `apps/legal-orchestrator/src/legal/llm/llmAuditRedactor.ts` + `llmAuditSink.ts` — audit contract (no change expected; transport must emit redacted events).
- `apps/legal-orchestrator/src/server.ts` — `/ready` payload + `createApp` options (will need transport injection point if Phase 4 wires through here).

### Likely files to change

| File | Change |
| --- | --- |
| `apps/legal-orchestrator/src/legal/llm/httpOllamaTransport.ts` (NEW) | HTTP adapter implementing `OllamaTransport`. Validates target URL through `evaluateLocalTransportPolicy` before opening any socket. Uses `AbortController` for hard timeout. No top-level `fetch` import — receives `fetch` via constructor for test injection. Maps HTTP failure modes onto `OllamaTransportResponse`: 2xx with valid JSON → `{ status: "ok", … }`; 4xx / 5xx → `{ status: "unavailable" }`; timeout → `{ status: "timeout" }`; non-JSON body / schema mismatch → `{ status: "malformed" }`. Never emits the request prompt to logs. |
| `apps/legal-orchestrator/src/legal/llm/localLlmGateway.ts` | Add optional factory `createConfiguredOllamaTransport(env)` that returns `undefined` when the gateway is disabled, else returns a configured `HttpOllamaTransport` against the URL from `ITERLAW_OLLAMA_BASE_URL`. **No environment lookup outside this factory.** |
| `apps/legal-orchestrator/src/legal/llm/index.ts` | Re-export `HttpOllamaTransport` + `createConfiguredOllamaTransport`. |
| `apps/legal-orchestrator/src/tests/sprint11HttpOllamaTransport.test.ts` (NEW) | Unit tests for the HTTP transport using an injected `fetch` mock. |

No change to `runLocalDraftingStep` is expected — it already accepts an injected `OllamaTransport`.

### Tests to add

1. **Transport rejects denied host before any HTTP call** — pass `https://api.openai.com/...` → returns `{ status: "unavailable" }`, mock `fetch` is never called.
2. **Transport rejects malformed URL.**
3. **Transport rejects `https://` external host without explicit allow-list.**
4. **Transport allows `http://localhost`, `http://127.0.0.1`, `http://*.svc`, `http://*.svc.cluster.local`** — fetch is invoked.
5. **Transport hard-timeouts** at the configured `timeoutMs` (use `vi.useFakeTimers()`) → returns `{ status: "timeout" }`.
6. **Transport collapses HTTP 4xx / 5xx** → `{ status: "unavailable" }`. Response body is **not** logged.
7. **Transport rejects non-JSON / schema-mismatched body** → `{ status: "malformed" }`.
8. **Transport's `OllamaTransportRequest` to model field** uses only `LocalModelTag` values; type-check fails on a non-allowed model name.
9. **Transport emits no DSN, password, or prompt** to any captured log stream (assert against a stub logger).
10. **`createConfiguredOllamaTransport(env)` returns `undefined`** when `ITERLAW_LOCAL_LLM_ENABLED !== 'true'` or `ITERLAW_LLM_GATEWAY_MODE !== 'ollama'`.

### Safety gates

- The transport adapter must **always** call `evaluateLocalTransportPolicy` before any network operation. The result is checked before `fetch` is invoked.
- The transport adapter **must not** log the request body or the response body.
- The transport adapter **must not** read `process.env` directly outside the factory. All configuration is passed in.
- No new top-level `fetch` import in `apps/legal-orchestrator/src/legal/llm/` other than inside `httpOllamaTransport.ts`. The Sprint 11 hardening test currently bans `fetch(` everywhere in `legal/llm/` except for `localOllamaGateway.ts` (the health probe); Phase 2B will extend the allow-list to include `httpOllamaTransport.ts` and update the hardening test accordingly.

### Allowed endpoints

(Mirror of ADR §5.) Loopback (`localhost` / `127.0.0.1` / `::1`), Kubernetes cluster-DNS (`*.svc` / `*.svc.cluster.local`), explicit allow-listed internal hostname.

### Blocked endpoints

(Mirror of ADR §6.) Public-provider hostnames in `EXTERNAL_PROVIDER_HOSTS` — permanently denied.

### Timeout handling

- Default `timeoutMs = 15000`.
- Override via `OllamaTransportRequest.timeoutMs`.
- Implementation: `AbortController` + `setTimeout`. On abort → `{ status: "timeout" }`.
- No retries inside the transport. Retry policy (if any) is the caller's concern.

### `llm_unavailable` behaviour

- Gateway disabled / mis-configured → `runLocalDraftingStep` returns `llm_unavailable` **without** invoking the transport.
- Transport returns `unavailable` / `timeout` / `malformed` → `runLocalDraftingStep` returns `llm_unavailable`. Audit envelope records the specific transport status; the user-facing envelope collapses to `llm_unavailable`.
- The orchestrator answer envelope (Phase 4 wiring) will surface `llm_unavailable` as the response `status` only when **no** earlier refusal applies. Earlier refusals (`insufficient_sources`, `citation_failed`, `policy_failed`, `high_risk_deadline`, `human_review_required`, `bad_request`) take precedence.

---

## Phase 4 — Pipeline wiring

### Where wiring happens

- `apps/legal-orchestrator/src/pipeline/handleLegalRequest.ts` — the canonical entry point already runs: `classifyRequest` → `immediateRiskCheck` → retrieval → `runLegalModulePipeline`. The wiring inserts `runLocalDraftingStep` **after** retrieval and citation gating, and **before** the final safety gate.

### Integration points

1. **Input validation** — the existing `askSchema` (in `server.ts`) already validates `request_id`, `user_id`, `workspace_id`. Phase 4 extends the schema to **require** at least one of `country_id` / `module_id` once the multi-country surface lands (future-sprint; **not** Phase 4 scope). For Sprint 11 closeout, the existing UK-Employment-only assumption stands.
2. **Subscription / entitlement check** — out of scope for Phase 4 (Sprint 46+). The wiring respects the absence of this check today.
3. **Retrieval result fan-out** — when retrieval returns ≥ 1 citation-complete chunk, the wiring decides whether the deterministic rule pack (`runLegalModulePipeline`) can fully answer:
   - If the rule pack's output is non-empty and the citation gate / policy gate approve → **skip the drafter**; the response is the deterministic answer with citations.
   - Otherwise → call `runLocalDraftingStep` with the retrieved chunks, the configured gateway, and the configured transport (from `createConfiguredOllamaTransport`).
4. **Drafter integration** — `runLocalDraftingStep(input, gateway, deps)`:
   - `gateway`: `describeLocalLlmGateway()` result.
   - `deps.transport`: returned by `createConfiguredOllamaTransport(process.env)` once at boot; passed through `createApp` options for tests.
   - `deps.auditSink`: production default `NoopLlmAuditSink`. A DB-backed sink lands later under a separate ADR.
   - `deps.requestId`, `deps.traceId`: pass-through from the incoming `LegalRequest`.
5. **Output guard** — already enforced inside `runLocalDraftingStep` via `guardLlmOutput`. The wiring does not need to re-run it.
6. **Final safety gate** — after the drafter returns `synthesised`, the wiring **must** re-run:
   - The citation gate against the current corpus (defence in depth — drafter already verified once).
   - The policy gate against the drafter's answer text.
   - The "no DSN / password / `sk-…`" regex pass on the answer body.
   - Any of these failing → `citation_failed` or `policy_failed`. The drafted text is **discarded**, not returned.

### Citation verification before LLM

- If retrieval is empty → return `insufficient_sources`. Transport is **not** called.
- If retrieval is non-empty but **all** chunks fail the citation gate → return `citation_failed`. Transport is **not** called.
- If retrieval is non-empty and ≥ 1 chunk passes the citation gate → proceed to deterministic rule pack, then drafter (if needed).

### Deterministic answer bypass

- `runLegalModulePipeline` already exists at `apps/legal-orchestrator/src/modules/modulePipeline.ts`. When its output `finalAllowed === true` and the rule pack provided a complete answer, the wiring **must** return that answer with citations and **not** call the drafter. This preserves the offline-first ADR (`ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`).

### Final safety gate

- See "Output guard" + "Final safety gate" notes above.
- Any failure → safe refusal status; never a fabricated answer.

### Response envelope requirements

The wired response envelope **must** carry:

- `request_id` (echoed back).
- `status`: one of `safe_answer` (existing — to be renamed `ok` in a follow-up doc-style commit) / `insufficient_sources` / `citation_failed` / `policy_failed` / `high_risk_deadline` / `needs_more_facts` / `human_review_required` / `llm_unavailable` / `bad_request`.
- `legal_pack`, `jurisdiction`.
- `answer` — string. Empty / placeholder on refusal paths. Real drafter output only when `status` indicates success.
- `risk_level`.
- `confidence_score` — derived from rule-pack confidence + retrieval-set quality; **must not** be hardcoded to a non-zero on a refusal.
- `rag_used`, `external_llm_used` (always `false`).
- `synthesis_status`: `not_attempted` (today) → `synthesised` (when the drafter runs successfully) → `not_attempted` (when refused).
- `synthesis_mode`: `redis_streams` (today's value; may change in a future sprint).
- `citations`: array (taken from retrieved chunks; never from drafter output).
- `next_steps`: array of plain-English next-step strings.

### Audit event requirements

For every drafter invocation:

- Emit a redacted `LocalLlmAuditEvent` per the Phase 2A contract.
- Sink defaults to `NoopLlmAuditSink` in production; tests inject `InMemoryLlmAuditSink`.
- No raw prompt, no draft text, no chunk text, no DSN, no password, no token in the event.

For every refusal path (`insufficient_sources`, `citation_failed`, `policy_failed`, `high_risk_deadline`, `llm_unavailable`):

- Emit a redacted audit event with `status` matching the refusal.
- Skip the audit emission when the drafter was never invoked? **No** — emit a `skipped` / `unavailable` / `insufficient_sources` audit event with `latencyMs = 0` so the audit timeline is consistent.

### Tests to add

| Test | Asserts |
| --- | --- |
| `sprint11Phase4WiringHappyPath.test.ts` | Mock retrieval returns 1 citation-complete chunk; mock transport returns `ok` with valid citation; orchestrator returns successful envelope with citations + a `synthesised` audit event. |
| `sprint11Phase4WiringEmptyRetrieval.test.ts` | Mock retrieval returns 0 chunks; orchestrator returns `insufficient_sources`; transport receives **zero** calls. |
| `sprint11Phase4WiringHallucinationRefused.test.ts` | Mock transport returns answer citing a `chunk_id` not in the retrieval set; orchestrator returns `citation_failed`; drafter output is not exposed. |
| `sprint11Phase4WiringGatewayDisabled.test.ts` | `ITERLAW_LOCAL_LLM_ENABLED=false`; orchestrator returns `llm_unavailable`; transport receives zero calls. |
| `sprint11Phase4WiringDeterministicShortCircuit.test.ts` | Rule pack returns a complete answer; orchestrator returns it without invoking the drafter. |
| `sprint11Phase4WiringDeadlineShortCircuit.test.ts` | High-risk deadline returns `high_risk_deadline`; retrieval / drafter never called. |
| `sprint11Phase4WiringEnvelopeNeverLeaks.test.ts` | Across all status branches, the response body contains no DSN, no password, no `sk-…`, no `POSTGRES_PASSWORD`, no `DATABASE_URL`. |
| `sprint11Phase4WiringAuditEmits.test.ts` | Every status branch emits exactly one audit event; the event passes `assertSafeLlmAuditEvent`. |

---

## Exact commit plan

1. **`feat(iterlaw): add safe local llm http transport`** — Phase 2B adapter (`httpOllamaTransport.ts` + factory + tests). The drafter remains UN-wired.
2. **`feat(iterlaw): wire local drafting into cited legal request pipeline`** — Phase 4 wiring of `runLocalDraftingStep` inside `handleLegalRequest` + the eight Phase-4 tests above.
3. **`docs(iterlaw): record sprint 11 closeout QA`** — full QA report at `reports/ITERLAW_SPRINT_11_CLOSEOUT_QA_<YYYY-MM-DD>.md` with command output for typecheck / build / vitest / scans / `/ready` field-shape against the Docker staging DB.
4. **`docs(iterlaw): mark sprint 11 pass and open sprint 12`** — status doc flip from "PARTIAL" → "PASS" in `PROJECT.md`, `ITERLAW_PROJECT_STATUS.md`, `docs/iterlaw/ITERLAW_PROJECT_STATUS.md`, `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md`, `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md`; flip Sprint 12 from "PLANNED" → "READY TO START". The commit message **must** reference the closeout QA report file by name.

**None of these commits are claimed complete by this plan.** Implementation is gated on the ADR being marked **Accepted** by the operator. Each commit ships only after its individual gates (typecheck / build / vitest / scans / no-DSN-leak) PASS.

---

## Out of scope for Sprint 11 closeout

The following are explicitly **not** part of this closeout and require separate ADRs / sprints:

- Multi-country / multi-module entitlement gating (Sprint 46).
- DB-backed audit sink (separate ADR).
- Subscription / billing surface (Sprint 14).
- Streaming UX / SSE (Sprint 33).
- Two-stage model cascade (Sprint 31).
- Production deployment (BLOCKED until production-readiness checklist passes).

---

## Truth statement

> No push performed by this plan.
> No deployment performed.
> No production DB touched.
> No kubectl mutating command performed.
> No external LLM call performed.
> No secret values printed.
> No Sprint 11 phase is marked complete by this document.
> Phase 2B + Phase 4 implementation will not start until the ADR `../11-ai-governance/ADR_SPRINT_11_LOCAL_LLM_TRANSPORT_AND_PIPELINE_WIRING.md` is operator-approved.
