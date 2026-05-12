# Sprint 11 — Local LLM Gateway Foundation QA Report

## Final status: **PASS** (code-side foundation; live gateway DISABLED / MOCK-SAFE)

Sprint 11 implementation lands the disabled-by-default local LLM gateway foundation: types, model router, citation-bound prompt builder, output guard, and an integration helper that preserves every existing refusal path. **Production behaviour is unchanged.** Real deployment remains **BLOCKED** until Sprint 10 real staging DB verification passes.

## 1. Files added / changed (under `apps/legal-orchestrator/src/legal/llm/`)

| File | Action | Purpose |
| --- | --- | --- |
| `llm.types.ts` | NEW | Types for `LlmTask`, `LocalModelTag`, `ModelRouteDecision`, `CitationBoundPromptInput/Output`, `LlmRawOutput`, `LlmOutputGuardResult`, `OllamaTransport(Request/Response)`. |
| `modelRouter.ts` | NEW | Pure routing function. Legal drafting refuses without retrieved chunks. Emits only local Ollama tags. |
| `citationBoundPrompt.ts` | NEW | Pure prompt builder. System prompt forbids invented sources + zero-citation answers; user prompt contains only the supplied chunks; `allowedCitationIds` whitelist returned. |
| `llmOutputGuard.ts` | NEW | Pure output guard. Rejects empty answer / zero citations / hallucinated chunkId. Citation metadata is taken from the retrieved chunks, never from the model. |
| `runLocalDraftingStep.ts` | NEW | Disabled-by-default integration helper. Empty chunks → `insufficient_sources`; gateway unavailable → `llm_unavailable`; no transport → `llm_unavailable`; transport non-`ok` → `llm_unavailable`; output guard fail → `citation_failed`; only after every prior gate passes does it return `synthesised`. **Not wired into the pipeline yet.** |
| `index.ts` | UPDATED | Re-exports the five new modules. |

| Test file | Action |
| --- | --- |
| `apps/legal-orchestrator/src/tests/sprint11LocalLlmFoundation.test.ts` | NEW (32 tests across modelRouter / citationBoundPrompt / llmOutputGuard / runLocalDraftingStep / static-safety). |

| Doc | Action |
| --- | --- |
| `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` | Sprint 11 row updated to reflect the foundation landing (still BLOCKED for real deployment / production). |

## 2. Gateway contract (this sprint)

Defined in `llm.types.ts` and consumed via `OllamaTransport`:

- **Request:** `model` (LocalModelTag union — never a public-provider name), `systemPrompt`, `userPrompt`, `allowedCitationIds`, `timeoutMs`, `maxTokens`, `traceId`.
- **Response:** `{status:'ok', answer, citedChunkIds, modelUsed, latencyMs}` | `{status:'unavailable'|'timeout'|'malformed'}`.
- The transport interface is **injectable**; tests pass a mock; **no module under `apps/legal-orchestrator/src/legal/llm/` imports `fetch` / `node-fetch` / `undici` / `axios` / any provider SDK**.

## 3. Model router

`routeModel({ task, hasRetrievedChunks })` →

| Task | Decision |
| --- | --- |
| `legal_drafting` | refuses with `refused_no_citations` when no chunks; else `uk-employment-qwen:latest`. |
| `drafting_letter` | refuses without chunks; else `uk-employment-drafting:latest`. |
| `document_summary` | `uk-employment-document:latest`. |
| `small_helper` / `classification` | `uk-employment-qwen:latest` with `reason='low_resource_helper'`. |
| any future task | exhaustiveness guard fails compilation; runtime returns `unknown_task`. |

The router emits only values from the `LocalModelTag` union — the type system rejects any external-provider model name.

## 4. Citation-bound prompt

- System prompt is a fixed string: "Use ONLY supplied sources" + "Cite by chunkId" + "Refuse with insufficient_sources if not enough" + "Do not include secrets / DSNs / API keys / unrelated PII" + "Do not present as a qualified solicitor".
- User prompt contains: jurisdiction, derived `applicable_on`, the question, and the source list. Each chunk is truncated to 1200 chars to bound prompt size.
- `allowedCitationIds` is the exact set of supplied chunk ids — the LLM output guard rejects any cited id outside this set.

## 5. Output guard

- Empty / whitespace-only answer → `empty_answer`.
- Empty `citedChunkIds` → `zero_citations`.
- Any cited id not in the retrieved set → `hallucinated_citation` (entire result rejected; even one bad id is a hard fail).
- Citation metadata (title / url / citationLabel) is taken from the retrieved chunk, never from the model — model-supplied titles and URLs cannot override the trusted source.

## 6. Live gateway status

**DISABLED / MOCK-SAFE.**

- `localLlmGateway.ts` (Sprint 11 interface, pre-existing) defaults `mode='disabled'`, `available=false`.
- `runLocalDraftingStep` requires `gateway.available === true` AND `deps.transport` to be supplied. Either missing returns `llm_unavailable`.
- No file in `apps/legal-orchestrator/src/legal/llm/` imports `fetch` / `node-fetch` / `undici` / `axios` / a public-provider SDK.
- No file references `api.openai.com`, `anthropic.com`, `generativelanguage.googleapis.com`, `cohere.com`, `mistral.ai`.

## 7. Tests + counts

| Command | Exit | Result |
| --- | --- | --- |
| `npx tsc --noEmit` | 0 | typecheck PASS |
| `npm run build` | 0 | build PASS |
| `npx vitest run` | 0 | **647 tests / 52 files PASS** (was 615 / 51; +32 / +1 from `sprint11LocalLlmFoundation.test.ts`) |

`sprint11LocalLlmFoundation.test.ts` covers:

- **modelRouter (6 tests)** — refusal-without-citations, correct tag per task, only-local-tags emission.
- **citationBoundPrompt (7 tests)** — allowedCitationIds exact, only supplied chunks in user prompt, no unrelated chunks, no secrets, "Cite by chunkId / Do not invent statutes / insufficient_sources" in system prompt, `(no sources supplied)` when empty, jurisdiction + applicable_on inclusion.
- **llmOutputGuard (7 tests)** — empty answer, whitespace-only, zero citations, fully hallucinated id, partially hallucinated list, accepted subset, citation metadata sourced from retrieved chunks (not model).
- **runLocalDraftingStep (8 tests)** — empty chunks → insufficient_sources, gateway unavailable → llm_unavailable, no transport → llm_unavailable, transport timeout → llm_unavailable, transport malformed → llm_unavailable, ok+valid-citation → synthesised, ok+hallucinated → citation_failed, ok+empty-answer → citation_failed.
- **Static safety (4 tests)** — no external provider host, no external SDK import, no top-level `fetch(`, no secret-shape literal anywhere in `legal/llm/`.

## 8. Safety scans (full repo, this turn)

| Scan | Hits | Classification |
| --- | --- | --- |
| `openai\|anthropic\|gemini\|claude\|@google/generative-ai\|cohere\|mistral` in `apps/legal-orchestrator/src` (excluding `/tests/`, `/__tests__/`, model-id constants) | 0 production-path | **OK** |
| `api.openai.com\|anthropic.com\|generativelanguage.googleapis.com` in `src` | 0 | **OK** |
| `fetch(` in `src` (excluding `/tests/`) | 0 | **OK** |
| Secret-shape (`github_pat_`, `ghp_…`, `sk-…`, `AKIA…`, `AIza…`, PEM) in new llm files | 0 | **OK** |
| `DATABASE_URL=` in new llm files | 0 | **OK** |

## 9. What this sprint did NOT do

- Did **not** wire `runLocalDraftingStep` into `handleLegalRequest.ts`. Current orchestrator path is unchanged.
- Did **not** add a real HTTP transport. Transport is an interface only; tests inject a mock.
- Did **not** start the audit-log writer that the planning doc described (lands in a later phase, after the staging DB has migration 101 applied).
- Did **not** change `/ready`. The `model_router_configured` extension is a Phase 6 polish.
- Did **not** touch migrations, tests outside the new file, or k8s manifests.

## 10. Remaining risks

| # | Risk | Mitigation |
| --- | --- | --- |
| 1 | A future developer wires `runLocalDraftingStep` into `handleLegalRequest` without operator approval. | Pipeline integration is its own Phase 4 in `SPRINT_11_IMPLEMENTATION_CHECKLIST.md`; gated on Sprint 10 staging PASS. |
| 2 | An adapter under `legal/llm/` is later added that imports `fetch` / `node-fetch` / `undici`. | Static-safety test scans every `.ts` in the directory and fails on banned imports. |
| 3 | Operator misconfigures env to enable the gateway without a transport. | `runLocalDraftingStep` returns `llm_unavailable` when transport is missing; no surprise live call. |
| 4 | A future task type is added without router handling. | `routeModel` carries an exhaustiveness `never` guard; compilation fails before runtime would. |
| 5 | Citation metadata trust-on-model. | Guard takes title/url/citationLabel from the retrieved chunk, never from the model. Test asserts the trusted values win. |

## 11. Truth statement

> No push performed.
> No deployment performed.
> No kubectl mutating command performed.
> No database touched.
> No production DB touched.
> No external LLM calls performed.
> No secret values printed.

---

## 12. Sprint 11 Phase 2A — Audit and Transport Guardrails

### 12.1 Status: **PASS** (audit/transport contracts only; no live transport)

Phase 2A adds the safe metadata audit surface and a transport-policy
guard. **Production behaviour remains unchanged.** No HTTP transport
exists. `runLocalDraftingStep` is still not wired into
`handleLegalRequest.ts`. Sprint 10 real staging DB verification
remains **PENDING**. Production remains **BLOCKED**.

### 12.2 Files added / changed

| File | Action | Purpose |
| --- | --- | --- |
| `apps/legal-orchestrator/src/legal/llm/llmAudit.types.ts` | NEW | `LocalLlmAuditEvent`, `LocalLlmAuditEventStatus` (10 statuses incl. `blocked_by_policy`, `insufficient_sources`). Metadata only — no prompt, draft, chunk text, or facts. |
| `apps/legal-orchestrator/src/legal/llm/llmAuditRedactor.ts` | NEW | Pure `redactLlmAuditEvent` + `assertSafeLlmAuditEvent`. Strips forbidden fields (`prompt`, `draftText`, `userInput`, `DATABASE_URL`, `apiKey`, `secret`, `token`, ...). Rejects DSN-shape / GH-PAT / `sk-` / `AKIA` / `AIza` / PEM / Slack-token / JWT literals. |
| `apps/legal-orchestrator/src/legal/llm/llmAuditSink.ts` | NEW | `LocalLlmAuditSink` interface + `NoopLlmAuditSink` + `InMemoryLlmAuditSink` (tests only). InMemory sink validates via `assertSafeLlmAuditEvent` — throws on unsafe input. No DB, file, network, or console writes. |
| `apps/legal-orchestrator/src/legal/llm/localTransportPolicy.ts` | NEW | Pure `evaluateLocalTransportPolicy` + `validateLocalTransportTarget`. Disabled by default. Permanently rejects public-provider hosts. Auto-allows loopback (`localhost`, `127.0.0.1`, `::1`) and Kubernetes cluster-DNS (`.svc`, `.svc.cluster.local`). Generic external `https://` blocked. |
| `apps/legal-orchestrator/src/legal/llm/runLocalDraftingStep.ts` | UPDATED | Accepts optional `auditSink`, `requestId`, `now`, `eventIdFactory`. Emits redacted, `assertSafeLlmAuditEvent`-validated audit event for every terminal path (`insufficient_sources`, `disabled`/`unavailable`, `blocked_by_policy`, `unavailable` for transport-missing, `timeout`, `malformed_output`, `citation_failed`, `success`). When no sink is injected, behaviour is bit-for-bit identical to Phase 1. |
| `apps/legal-orchestrator/src/legal/llm/index.ts` | UPDATED | Re-exports audit types, redactor, sink, transport policy. |
| `apps/legal-orchestrator/src/tests/sprint11LocalLlmAuditAndTransportPolicy.test.ts` | NEW | 42 tests across redactor (7), assert-guard (6), sinks (3), drafting-step audit emission (6), transport policy (15), static safety (3). |
| `apps/legal-orchestrator/src/tests/sprint11LocalLlmFoundation.test.ts` | UPDATED | Two pre-existing scans (`no external provider hostname appears in legal/llm/`, `no DATABASE_URL or secret-shape literal in legal/llm/`) exempt the two new policy files. Comment explains why. |
| `apps/legal-orchestrator/src/tests/sprint11LlmGateway.test.ts` | UPDATED | The legacy provider-substring scan exempts `localTransportPolicy.ts`. |

### 12.3 Audit event contract

`LocalLlmAuditEvent`:

```text
eventId, requestId, traceId, taskType, selectedModel?, routeReason?,
retrievedChunkCount, citationCount, citedChunkIds[], refusalReason?,
safetyFlags[], latencyMs?, status, createdAt
```

- **`taskType`** restricted to `LlmTask | "unknown"`. Invalid input falls back to `"unknown"`.
- **`selectedModel`** restricted to `LocalModelTag` values (`uk-employment-*:latest`). Unknown values dropped — the redactor will never emit a public-provider model name even if a future caller sets one.
- **`status`** restricted to the 10-value union; invalid values fall back to `"error"`.
- **`citedChunkIds`** sanitised per element — strings only, no spaces, no URL characters, no secret-shape matches. Up to 200 chars each.
- **`safetyFlags`** sanitised per element — short labels only, no secret-shape matches.
- **`createdAt`** — taken from input if a non-empty string, else from the injected `now` clock (defaults to `Date.now()` ISO).

### 12.4 Redaction contract

`redactLlmAuditEvent(input)`:

- Reads only known fields. Forbidden fields (`prompt`, `systemPrompt`, `userPrompt`, `rawPrompt`, `answer`, `draft`, `draftText`, `rawAnswer`, `modelOutput`, `modelText`, `chunks`, `retrievedChunks`, `chunkText`, `documentText`, `facts`, `question`, `userInput`, `caseData`, `privateData`, `apiKey`, `api_key`, `apikey`, `secret`, `secrets`, `password`, `token`, `DATABASE_URL`, `databaseUrl`) are silently ignored on the way out.
- Numeric counts coerced to non-negative integers.
- Optional fields dropped when invalid.

`assertSafeLlmAuditEvent(event)`:

- Throws `UnsafeLlmAuditEventError` if any of the forbidden fields appear on the value.
- Throws if `traceId` / `requestId` / `eventId` / `routeReason` / `refusalReason` contains a DSN / PAT / API-key / PEM / Slack token / JWT shape.
- Throws if any array element in `citedChunkIds` or `safetyFlags` contains a secret-shape literal.
- Throws on out-of-band status / taskType / selectedModel.

### 12.5 Transport policy contract

`evaluateLocalTransportPolicy({ mode, url, allowedInternalHosts })`:

| Case | Decision |
| --- | --- |
| `mode: "disabled"` + no URL | `ok=true, reason="policy_disabled"` |
| `mode: "disabled"` + provider URL | `ok=false, reason="external_provider_blocked"` |
| `mode: "disabled"` + non-provider URL | `ok=true, reason="no_url_required"` |
| `mode: "internal"` + provider host | `ok=false, reason="external_provider_blocked"` |
| `mode: "internal"` + invalid URL string | `ok=false, reason="invalid_url"` |
| `mode: "internal"` + non-http(s) scheme | `ok=false, reason="scheme_not_allowed"` |
| `mode: "internal"` + http://localhost \| 127.0.0.1 \| ::1 | `ok=true, reason="url_allowed_loopback"` |
| `mode: "internal"` + http://*.svc(.cluster.local) | `ok=true, reason="url_allowed_cluster_dns"` |
| `mode: "internal"` + http://other host on allow-list | `ok=true, reason="url_allowed"` |
| `mode: "internal"` + http://other host not on allow-list | `ok=false, reason="host_not_allowed"` |
| `mode: "internal"` + https://anything not on allow-list | `ok=false, reason="external_https_blocked"` |

Permanently denied hosts (in `EXTERNAL_PROVIDER_HOSTS`): `api.openai.com`, `openai.com`, `anthropic.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`, `googleapis.com`, `api.cohere.ai`, `api.cohere.com`, `cohere.ai`, `cohere.com`, `api.mistral.ai`, `mistral.ai`. Both exact-match and `.*<host>` suffix-match are denied.

`validateLocalTransportTarget({ url, enabled, allowedInternalHosts })` is a thin alias that delegates to `evaluateLocalTransportPolicy`.

The policy module never opens a socket, resolves DNS, or imports an HTTP library.

### 12.6 Tests + counts

| Command (from `apps/legal-orchestrator`) | Exit | Result |
| --- | --- | --- |
| `npx tsc --noEmit` | 0 | typecheck **PASS** |
| `npm run build` | 0 | build **PASS** |
| `npx vitest run` | 0 | **689 tests / 53 files PASS** (was 647 / 52 → +42 tests / +1 file from `sprint11LocalLlmAuditAndTransportPolicy.test.ts`) |

New test coverage:

- **Redactor** (7) — strips raw prompt / systemPrompt / userPrompt, draftText / rawAnswer / modelOutput, DATABASE_URL / postgres DSN, apiKey / api_key / secret / token / password; preserves safe metadata; uses injected clock; falls back safely on invalid taskType / status / model / count / array elements.
- **assertSafeLlmAuditEvent** (6) — accepts clean event; rejects `prompt`, `draftText`, secret-shape traceId, secret-shape safetyFlags element, invalid status.
- **Sinks** (3) — `NoopLlmAuditSink` swallows; `InMemoryLlmAuditSink` rejects unsafe events; `InMemoryLlmAuditSink` stores only redacted events.
- **runLocalDraftingStep audit emission** (6) — `disabled`, `unavailable` (transport missing), `citation_failed`, `success`, no-emit when no sink, `insufficient_sources`. The success-path test asserts the event contains the citation count + ids but NEVER the raw answer.
- **Transport policy** (15) — disabled mode, disabled-mode default, rejects OpenAI host, rejects Anthropic host, rejects Gemini host, rejects Cohere and Mistral hosts, rejects generic external https, rejects unknown internal http host without allow-list, rejects non-http(s) schemes, rejects invalid URL, allows explicit allow-list host, allows localhost, allows 127.0.0.1, allows `.svc`, allows `.svc.cluster.local`, `validateLocalTransportTarget` wrapper.
- **Static safety** (3) — no `fetch(`, no http/https library import, no external-provider SDK in `apps/legal-orchestrator/package.json`.

### 12.7 Safety scans (Phase 2A)

| Scan | Hits | Verdict |
| --- | --- | --- |
| `openai\|anthropic\|gemini\|cohere\|mistral` in `apps/legal-orchestrator/src` | All in deny-list scan tests, `localTransportPolicy.ts` (deny-list), or new test fixtures asserting rejection | **OK — deny-list / policy / test** |
| `api.openai.com \| anthropic.com \| ...` in `apps/legal-orchestrator/src` | Only in `localTransportPolicy.ts` deny-list + new test fixtures | **OK — deny-list / test** |
| `fetch(\|axios\|node-fetch\|undici` in `apps/legal-orchestrator/src/legal/llm` | **0** | **OK** |
| `api_key\|apikey\|DATABASE_URL\|postgres://\|github_pat_\|ghp_\|AKIA\|AIza` in `apps/legal-orchestrator/src/legal/llm` | Only in `llmAuditRedactor.ts` (FORBIDDEN_FIELDS + SECRET_SHAPE_PATTERNS) | **OK — redactor policy text** |
| External provider SDK in `apps/legal-orchestrator/package.json` | **0** (asserted by Phase 2A static-safety test) | **OK** |

### 12.8 What Phase 2A did NOT do

- Did **not** add a live HTTP transport. Transport is an interface only.
- Did **not** wire `runLocalDraftingStep` into `handleLegalRequest.ts`. Orchestrator pipeline unchanged.
- Did **not** open a DB-backed audit sink. `NoopLlmAuditSink` is the production default; `InMemoryLlmAuditSink` is test-only.
- Did **not** touch migrations, `/ready`, or any k8s manifest.
- Did **not** change Sprint 10 real staging DB verification status — still **PENDING**.
- Did **not** mark production approved — still **BLOCKED**.

### 12.9 Phase 2A blockers and gates

| Item | Status |
| --- | --- |
| Sprint 10 real staging DB verification | **PENDING** (operator action) |
| Sprint 11 Phase 2B (real HTTP transport) | **NOT STARTED** — gated on staging DB PASS |
| Sprint 11 Phase 4 (pipeline wiring) | **NOT STARTED** — gated on Phase 2B + operator approval |
| Production deployment | **BLOCKED** |

### 12.10 Truth statement (Phase 2A)

> No push performed.
> No deployment performed.
> No kubectl mutating command performed.
> No database touched.
> No production DB touched.
> No external LLM calls performed.
> No secret values printed.
