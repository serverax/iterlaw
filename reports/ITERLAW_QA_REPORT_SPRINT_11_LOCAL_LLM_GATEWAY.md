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
