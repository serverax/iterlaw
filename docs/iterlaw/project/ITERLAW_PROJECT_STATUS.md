# IterLaw Project Status

Last updated: 13 May 2026.

This file is the **canonical project status**. The root `ITERLAW_PROJECT_STATUS.md` is a pointer to this file.

## Current verified gate state

- Sprint 10 code-side migration verification: **PASS**.
- Sprint 10 real Docker staging DB replay: **PASS** (2026-05-13; container `iterlaw-staging-postgres` from `pgvector/pgvector:pg16`; see [`../../../reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`](../../../reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md)). Docker scope only — **not** AKS staging, **not** production.
- Sprint 10 overall: **PASS** (Docker staging scope).
- Sprint 11: **PASS** — Phase 1 + Phase 2A + hardening + Phase 2B (live local HTTP transport, commit `3681fab`) + Phase 4 (pipeline wiring of `runLocalDraftingStep`, commit `120b9de`). Full suite at Sprint 11 close: **58 files / 763 tests PASS**. Sprint 11 is **NOT** a production-unblock sprint; first live backup, live restore, and production deployment remain gated by their own sprints. Closeout QA: [`11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md`](11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md).
- Sprint 12: **PASS FOR DRY-RUN FOUNDATION ONLY** — Track B operator-side scripts. Live backup + live restore **NOT EXECUTED**.
- Sprint 12A: **PASS** — audit-reconciliation (SPRINT_INDEX truth fix, header corrections, Windows-bash test resolver). Full suite **73 files / 912 tests PASS** at close.
- Sprint 13: **PASS FOR OPERATOR-WORKSTATION READINESS ONLY**. First live backup + live restore **NOT AUTHORISED**.
- Sprint 14: **PASS FOR INTELLIGENCE FOUNDATION / CODE-PREPARED ONLY** — not wired into the answer path.
- Sprint 15: **PASS FOR FEATURE-FLAGGED LOCAL WIRING ONLY** — Intelligence Layer disabled by default.
- Production: **BLOCKED**. Single source of truth: [`PRODUCTION_READINESS_GATE.md`](PRODUCTION_READINESS_GATE.md) + [`PRODUCTION_READINESS_GATE.json`](PRODUCTION_READINESS_GATE.json). Verifier: `node scripts/verify-production-readiness-gate.mjs` (exits non-zero while any gate fails).
- **Post-Sprint-17 security state (2026-05-13):** root `npm run typecheck` + `npm run lint` + `npm run build` + `npm test` **PASS**; `apps/legal-orchestrator` `npm run typecheck` + `npm run build` + `npm test` **PASS** (73 files / 912 tests). **`npm audit --omit=dev`:** **0 production vulnerabilities** (Next.js upgraded 14.2.35 → 15.5.18; PostCSS cleared in Sprint 12E). Repo **security verdict for production deps: PASS** (G08 PASS). Total `npm audit` shows 7 dev-only vulnerabilities (jest-environment-jsdom transitive + eslint-config-next transitive glob); these do not block production. Evidence: `reports/ITERLAW_SPRINT_17_NEXT_SECURITY_UPGRADE.md`. Production readiness: **NO** (G09/G10/G11/G13 NOT_VERIFIED; G12 PARTIAL — live backup/restore/deployment NOT AUTHORISED; K3s/Traefik/live cluster NOT VERIFIED).

## Sprint 10 closeout — what passed and what is still scoped out

- Migration 100 compatibility shim landed in commit `21364f4`.
- Migration 102 compatibility shim landed in commit `c17ffc2`.
- Operator replay executed by [`scripts/operator/sprint10-docker-staging-replay.ps1`](../../../scripts/operator/sprint10-docker-staging-replay.ps1) on 2026-05-13. Output: all forward migrations applied, extensions (`pgcrypto`, `vector`, `pg_trgm`, `unaccent`) present, key tables present (`users`, `workspaces`, `workspace_members`, `legal_sources`, `legal_documents`, `legal_chunks`, `legal_cases`, `legal_case_*`), RLS enabled where required, fail-closed RLS demonstrated by sessionless smoke counts (0 rows for user-data tables), policies present, orchestrator typecheck / build / vitest **55 files / 708 tests** on that replay host (historical log line). **Current** legal-orchestrator Vitest after Sprint 12A + post-audit verification: **73 files / 912 tests PASS**. `/ready` returned the required field shape with no DSN / password / `POSTGRES_PASSWORD` / `DATABASE_URL` in the response body.
- Scope of this PASS: the locally-managed Docker container only. **Not** AKS staging, **not** any real operator-managed dev DB, **not** production. Promotion beyond Docker staging remains a separate operator decision.

QA evidence:
- [`../../../reports/ITERLAW_QA_REPORT_SPRINT_10_MIGRATION_102_COMPATIBILITY_FIX.md`](../../../reports/ITERLAW_QA_REPORT_SPRINT_10_MIGRATION_102_COMPATIBILITY_FIX.md)
- [`../../../reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`](../../../reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md)

## Current delivery status

- **Completed (scoped — see scopes above):** Sprints 1–15 plus Sprint 12A correction.
- **Current:** Sprint 16 — PLANNED start.
- **Sprint 10 status:** **PASS** (Docker staging scope). Non-Docker staging promotion remains a separate operator decision.
- **Sprint 11 status:** **PASS** (Phase 1 + Phase 2A + hardening + Phase 2B + Phase 4 closed).
- **Sprint 12 status:** **PASS FOR DRY-RUN FOUNDATION ONLY**. Live backup + live restore **NOT EXECUTED**.
- **Sprint 13 status:** **PASS FOR OPERATOR-WORKSTATION READINESS ONLY**. First live backup + live restore **NOT AUTHORISED**.
- **Sprint 14 status:** **PASS FOR INTELLIGENCE FOUNDATION / CODE-PREPARED ONLY**. Not wired into the answer path.
- **Sprint 15 status:** **PASS FOR FEATURE-FLAGGED LOCAL WIRING ONLY**. Intelligence Layer disabled by default.
- **Production status:** **BLOCKED**.
- **External LLM — `apps/legal-orchestrator` `/api/legal/ask` path:** **FORBIDDEN** (no Anthropic / OpenAI / Gemini SDK in `apps/legal-orchestrator/package.json`; local/Ollama gateway only, with policy tests). **`POST /api/orchestrator/legal/ask` (web):** thin proxy to the orchestrator — **no** Claude/Gemini in that route. **Web `callAIFallback` (`apps/web/lib/ai/orchestrate.ts`):** Claude/Gemini **only when** `ITERLAW_WEB_AI_FALLBACK_ENABLED` is set true; **default off** (returns `null` — no network call).
- **Offline-first legal DB model:** **ACCEPTED architecture decision**. See [`10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md) and [`01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md`](01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md).
- **Local LLM:** fallback / background builder only, **not** the default answer engine.
- **RAG:** local DB + pgvector + verified citations only. No external retrieval, no scraping in the answer path.
- **WASM:** control plane / safety / routing / validation layer, **not** the heavy LLM runtime.

## Sprint count

- **Total roadmap:** **57 sprints**.
- **Completed (scoped):** **15** (Sprints 1–11 PASS; Sprint 12 PASS-for-dry-run-foundation; Sprint 13 PASS-for-operator-workstation-readiness; Sprint 14 PASS-for-intelligence-foundation; Sprint 15 PASS-for-feature-flagged-local-wiring; plus correction Sprint 12A).
- **Current sprint:** **Sprint 16** (PLANNED start).
- **Remaining:** **42**.
- **Remaining range:** **Sprint 16 → Sprint 57.**
- **Sprint 10:** **PASS** — Docker staging verification.
- **Sprint 11:** **PASS** — Phase 1 + Phase 2A foundation + Sprint 11 hardening tests + Phase 2B (live local HTTP transport, commit `3681fab`) + Phase 4 (pipeline wiring of `runLocalDraftingStep`, commit `120b9de`). Full suite **58 files / 763 tests PASS** (was 56 / 733 → +2 files / +30 tests). Closeout QA report: [`11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md`](11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md).
- **Sprint 12:** **PASS FOR DRY-RUN FOUNDATION ONLY** — Track B operator-side backup script + restore-verify script + manifest validator + restore-target validator + 39 vitest tests + runbook + ADR (commits `a750f88` → `fdafca3`). Full suite **59 files / 802 tests PASS** (was 58 / 763 → +1 file / +39 tests). Live backup + live restore **NOT EXECUTED**. Track A (cluster Borg path) **unchanged**. Closeout QA report: [`12-backup-go-live/SPRINT_12_BACKUP_GO_LIVE_QA_REPORT.md`](12-backup-go-live/SPRINT_12_BACKUP_GO_LIVE_QA_REPORT.md). ADR: [`12-backup-go-live/ADR_SPRINT_12_BACKUP_AND_RECOVERY_POLICY.md`](12-backup-go-live/ADR_SPRINT_12_BACKUP_AND_RECOVERY_POLICY.md). Runbook: [`12-backup-go-live/SPRINT_12_BACKUP_RESTORE_RUNBOOK.md`](12-backup-go-live/SPRINT_12_BACKUP_RESTORE_RUNBOOK.md).
- **Sprint 13:** **PASS FOR OPERATOR-WORKSTATION READINESS ONLY** — `--check` toolchain probe on both Track B scripts + operator toolchain doc + first-live-backup authorisation checklist (default NO) + 25 new vitest tests (commits `45a10e3` → `ba3a586` + Sprint 13 QA). Full suite **61 files / 827 tests PASS** (was 59 / 802 → +2 files / +25 tests). First live backup + live restore **NOT AUTHORISED**. Closeout QA report: [`13-backup-mvp-polish/SPRINT_13_BACKUP_MVP_POLISH_QA_REPORT.md`](13-backup-mvp-polish/SPRINT_13_BACKUP_MVP_POLISH_QA_REPORT.md). ADR: [`13-backup-mvp-polish/ADR_SPRINT_13_BACKUP_MVP_POLISH_AND_OPERATOR_READINESS.md`](13-backup-mvp-polish/ADR_SPRINT_13_BACKUP_MVP_POLISH_AND_OPERATOR_READINESS.md). Operator toolchain doc: [`13-backup-mvp-polish/SPRINT_13_OPERATOR_TOOLCHAIN_CHECK.md`](13-backup-mvp-polish/SPRINT_13_OPERATOR_TOOLCHAIN_CHECK.md). Authorisation checklist: [`13-backup-mvp-polish/FIRST_LIVE_BACKUP_AUTHORISATION_CHECKLIST.md`](13-backup-mvp-polish/FIRST_LIVE_BACKUP_AUTHORISATION_CHECKLIST.md).
- **Sprint 14:** **PASS FOR INTELLIGENCE FOUNDATION / CODE-PREPARED ONLY** — 11 pure-function intelligence modules + 7 test files (54 tests) + 6 architecture docs + Sprint 14 plan + foundation QA report (commits `5470757`, `427e8ff`, `b53fa9a`). Not wired into the answer path by this sprint.
- **Sprint 15:** **PASS FOR FEATURE-FLAGGED LOCAL WIRING ONLY** — feature flag config (`apps/legal-orchestrator/src/config/featureFlags.ts`) + shadow-mode wiring of `runIntelligenceGateway` in `handleLegalRequest` (intentional PARTIAL ACTIVE wiring) + `/ready` additive `intelligence_layer` field + 26 new vitest tests. Full suite **72 files / 907 tests PASS** at Sprint 15 feature-complete; **73 files / 912 tests PASS** after Sprint 12A audit reconciliation (Jest/Vitest split + Windows bash argv fixes). Intelligence Layer disabled by default; first live backup + live restore remain **NOT AUTHORISED**. ADR: [`15-intelligence-layer-wiring/ADR_SPRINT_15_INTELLIGENCE_LAYER_FEATURE_FLAGGED_WIRING.md`](15-intelligence-layer-wiring/ADR_SPRINT_15_INTELLIGENCE_LAYER_FEATURE_FLAGGED_WIRING.md). Closeout QA report: [`15-intelligence-layer-wiring/SPRINT_15_INTELLIGENCE_LAYER_WIRING_QA_REPORT.md`](15-intelligence-layer-wiring/SPRINT_15_INTELLIGENCE_LAYER_WIRING_QA_REPORT.md).
- **Sprint 16:** **PLANNED**.
- **Sprints 17–57:** **PLANNED.**
- **Production:** **BLOCKED.**

Roadmap detail: [`07-sprints/ROADMAP_REMAINING_SPRINTS.md`](07-sprints/ROADMAP_REMAINING_SPRINTS.md). Sprint table: [`07-sprints/SPRINT_INDEX.md`](07-sprints/SPRINT_INDEX.md). Sprint 11 task contract: [`07-sprints/SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md`](07-sprints/SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md).

## Current blockers

- **Sprint 10 non-Docker staging promotion** (AKS staging / real operator DB) remains a separate operator decision. The local AKS context observed is production-only, so AKS staging verification is blocked until a non-production context exists. Docker-staging verification itself is **PASS**.
- **First live backup + live restore: NOT AUTHORISED** (Sprint 13 authorisation checklist defaults to NO).
- **Production deployment: BLOCKED** (separate gate set).
- **No push without operator approval.**
- **No production DB touched.**
- **Offline-first tier infrastructure is documented but not fully implemented:**
  - **Tier 0** Redis exact cache: **not implemented**.
  - **Tier 1** semantic Q&A cache (HNSW): **not implemented**.
  - **Tier 2** section registry direct-answer path: **not implemented**.
  - **Tier 3** semantic / RAG search: partial — single-tier retrieval port wired in code, but module-scoped tier infrastructure not built.
  - **Tier 4** legal knowledge graph / formula registry: **not implemented**.
  - **Tier 5** local LLM fallback: interface + audit + transport policy delivered (Sprint 11 Phase 1 + Phase 2A); live local HTTP transport delivered (Phase 2B, commit `3681fab`); pipeline wiring delivered (Phase 4, commit `120b9de`). Intelligence Layer wiring is feature-flagged off by default (Sprint 15).

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

**Sprint 16 — PLANNED start (MVP polish + smoke test).**

Sprints 1–15 (plus 12A) are closed at the scopes recorded above. The next active sprint is Sprint 16 per [`07-sprints/SPRINT_INDEX.md`](07-sprints/SPRINT_INDEX.md). No work past Sprint 16 is committed delivery; Sprints 17–57 remain PLANNED.

Hard rules that carry into Sprint 16 and every sprint after:

- Transport deny policy continues to deny `api.openai.com`, `anthropic.com`, `generativelanguage.googleapis.com`, `api.cohere.ai`, `api.mistral.ai`, etc. in `apps/legal-orchestrator`.
- No direct OpenAI / Anthropic / Gemini / Cohere / Mistral calls in the orchestrator request path.
- No live answer-path LLM call by default; LLM allowed only as a fallback / background builder, and only after citation-ready evidence exists.
- The web-side AI fallback path (`apps/web/lib/ai/*`) is governed by feature flag `ITERLAW_WEB_AI_FALLBACK_ENABLED` (default OFF as of Sprint 12B). When OFF, the answer path refuses external LLM calls.

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
