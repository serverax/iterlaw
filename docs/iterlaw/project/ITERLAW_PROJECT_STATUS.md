# IterLaw Project Status

Last updated: 13 May 2026.

This file is the **canonical project status**. The root `ITERLAW_PROJECT_STATUS.md` is a pointer to this file.

## Current delivery status

- **Completed:** Sprints 1–9.
- **Current:** Sprint 10 — staging DB verification / closeout.
- **Sprint 10 status:** **PENDING** operator-side verification. Repo + local Docker DB verification are PASS; real staging DB verification is **not** complete.
- **Production status:** **BLOCKED**.
- **External LLM in live answer path:** **FORBIDDEN**. The Sprint 11 transport policy denies provider hostnames at runtime; no provider SDK is present in `apps/legal-orchestrator/package.json`.
- **Offline-first legal DB model:** **ACCEPTED architecture decision**. See [`10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md) and [`01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md`](01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md).
- **Local LLM:** fallback / background builder only, **not** the default answer engine.
- **RAG:** local DB + pgvector + verified citations only. No external retrieval, no scraping in the answer path.
- **WASM:** control plane / safety / routing / validation layer, **not** the heavy LLM runtime.

## Sprint count

- **Total roadmap target:** Sprint 45.
- **Completed:** 9.
- **Remaining including current Sprint 10:** **36**.
- **Remaining after Sprint 10 passes:** **35**.

Roadmap detail: [`07-sprints/ROADMAP_REMAINING_SPRINTS.md`](07-sprints/ROADMAP_REMAINING_SPRINTS.md). Sprint table: [`07-sprints/SPRINT_INDEX.md`](07-sprints/SPRINT_INDEX.md).

Sprint 46+ items previously documented (Workspace + RLS + Supreme Controller + Approval + Document intelligence) are now **post-Sprint-45 backlog** and are not counted in the 36 / 35 remaining figures above.

## Current blockers

- **Sprint 10 real staging DB verification not completed.** Operator-side procedure: [`09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`](09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md). The AKS context observed locally is production-only, so AKS staging verification is blocked until a non-production context exists.
- **No production deployment allowed.**
- **No production DB touched.**
- **No push without operator approval.**
- **Offline-first tier infrastructure is documented but not fully implemented:**
  - **Tier 0** Redis exact cache: **not implemented**.
  - **Tier 1** semantic Q&A cache (HNSW): **not implemented**.
  - **Tier 2** section registry direct-answer path: **not implemented**.
  - **Tier 3** semantic / RAG search: partial — single-tier retrieval port wired in code, but module-scoped tier infrastructure not built.
  - **Tier 4** legal knowledge graph / formula registry: **not implemented**.
  - **Tier 5** local LLM fallback: interface + audit + transport policy delivered (Sprint 11 Phase 1 + Phase 2A, mock-safe); **live HTTP transport NOT STARTED; pipeline wiring NOT STARTED**.

## Naming + guardrails

- **Active product name:** IterLaw.
- **Wider platform / company brain:** OrdinoxAI (used in AIA governance specifications — see [`11-ai-governance/SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md`](11-ai-governance/SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md)).
- **Forbidden in active material:** RightsNow (legacy product name; allowed only in clearly marked legacy / disabled / archive material — see [`00-index/CANONICAL_NAMES.md`](00-index/CANONICAL_NAMES.md)).
- **Canonical Kubernetes namespaces:** `iterlaw-ai`, `iterlaw-rag`, `iterlaw-api`, `iterlaw-monitoring`, `iterlaw-security`. **Forbidden:** `iterlaw-prod`, bare `iterlaw`.
- **No external LLM call** in the orchestrator request path.
- **No `:latest`** in any active deployable manifest.

## AI governance

The **Superior AI Architect AIA** governs IterLaw's AI architecture decisions — model identifiers, prompt changes, RAG / retrieval changes, transport policy, WASM modules, evaluation harnesses, and adoption of GraphRAG / Self-RAG / long-context / reranking. Specification: [`11-ai-governance/SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md`](11-ai-governance/SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md).

## Next sprint recommendation

**Sprint 11 — Local LLM Gateway and Transport Policy.**

Sprint 11 may only be marked complete when **either**:

- Sprint 10 real staging DB verification is recorded as PASS, **or**
- the Sprint 11 work is limited to mock-safe code / tests / docs that do not require staging DB access.

Recommended Sprint 11 scope:

- Local LLM gateway hardening.
- Transport deny policy verification (denies `api.openai.com`, `anthropic.com`, `generativelanguage.googleapis.com`, `api.cohere.ai`, `api.mistral.ai`, etc.).
- Mock-safe local LLM interface.
- No external provider SDK.
- No direct OpenAI / Anthropic / Gemini / Cohere / Mistral calls.
- No live answer-path LLM call by default.
- LLM allowed only as a fallback / background builder, and only after citation-ready evidence exists.

Full plan: [`07-sprints/SPRINT_11_LOCAL_LLM_GATEWAY_AND_TRANSPORT_POLICY.md`](07-sprints/SPRINT_11_LOCAL_LLM_GATEWAY_AND_TRANSPORT_POLICY.md).

## Truth statement

> No push performed.
> No deployment performed.
> No kubectl mutating command performed.
> No database touched.
> No production DB touched.
> No external LLM calls performed.
> No secret values printed.

## Rule for agents (Claude Code, Cursor, AIA)

Before starting work, read this file. Then report:

- What sprint you are working on.
- What files you will touch.
- What checks you will run.
- Whether the task is safe to commit.
- Whether the task is safe to push.

Do not push, deploy, create secrets, or run production DB commands unless explicitly instructed.
