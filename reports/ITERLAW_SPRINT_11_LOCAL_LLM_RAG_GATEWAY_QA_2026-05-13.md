# Sprint 11 — Local LLM Gateway + Cited RAG Answer Path — QA Report

**Date:** 2026-05-13.
**Owner:** App AIA + RAG AIA + Safety Gate AIA.
**Repo HEAD at write time:** `c102f51 feat(iterlaw): sprint 11 hardening tests for gateway, rag, gates, audit, envelope`.

## Final status

**PARTIAL.**

- **PASS** for Phase 1 (foundation) + Phase 2A (audit / transport guardrails) + Sprint 11 hardening tests covering the six workstreams.
- **NOT STARTED** for Phase 2B (live HTTP transport in the production answer path) and Phase 4 (wiring `runLocalDraftingStep` into `handleLegalRequest`). Both are **out of scope** for Sprint 11 per the task contract at `docs/iterlaw/project/07-sprints/SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md` §"Out of scope for Sprint 11".

Sprint 11 is therefore not yet marked PASS. It will become PASS only after Phase 2B + Phase 4 ship under operator approval, with their own QA evidence.

## Commits created this sprint

| Commit | Title |
| --- | --- |
| `b896764` | feat(iterlaw): add local llm gateway contracts and routing guardrails (Phase 1 foundation) |
| `b14fd2d` | feat(iterlaw): add local llm audit and transport guardrails (Phase 2A) |
| `5c5d812` | docs(iterlaw): clean sprint 11 status in sprint index |
| `70e1df9` | docs(iterlaw): define sprint 11 tasks and refresh roadmap status |
| `c102f51` | feat(iterlaw): sprint 11 hardening tests for gateway, rag, gates, audit, envelope |

(This QA report adds a sixth commit and a status-docs refresh in the same series.)

## Files changed in the Sprint 11 hardening commit

| File | Action |
| --- | --- |
| `apps/legal-orchestrator/src/tests/sprint11RagGatewayHardening.test.ts` | NEW — 561 lines / 25 tests covering all six Sprint 11 workstreams. |

## Test results

| Command (cwd `apps/legal-orchestrator`) | Exit | Result |
| --- | --- | --- |
| `npx tsc --noEmit` | 0 | **PASS** |
| `npm run build` | 0 | **PASS** |
| `npx vitest run src/tests/sprint11RagGatewayHardening.test.ts` | 0 | **25 / 25 PASS** |
| `npx vitest run` (full suite) | 0 | **56 files / 733 tests PASS** (prior 55 / 708 → +1 file / +25 tests) |

## Workstream-by-workstream coverage

### 1. Local LLM gateway contract hardening — PASS

| Assertion (test) | Verdict |
| --- | --- |
| No external provider SDK imported in `legal/llm/` | PASS |
| No top-level `fetch(` in the drafting / routing / guard / policy / audit modules (the `localOllamaGateway.ts` health probe is allow-listed and not in the answer path) | PASS |
| `describeLocalLlmGateway()` defaults to `mode='disabled'`, `configured=false`, `available=false`, `reason='DISABLED'` | PASS |
| `runLocalDraftingStep` with a disabled gateway returns `llm_unavailable` and **never** calls the transport | PASS |
| `runLocalDraftingStep` with empty retrieved chunks returns `insufficient_sources` and never reaches the transport | PASS |
| `modelRouter` refuses `legal_drafting` when no citations exist | PASS |
| `guardLlmOutput` rejects empty / zero-citation / hallucinated outputs | PASS |
| `localTransportPolicy` permanently denies the five public-provider hostnames (OpenAI, Anthropic, Gemini, Cohere, Mistral) | PASS |

### 2. RAG answer path — PASS

| Assertion | Verdict |
| --- | --- |
| `createRagService().describe()` returns a defined, safe strategy string | PASS |
| `describe()` output never carries a credential-bearing DSN | PASS |
| `server.ts` `/ready` derives `rag` from `describe()` only (not from `process.env.DATABASE_URL`) | PASS |
| `/ready` always exposes `legal_safety.citation_required = true` and `legal_safety.zero_citation_answer_blocked = true` | PASS |
| End-to-end Docker staging verification (Sprint 10 closeout commit `5edf953`) showed `rag.configured=true`, `rag.mode=postgres`, `rag.database=configured` with no DSN leak | PASS — see `reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md` |

### 3. Deterministic legal gate order — PASS

| Assertion (against `handleLegalRequest`) | Verdict |
| --- | --- |
| Empty retrieval → safe non-`ok` status; no fabricated answer; `external_llm_used=false` | PASS |
| Retrieval returns chunks but no draft → safe non-`ok` status; no fabricated answer | PASS |
| No retrieval injected + no `DATABASE_URL` → mock-safe; safe non-`ok` status | PASS |
| High-risk-deadline / needs-more-facts short-circuits before drafting | PASS |

**Note on status names.** The current `handleLegalRequest` envelope returns: `needs_more_facts`, `high_risk_deadline`, `insufficient_sources`, `citation_failed`, `policy_failed`, `safe_answer`. The Sprint 11 task contract names the success status `ok` and includes `llm_unavailable`, `human_review_required`, `bad_request`. Renaming `safe_answer` → `ok` and emitting `llm_unavailable` from the live answer path are part of Phase 4 (pipeline wiring of `runLocalDraftingStep` into `handleLegalRequest`), which is **out of scope for Sprint 11**. The contract-level safety property — *no fabricated answer leaks, gates are not bypassable by the model* — holds with the existing status set.

### 4. Audit trail — PASS

| Assertion | Verdict |
| --- | --- |
| `redactLlmAuditEvent` strips raw prompt / draft / chunks / facts / question / `DATABASE_URL` / `apiKey` from any input | PASS |
| `assertSafeLlmAuditEvent` throws on smuggled forbidden field | PASS |
| `InMemoryLlmAuditSink` rejects unsafe event at `record()` time (defence in depth) | PASS |
| `NoopLlmAuditSink` is the safe default that discards | PASS |

### 5. API response envelope — PASS (current shape locked)

| Assertion | Verdict |
| --- | --- |
| `request_id` echoed back | PASS |
| `status` is one of the documented refusal statuses on a safe refusal path | PASS |
| `answer` is a string; `citations` and `next_steps` are arrays | PASS |
| `external_llm_used` is always `false` in the current build | PASS |
| `synthesis_status` is `not_attempted` (skeleton state — no LLM draft path wired) | PASS |
| The envelope **never** contains a DSN / password / `DATABASE_URL` / `sk-` literal | PASS |

The Phase-4 envelope rename (`safe_answer` → `ok`) and the three currently-unemitted statuses (`llm_unavailable`, `human_review_required`, `bad_request`) are out of scope; tracked in the Sprint 11 task contract.

### 6. Sprint 11 QA gate — PASS

- typecheck: PASS (exit 0).
- build: PASS (exit 0).
- vitest: PASS (56 files / 733 tests).
- Static safety: PASS.

## Security scans

| Scan | Result |
| --- | --- |
| External provider hostname in active production source (excluding `legal/llm/localTransportPolicy.ts` deny-list) | **0** |
| External provider SDK in `apps/legal-orchestrator/package.json` | **0** (`openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, `cohere-ai`, `@mistralai/mistralai` all absent) |
| Plaintext DSN in production source (`apps/legal-orchestrator/src/`, excluding `/tests/`) | **0** |
| `POSTGRES_PASSWORD` plaintext in committed file | **0** (only env-var references in runbooks + redaction needles in scripts/tests) |
| `Sprint 11 complete` / `production verified` / `production approved` / `ready for production` active claim | **0** |
| `RightsNow` / `iterlaw-prod` in active source | **0** |

## Gateway behaviour summary

- **Default state:** `mode=disabled`, `configured=false`, `available=false`, `reason=DISABLED`. Documented at `/ready`.
- **Live HTTP transport:** **NOT STARTED** (Phase 2B — out of scope).
- **Pipeline wiring (`runLocalDraftingStep` → `handleLegalRequest`):** **NOT STARTED** (Phase 4 — out of scope).
- **External LLM call from the answer path:** **forbidden** by `localTransportPolicy.ts` (denies 5 public-provider hostnames) + static-test assertion of no provider SDK in `package.json`.
- **Audit:** every drafting attempt emits a redacted `LocalLlmAuditEvent` (no raw prompt / no DSN / no secret). Production sink defaults to `NoopLlmAuditSink`.

## RAG / citation behaviour summary

- `DATABASE_URL` configured → live Postgres retrieval port (Sprint 10 close-out evidence in `reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md` shows `rag.mode=postgres` end-to-end).
- `DATABASE_URL` unset → mock retrieval (returns empty `chunks`).
- `/ready` exposes the safe payload only — no host, no DSN.
- Citation gate enforced in `runLegalModulePipeline` (existing tests `module_citationVerifier.test.ts` etc. cover this surface).
- Zero-citation drafts are refused. Hallucinated-citation drafts are refused.

## Audit safety summary

- `LocalLlmAuditEvent` shape enforces metadata-only fields.
- `redactLlmAuditEvent` removes 28 forbidden fields (`prompt`, `userPrompt`, `systemPrompt`, `rawPrompt`, `draft`, `draftText`, `rawAnswer`, `modelOutput`, `modelText`, `chunks`, `retrievedChunks`, `chunkText`, `documentText`, `facts`, `question`, `userInput`, `caseData`, `privateData`, `apiKey`, `api_key`, `apikey`, `secret`, `secrets`, `password`, `token`, `DATABASE_URL`, `databaseUrl`).
- `assertSafeLlmAuditEvent` runs as defence in depth on every sink dispatch.
- `InMemoryLlmAuditSink` validates again at `record()` time so test harnesses fail loud on regression.

## Final status recommendation

- **Sprint 11 overall:** **PARTIAL** — Phase 1 + Phase 2A + hardening tests landed; Phase 2B + Phase 4 remain out of scope per task contract.
- **Sprint 12:** **BLOCKED on Sprint 11 completion as a precondition only if Sprint 11 is required as a hard gate.** Sprint 12 (backup go-live) is otherwise an independent operator workstream; it does not require Sprint 11 LLM-drafting wiring to start.
- **Production:** **BLOCKED.**

This QA report records evidence for the in-scope subset only. Sprint 11 is **not** marked complete by this report.

## Truth statement

> No push performed.
> No deployment performed.
> No production DB touched.
> No kubectl mutating command performed.
> No external LLM call performed.
> No secret values printed.
> Sprint 11 implementation completion is **not** claimed.
> Sprint 10: **PASS** (Docker staging scope).
> Sprint 11: **PARTIAL** — see workstream table above.
> Sprints 12–57: **PLANNED only**.
> Production: **BLOCKED**.
