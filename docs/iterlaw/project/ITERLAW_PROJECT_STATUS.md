# IterLaw Project Status

Last updated: 13 May 2026.

This file is the **canonical project status**. The root `ITERLAW_PROJECT_STATUS.md` is a pointer to this file.

## Current verified gate state

- Sprint 10 code-side migration verification: **PASS**.
- Sprint 10 real Docker staging DB replay: **PASS** (2026-05-13; container `iterlaw-staging-postgres` from `pgvector/pgvector:pg16`; see [`../../../reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`](../../../reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md)).
- Sprint 10 overall: **PASS** (Docker staging scope).
- Sprint 11: **UNBLOCKED / READY TO START** — Phase 1 + Phase 2A mock-safe foundation already landed; Phase 2B (live HTTP transport) + Phase 4 (pipeline wiring) **NOT STARTED**; no implementation is claimed complete by this update.
- Production: **BLOCKED**.

## Sprint 10 closeout — what passed and what is still scoped out

- Migration 100 compatibility shim landed in commit `21364f4`.
- Migration 102 compatibility shim landed in commit `c17ffc2`.
- Operator replay executed by [`scripts/operator/sprint10-docker-staging-replay.ps1`](../../../scripts/operator/sprint10-docker-staging-replay.ps1) on 2026-05-13. Output: all forward migrations applied, extensions (`pgcrypto`, `vector`, `pg_trgm`, `unaccent`) present, key tables present (`users`, `workspaces`, `workspace_members`, `legal_sources`, `legal_documents`, `legal_chunks`, `legal_cases`, `legal_case_*`), RLS enabled where required, fail-closed RLS demonstrated by sessionless smoke counts (0 rows for user-data tables), policies present, orchestrator typecheck / build / vitest 55-files / 708-tests PASS, `/ready` returned the required field shape with no DSN / password / `POSTGRES_PASSWORD` / `DATABASE_URL` in the response body.
- Scope of this PASS: the locally-managed Docker container only. **Not** AKS staging, **not** any real operator-managed dev DB, **not** production. Promotion beyond Docker staging remains a separate operator decision.

QA evidence:
- [`../../../reports/ITERLAW_QA_REPORT_SPRINT_10_MIGRATION_102_COMPATIBILITY_FIX.md`](../../../reports/ITERLAW_QA_REPORT_SPRINT_10_MIGRATION_102_COMPATIBILITY_FIX.md)
- [`../../../reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`](../../../reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md)

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

- **Total roadmap:** **57 sprints**.
- **Completed:** **10** (Sprints 1–10).
- **Current sprint:** **Sprint 11**.
- **Remaining:** **47**.
- **Remaining range:** **Sprint 11 → Sprint 57.**
- **Sprint 10:** **PASS** — Docker staging verification.
- **Sprint 11:** **PASS** — Phase 1 + Phase 2A foundation + Sprint 11 hardening tests + Phase 2B (live local HTTP transport, commit `3681fab`) + Phase 4 (pipeline wiring of `runLocalDraftingStep`, commit `120b9de`). Full suite **58 files / 763 tests PASS** (was 56 / 733 → +2 files / +30 tests). Closeout QA report: [`11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md`](11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md).
- **Sprint 12:** **PASS FOR DRY-RUN FOUNDATION ONLY** — Track B operator-side backup script + restore-verify script + manifest validator + restore-target validator + 39 vitest tests + runbook + ADR (commits `a750f88` → `fdafca3`). Full suite **59 files / 802 tests PASS** (was 58 / 763 → +1 file / +39 tests). Live backup + live restore **NOT EXECUTED**. Track A (cluster Borg path) **unchanged**. Closeout QA report: [`12-backup-go-live/SPRINT_12_BACKUP_GO_LIVE_QA_REPORT.md`](12-backup-go-live/SPRINT_12_BACKUP_GO_LIVE_QA_REPORT.md). ADR: [`12-backup-go-live/ADR_SPRINT_12_BACKUP_AND_RECOVERY_POLICY.md`](12-backup-go-live/ADR_SPRINT_12_BACKUP_AND_RECOVERY_POLICY.md). Runbook: [`12-backup-go-live/SPRINT_12_BACKUP_RESTORE_RUNBOOK.md`](12-backup-go-live/SPRINT_12_BACKUP_RESTORE_RUNBOOK.md).
- **Sprint 13:** **PASS FOR OPERATOR-WORKSTATION READINESS ONLY** — `--check` toolchain probe on both Track B scripts + operator toolchain doc + first-live-backup authorisation checklist (default NO) + 25 new vitest tests (commits `45a10e3` → `ba3a586` + Sprint 13 QA). Full suite **61 files / 827 tests PASS** (was 59 / 802 → +2 files / +25 tests). First live backup + live restore **NOT AUTHORISED**. Closeout QA report: [`13-backup-mvp-polish/SPRINT_13_BACKUP_MVP_POLISH_QA_REPORT.md`](13-backup-mvp-polish/SPRINT_13_BACKUP_MVP_POLISH_QA_REPORT.md). ADR: [`13-backup-mvp-polish/ADR_SPRINT_13_BACKUP_MVP_POLISH_AND_OPERATOR_READINESS.md`](13-backup-mvp-polish/ADR_SPRINT_13_BACKUP_MVP_POLISH_AND_OPERATOR_READINESS.md). Operator toolchain doc: [`13-backup-mvp-polish/SPRINT_13_OPERATOR_TOOLCHAIN_CHECK.md`](13-backup-mvp-polish/SPRINT_13_OPERATOR_TOOLCHAIN_CHECK.md). Authorisation checklist: [`13-backup-mvp-polish/FIRST_LIVE_BACKUP_AUTHORISATION_CHECKLIST.md`](13-backup-mvp-polish/FIRST_LIVE_BACKUP_AUTHORISATION_CHECKLIST.md).
- **Sprint 14:** **PLANNED**.
- **Sprints 15–57:** **PLANNED.**
- **Production:** **BLOCKED.**

Roadmap detail: [`07-sprints/ROADMAP_REMAINING_SPRINTS.md`](07-sprints/ROADMAP_REMAINING_SPRINTS.md). Sprint table: [`07-sprints/SPRINT_INDEX.md`](07-sprints/SPRINT_INDEX.md). Sprint 11 task contract: [`07-sprints/SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md`](07-sprints/SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md).

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
