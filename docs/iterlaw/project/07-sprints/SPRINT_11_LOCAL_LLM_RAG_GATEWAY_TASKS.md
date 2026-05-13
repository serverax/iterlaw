# Sprint 11 — Local LLM Gateway + Cited RAG Answer Path

> **CLOSED — Sprint 11 PASS.** Phase 2B (live local HTTP transport, commit `3681fab`) and Phase 4 (pipeline wiring of `runLocalDraftingStep` into `handleLegalRequest`, commit `120b9de`) are landed. Sprint 11 closeout QA: `docs/iterlaw/project/11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md`. The "READY TO START / UNBLOCKED" header below reflects the state at the time this task contract was authored; it is preserved as the historical planning record.

**Status (historical, at authoring):** READY TO START / UNBLOCKED.
**Status (current):** **CLOSED / PASS** (Sprint 11 ended; Sprint 11 does **not** unblock production).
**Date:** 2026-05-13.
**Prior phase evidence:**
- Phase 1 foundation (router + citation-bound prompt + output guard + disabled-by-default drafting helper): **PASS** (commit `b896764`).
- Phase 2A audit + transport policy guardrails: **PASS** (commit `b14fd2d`).
- Phase 2B (live HTTP transport): **PASS** (commit `3681fab`).
- Phase 4 (pipeline wiring): **PASS** (commit `120b9de`).

**Sprint 10 gate:** **PASS** in Docker staging scope ([`SPRINT_INDEX.md`](SPRINT_INDEX.md), `reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`). Non-Docker staging promotion remains a separate operator decision. Production remains **BLOCKED** (separate gate set; live backup/restore/deployment NOT AUTHORISED).

---

## Objective

Build the safe local LLM + cited RAG answer path **without** allowing:

- uncited legal answers,
- external LLM calls,
- model bypass of deterministic legal gates.

No Sprint 11 deliverable is marked complete until the workstream's gates listed below all pass, with named test / scan / `/ready` evidence in `reports/`.

---

## Workstreams

### 1. Local LLM gateway contract hardening

**Goal:** every LLM call path through the orchestrator is bounded, injectable, audited, and disabled-by-default.

- Transport is **injected only**. No top-level `fetch` / `axios` / `node-fetch` / `undici` import inside `apps/legal-orchestrator/src/legal/llm/` (already asserted by `sprint11LocalLlmFoundation.test.ts` + `sprint11LocalLlmAuditAndTransportPolicy.test.ts`).
- **No external provider calls.** `localTransportPolicy.ts` denies `api.openai.com`, `anthropic.com`, `generativelanguage.googleapis.com`, `api.cohere.ai`, `api.mistral.ai` at runtime; static-safety test asserts zero provider SDK in `apps/legal-orchestrator/package.json`.
- **Disabled-by-default** when the gateway is unavailable. `runLocalDraftingStep` returns `llm_unavailable` if any of: gateway disabled, transport missing, transport non-`ok`, output-guard rejection.
- **`llm_unavailable` status** is a first-class refusal status — the orchestrator returns it cleanly without producing an answer body.
- **No raw prompt stored.** Audit events carry only `eventId`, `requestId`, `traceId`, `taskType`, `selectedModel`, `routeReason`, `retrievedChunkCount`, `citationCount`, `citedChunkIds`, `refusalReason`, `safetyFlags`, `latencyMs`, `status`, `createdAt`. The Phase 2A redactor + `assertSafeLlmAuditEvent` enforce this at runtime.
- **No DSN or secret leak** in any audit event, any log, any `/ready` response, or any committed report.
- **Audit event for every model route** — emitted via `LocalLlmAuditSink` (NoopLlmAuditSink in production; InMemoryLlmAuditSink in tests).

**Acceptance:**
- All Sprint-11 LLM-gateway tests stay green.
- No new top-level `fetch(` / provider SDK import.
- `/ready` shows `llm.local_gateway_mode = "disabled"` and `llm.external_llm_enabled = false` until operator explicitly enables a live transport.

### 2. RAG answer path wiring

**Goal:** retrieval and citation verification happen **before** any LLM draft, and `DATABASE_URL` selects the live RAG path.

- **`DATABASE_URL` configured → Postgres RAG mode.** The `/ready` response surfaces `rag.mode = "postgres"` and `rag.database = "configured"`. Verified post-Sprint-10 by the operator script's `/ready` field check.
- **No `DATABASE_URL` → mock mode.** Existing `createRagService` selection preserves mock-safe behaviour when the env var is unset; no regression.
- **Retrieval before drafting.** The pipeline runs `postgresRetrieval` (or the mock equivalent) and assembles a citation-ready evidence pack **before** any call to `runLocalDraftingStep`.
- **Citation verification before answer.** Every retrieved chunk must carry `chunk_id`, `document_id`, `title`, `url`, `citation_label`. Drops on missing fields → `citation_failed`.
- **`insufficient_sources`** when source coverage is weak (empty retrieval after every tier, or chunks fail the citation gate before drafting).
- **`citation_failed`** when citation verification fails after drafting (hallucinated chunk-id, output-guard rejection on cited ids).
- **Local LLM only after** retrieval + citation context exists. The drafter is never reached with empty `retrievedChunks`.

**Acceptance:**
- Existing 55 vitest files / 708 tests stay green, plus any new tests added in this workstream.
- A small targeted test confirms `DATABASE_URL` set → Postgres mode in the wiring layer (no live DB required; checked via env-config surface).
- `/ready` continues to expose `rag.configured=true`, `rag.mode=postgres`, `rag.database=configured` against the Docker staging DB.

### 3. Deterministic legal gates

**Goal:** the gates that protect a user from a wrong / unsafe legal answer run in a fixed order, and the LLM cannot override any of them.

- **PII handling before retrieval / LLM.** `pii_guard` (WASM-deterministic) redacts emails, phone numbers, NI numbers, raw payment data and any other configured PII from downstream prompts, retrieval queries, and audit rows.
- **Risk classification** (intent / complexity tier) runs after PII handling; output picks the retrieval tier path + model-route hint.
- **Deadline detection** (`deadline_calculator`, WASM-deterministic) runs against case facts (`dismissal_date`, `incident_date`, `acas_ec_start`, ...). Imminent / past statutory deadline → short-circuit to `high_risk_deadline` with non-legal-advice next-step copy.
- **Citation gate** — every retrieved chunk must carry `chunk_id`, `document_id`, `title`, `url`, `citation_label`. Cache hits re-verify against the current corpus before serve.
- **Policy gate** — jurisdiction lock, off-topic detection, banned-claim detection, "AI solicitor" wording check, statutory-cap bounds.
- **Deterministic rule checks** — module rule pack (qualifying period, ACAS clock, statutory caps, fire-and-rehire, zero-hours reference period, etc.). Questions fully answered deterministically **skip the LLM**.
- **Local LLM cannot override any gate.** The order is gate → drafter → validator. Drafter output that fails the citation gate or RAV → `citation_failed`. Drafter output that contradicts a deterministic rule → `policy_failed`.

**Acceptance:**
- Targeted tests (existing + new) prove each gate's refusal status and ordering.
- No code path lets a drafter output reach the streamer without traversing the gates.

### 4. Audit trail

**Goal:** every legal-answer request leaves a redacted, queryable audit envelope with **zero** secrets / raw prompts / raw answers.

- Per-request envelope carries: `requestId`, `traceId`, `userId` (workspace-scoped), `country_id`, `module_id`, retrieval result summary (`retrievedChunkCount`, `citedChunkIds[]`), citation-verification result, gate result, local-LLM route result, final status, `latencyMs`, `createdAt`.
- **No secrets.** `assertSafeLlmAuditEvent` rejects DSN-shape / PAT / `sk-` / `AKIA` / `AIza` / PEM / Slack-token / JWT literals.
- **No raw sensitive prompt.** Forbidden fields enumerated in `llmAuditRedactor.ts` (`prompt`, `userPrompt`, `systemPrompt`, `rawPrompt`, `answer`, `draftText`, `rawAnswer`, `modelOutput`, `modelText`, `chunks`, `retrievedChunks`, `chunkText`, `documentText`, `facts`, `question`, `userInput`, `caseData`, `privateData`, `apiKey`, `api_key`, `apikey`, `secret`, `secrets`, `password`, `token`, `DATABASE_URL`, `databaseUrl`).
- **Default sink:** `NoopLlmAuditSink` in production. `InMemoryLlmAuditSink` is test-only.
- Durable / queryable storage (DB-backed sink) is **out of scope** for Sprint 11 and requires a separate ADR.

**Acceptance:**
- Existing audit tests stay green.
- Any new audit emission added in Sprint 11 is asserted-safe before sink dispatch.

### 5. API response envelope

**Goal:** every answer response (and every refusal) has a single, predictable shape the future ChatGPT-style UI can render.

Envelope fields:

- `status` — one of the allowed status values below.
- `answer` — string (present only when `status = "ok"`; otherwise omitted).
- `citations` — array of `{ chunkId, documentId, title, url, citationLabel }` (taken from retrieved chunks; never from model output).
- `applicableOn` — derived "law as at" date (ISO `YYYY-MM-DD`).
- `nextSteps` — array of plain-English next-step strings (ACAS contact, ET1 deadline, missing-fact prompt).
- `safetyNotes` — refusal reasons / warnings.
- `reviewRequired` — boolean. `true` when the request was routed to the human approval queue.
- `requestId` — stable id correlating with audit envelope.
- `mode` — one of `"mock"`, `"postgres"`, `"deterministic"`, `"local_llm_draft"`, `"cached"`.

Required statuses:

- `ok` — answer with citations, citation gate + policy gate + RAV all clean.
- `insufficient_sources` — empty retrieval, or all chunks failed the citation gate.
- `citation_failed` — draft produced but citation verification rejected it (hallucinated / out-of-set chunk id, missing metadata).
- `policy_failed` — policy gate rejected the draft (jurisdiction, off-topic, banned claim).
- `high_risk_deadline` — statutory deadline imminent / past.
- `human_review_required` — confidence below floor, source coverage partial, or other approval-queue trigger.
- `llm_unavailable` — gateway disabled, transport missing, or transport non-`ok`.
- `bad_request` — malformed intake (missing `country_id` / `module_id` / `user_id`, oversized question, malformed JSON).

Each status maps cleanly to a `safetyNotes` line so the UI can render an appropriate refusal.

**Acceptance:**
- A small targeted test asserts the envelope shape for at least one status per refusal (and `ok`).
- The envelope contains no DSN / no password / no internal stack trace / no raw chunk text.

### 6. Sprint 11 QA gate

**Goal:** before Sprint 11 is marked done, the following must all be green with named evidence.

- `npx tsc --noEmit` — exit 0.
- `npm run build` — exit 0.
- `npx vitest run` — exit 0 with files / tests count recorded.
- Static-safety scan: no `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, `cohere-ai`, `@mistralai/mistralai`, `node-fetch`, `undici`, `axios`, `got` in `apps/legal-orchestrator/src/legal/llm/`.
- Hardcoded-secret scan: no `iterlaw_staging_password`, no plaintext DSN in any committed artefact.
- `DATABASE_URL` leak scan: no `DATABASE_URL=<value>` in code, docs, or reports outside of forbidden-policy / scan-command / safety-procedure text.
- Uncited answer-path scan: every code path that returns `status: "ok"` traces through the citation gate.
- `/ready` shows safe fields with no DSN / no password.
- Production remains **BLOCKED** in `SPRINT_INDEX.md` + `ITERLAW_PROJECT_STATUS.md` + `PROJECT.md`.

**Sprint 11 completion is recorded only after** all six workstreams' acceptance lines are green, in one QA report at `reports/ITERLAW_QA_REPORT_SPRINT_11_LOCAL_LLM_RAG_GATEWAY.md` (the existing Phase 2A report is updated, not replaced).

---

## Out of scope for Sprint 11

The following are explicitly **not** part of Sprint 11 and require their own sprint / ADR before they can be implemented:

- Live HTTP transport to a real Ollama / vLLM / llama.cpp endpoint in the production answer path (Phase 2B — future-sprint scope; depends on operator-approved internal endpoint + transport-policy allow-list).
- Wiring `runLocalDraftingStep` into `handleLegalRequest` (Phase 4 — gated on Phase 2B + operator approval).
- DB-backed audit sink (separate ADR required).
- External LLM federation (Sprint 41; interface only).
- Multi-tier retrieval beyond what's already wired (Sprints 18 / 19 / 21 / 24 / 25 / 26).
- Streaming UX, SSE, two-stage cascade (Sprints 26–34).
- Document intelligence (Sprints 52–57).
- Production deployment (BLOCKED).

---

## Truth statement

> Sprint 11 is **READY TO START / UNBLOCKED.**
> No Sprint 11 workstream is claimed complete in this task document.
> No push performed.
> No deployment performed.
> No kubectl mutating command performed.
> No production DB touched.
> No external LLM call performed.
> No secret values printed.
> Sprint 11 implementation, when it begins, will preserve all six workstream guardrails above. Any deviation requires an ADR in `../10-decisions/` and explicit operator approval.
