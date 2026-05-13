# Sprint 11 — Local LLM Gateway and Transport Policy

## Status

> **CLOSED — Sprint 11 PASS.** Sprint 10 Docker staging DB replay: **PASS** (2026-05-13). Sprint 11 Phase 2B (live local HTTP transport, commit `3681fab`) + Phase 4 (pipeline wiring of `runLocalDraftingStep` into `handleLegalRequest`, commit `120b9de`) are landed. Sprint 11 closeout QA: `docs/iterlaw/project/11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md`. The planning text below is preserved as the historical record. Sprint 11 does **not** unblock production.

**Status (historical, at planning):** PLANNED / BLOCKED BY SPRINT 10 STAGING DB CLOSEOUT.
**Status (current):** **CLOSED / PASS** (Sprint 10 Docker staging gate met; Phase 2B + Phase 4 landed).

Sprint 11 was originally not to be marked complete until **either**:

- Sprint 10 staging DB verification was recorded as PASS, **or**
- the Sprint 11 work was limited to mock-safe code / tests / docs that did not require staging DB access.

> **Historical progress note (preserved as the at-the-time record):** the Sprint 11 mock-safe code surface (`apps/legal-orchestrator/src/legal/llm/`) and tests landed across two prior commits:
>
> - `b896764` — local LLM gateway contracts and routing guardrails (Phase 1).
> - `b14fd2d` — local LLM audit and transport guardrails (Phase 2A).
>
> These were mock-safe by construction (gateway DISABLED by default; no live HTTP transport; no DB writes; no network in tests). They did **not** constitute Sprint 11 completion **at the time of this document's authoring**. Subsequently, Sprint 10 Docker-staging DB replay landed PASS (2026-05-13), and Sprint 11 Phase 2B + Phase 4 landed (commits `3681fab` and `120b9de`), closing Sprint 11.

## Goal

Build the local LLM gateway contract **without** allowing the LLM to become the default legal answer engine.

The local LLM is:

- **fallback only**;
- bounded by retrieved citation-complete evidence;
- blocked when citations are missing;
- not allowed to call external providers;
- not allowed to bypass offline-first tiers.

See the architecture contract: [`../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md`](../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md) and the ADR: [`../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md).

## Scope

### 1. Local LLM gateway interface

- Accepts only citation-ready evidence packs (`BoundedSynthesisInput` with non-empty `retrievedChunks`).
- Rejects empty evidence → `insufficient_sources`.
- Rejects chunks without citation metadata → `citation_failed`.
- Returns structured refusal (`llm_unavailable`, `blocked_by_policy`, `citation_failed`) when the gateway is unavailable, the router refuses, or the output guard rejects.

### 2. Transport deny policy

- Deny **OpenAI**, **Anthropic**, **Gemini**, **Cohere**, **Mistral**, and other public-provider hostnames in the live answer path.
- Allow only internal targets (loopback, cluster-DNS, explicit allow-listed internal hosts).
- Tests prove **no provider SDK** is in `apps/legal-orchestrator/package.json` (`openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, `cohere-ai`, `@mistralai/mistralai`).
- Grep-based static-safety scans assert no direct provider usage in `apps/legal-orchestrator/src/legal/llm/`.

### 3. Offline-first enforcement

The answer path must run the offline-first tiers before the LLM. See [`../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md`](../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md):

- **Tier 0** Redis exact hash cache.
- **Tier 1** semantic Q&A cache (HNSW).
- **Tier 2** `law_section_modules` / section registry lookup.
- **Tier 3** semantic law section / RAG search.
- **Tier 4** deterministic legal knowledge graph / formula lookup.
- **Tier 5** local LLM fallback.

**Tier 5 must not run if Tiers 0–4 can answer safely.** A Tier-5 run with empty retrieved evidence short-circuits to `insufficient_sources`.

### 4. Mock-safe tests

- Tests must pass **without** `DATABASE_URL`.
- Tests must pass **without** Ollama running.
- Tests must **not** make network calls.
- Tests must **not** require Kubernetes.

### 5. `/ready` safety

- `/ready` must not leak secrets.
- `/ready` must state local-LLM enabled / disabled state safely (base URLs, API keys, model paths, `DATABASE_URL` never returned).
- `/ready` must state that external LLM is disabled.

## Out of scope

- No production deployment.
- No production DB.
- No real legal advice generation without verified local corpus.
- No external LLM.
- No Kubernetes mutation.
- No live scraping.
- No push.

## Acceptance criteria

- `npm run typecheck` passes in `apps/legal-orchestrator`.
- The repo's existing test command passes (`npx vitest run` for `apps/legal-orchestrator`).
- Grep scan confirms no direct external provider usage in `apps/legal-orchestrator/src`.
- Sprint 11 doc is linked from `SPRINT_INDEX.md`.
- `ITERLAW_PROJECT_STATUS.md` shows Sprint 11 as **planned**, not complete (until either of the two gates above is met).
- No source file prints `DATABASE_URL` or secrets.
- No provider SDK added to `apps/legal-orchestrator/package.json`.

## Phases (current progress and remaining work)

| Phase | Scope | Status |
| --- | --- | --- |
| 1 — Foundation | router + citation-bound prompt + output guard + disabled-by-default drafting helper | **PASS** (mock-safe) — `b896764` |
| 2A — Audit + transport policy | audit types + redactor + Noop/InMemory sinks + transport policy guard | **PASS** (mock-safe) — `b14fd2d` |
| 2B — Live HTTP transport | real internal Ollama HTTP transport behind the existing `OllamaTransport` interface, gated by `evaluateLocalTransportPolicy` | **NOT STARTED** — gated on Sprint 10 staging DB PASS |
| 4 — Pipeline wiring | wire `runLocalDraftingStep` into `handleLegalRequest` (with `NoopLlmAuditSink` by default) | **NOT STARTED** — gated on Phase 2B + operator approval |
| 6 — `/ready` polish | add `model_router_configured` field | **NOT STARTED** |

## Related

- Sprint 11 long-form plan (legacy): [`SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md`](SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md)
- Sprint 11 implementation checklist: [`SPRINT_11_IMPLEMENTATION_CHECKLIST.md`](SPRINT_11_IMPLEMENTATION_CHECKLIST.md)
- Sprint 10 operator checklist: [`../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`](../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md)
- QA report: `reports/ITERLAW_QA_REPORT_SPRINT_11_LOCAL_LLM_GATEWAY.md`
- Project status: [`../ITERLAW_PROJECT_STATUS.md`](../ITERLAW_PROJECT_STATUS.md)
