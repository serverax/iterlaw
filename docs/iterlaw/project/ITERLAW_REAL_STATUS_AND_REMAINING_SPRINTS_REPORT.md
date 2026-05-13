# IterLaw Real Status and Remaining Sprints Report

## 1. Executive Summary

**Overall status: PARTIAL.**

Short verdict:

- **What is real and implemented:**
  - `apps/legal-orchestrator` — TypeScript service: typecheck PASS, build PASS, vitest **73 files / 912 tests PASS**.
  - `apps/web` — Next.js app: typecheck PASS, lint clean, build PASS, jest **41 suites / 185 tests PASS**.
  - 27 SQL migrations on disk under `apps/legal-orchestrator/db/migrations/` (000…010 series + 100/101/102/104/105/106).
  - Legal safety gates: `citation_required`, `zero_citation_answer_blocked`, `insufficient_sources`, `citation_failed` — 73 + 27 grep hits across 20 + 10 source files; actively enforced.
  - Sprint 11 local LLM transport deny policy at `apps/legal-orchestrator/src/legal/llm/localTransportPolicy.ts`.
  - Sprint 12B feature flag `ITERLAW_WEB_AI_FALLBACK_ENABLED` (default OFF) gating `apps/web/lib/ai/{claude,gemini,orchestrate}.ts`.
  - K3s manifests on disk for `iterlaw-ai/legal-orchestrator`, `iterlaw-data/postgres`, `iterlaw-data/backups`, `iterlaw-ai/redis`, `iterlaw-ai/wasm-rule-runner`, `iterlaw-ai/synthesis-worker`, `iterlaw-ai/web`.
  - 7 CI workflows under `.github/workflows/`.
  - 13 operator infra scripts under `scripts/infra/`.
- **What is documented only:**
  - GraphRAG roadmap, Intelligence Layer architecture, RAG trust+freshness model, Semantic cache design, Legal evaluation harness, WASM policy gate — all under `docs/iterlaw/`.
  - Sprints 16–57 in `SPRINT_INDEX.md` and `ROADMAP_REMAINING_SPRINTS.md`.
  - `legal_review_queue` references — only in legacy `backend/` Supabase migrations and `apps/web/lib/supabase/migrations/`, NOT in `apps/legal-orchestrator/` answer path.
- **What is not started:**
  - Agent Factory track (LangGraph, CrewAI, Dify/n8n, Haystack, OpenHands): NOT STARTED and NOT DOCUMENTED in active docs (prior session attempt was reverted).
  - First live backup; live restore; production deployment.
  - Sprint 16 onwards.
- **What is blocked:**
  - Production deployment (separate gate set; not authorised by any sprint to date).
  - AKS / non-Docker staging promotion (Sprint 10 Docker staging only).
  - First live backup + live restore (Sprint 13 authorisation checklist default NO).
  - 2 `npm audit --omit=dev` production advisories remain (Next.js + PostCSS) per `reports/ITERLAW_POST_CURSOR_AUDIT_RECONCILIATION.md`.
- **What needs fixing next:**
  - Sprint 16 PLANNED (MVP polish + smoke test). Resolve the two production advisories under change control.
  - Wider doc drift outside Sprint 12B scope (Sprint 12C reconciliation — 14 files still carry stale `Sprint 10 PENDING / Sprint 11 BLOCKED` text).
  - `legal_review_queue` is referenced in legacy `backend/` and `apps/web/lib/supabase/migrations/` only — orchestrator answer-path has gating but does not implement a queue table.

## 2. Repo State

| Item | Value |
|---|---|
| Repo path | `C:\Users\kalsh\projects\iterlaw` |
| Branch | `master` |
| HEAD commit | `d49ffeb Revert "docs(iterlaw): add AI agent operating model and governance track"` |
| Working tree | Uncommitted: 10 modified + 7 untracked (incl. 4 reports authored across recent sessions; 1 pre-existing untracked report) |
| Report generated at | 2026-05-13 19:02 GMT |

Untracked file inventory:

- `apps/web/lib/ai/__tests__/featureFlag.test.ts` (Sprint 12B)
- `apps/web/lib/ai/__tests__/sprintTruthConsistency.test.ts` (Sprint 12B)
- `apps/web/lib/ai/featureFlag.ts` (Sprint 12B)
- `reports/CURSOR_AUDIT_CLAUDE_SPRINT_11_12_QA_REPORT.md` (pre-existing, untouched)
- `reports/ITERLAW_POST_CURSOR_AUDIT_RECONCILIATION.md` (parallel-session audit, not authored here)
- `reports/ITERLAW_RECOVERY_AUDIT_AND_NEXT_SPRINT_READINESS.md` (recovery audit)
- `reports/ITERLAW_SPRINT_12B_TRUTH_AND_ANSWER_PATH_RECONCILIATION.md` (Sprint 12B)

## 3. Commands Run

| Command | Result | Evidence summary |
|---|---|---|
| `pwd` | PASS | `/c/Users/kalsh/projects/iterlaw` |
| `git status --short` | PASS | 10 modified / 7 untracked |
| `git log --oneline -15` | PASS | HEAD `d49ffeb`, two reverts above it, then `b9084ee` deep-audit |
| `git branch --show-current` | PASS | `master` |
| `npm run typecheck` (root → `@iterlaw/web` `tsc --noEmit`) | PASS | exit 0 |
| `npm run lint` (root → `@iterlaw/web` `next lint`) | PASS | `✔ No ESLint warnings or errors`, exit 0 |
| `npm run build` (root → `@iterlaw/shared` + `@iterlaw/web` Next.js + post-next-standalone) | PASS | "post-next-standalone: static + public copied", exit 0 |
| `npm test` (root jest) | PASS | **41 suites / 185 tests PASS**, exit 0 |
| `npm test` (`apps/legal-orchestrator`, vitest) | PASS | **73 files / 912 tests PASS**, exit 0 |
| `npm run typecheck` (`apps/legal-orchestrator`) | PASS | exit 0 (run in earlier Sprint 12B phase) |
| `npm run build` (`apps/legal-orchestrator`) | PASS | exit 0 (run in earlier Sprint 12B phase) |
| `rg "citation_required\|zero_citation_answer_blocked\|insufficient_sources\|citation_failed\|legal_review_queue"` | PASS | 73 hits / 20 files in `apps/`; 27 hits / 10 files for `insufficient_sources\|citation_failed`; 6 files for `legal_review_queue` (legacy `backend/` + `apps/web/lib/supabase/migrations/`) |
| `rg "LangGraph\|CrewAI\|Dify\|n8n\|Haystack\|OpenHands\|agent operating model\|agent factory"` | PASS | 2 hits — both in this-session report files only; **no active code or doc references** |

### 3.1 Raw output snippets

`npm test` (root):
```
Test Suites: 41 passed, 41 total
Tests:       185 passed, 185 total
Snapshots:   0 total
Time:        7.039 s
```

`npm test` (orchestrator, vitest):
```
 Test Files  73 passed (73)
      Tests  912 passed (912)
   Start at  19:00:53
   Duration  20.23s
```

`npm run lint` (web):
```
✔ No ESLint warnings or errors
```

`npm run build` (web): `Compiled successfully`, `post-next-standalone: static + public copied; trimmed workspace dep from standalone package.json`.

## 4. Sprint Truth Table

| Sprint / Workstream | Claimed Status | Evidence Found | Real Status | Notes |
|---|---|---|---|---|
| Sprint 0 (project bootstrap) | DONE | Repo, package.json, structure | PASS | Inherited foundation. |
| Sprint 1 (foundation) | DONE | Migrations 001–002, package.json | PASS | Per SPRINT_INDEX. |
| Sprint 2 | DONE | Source/tests stable | PASS | Per SPRINT_INDEX rows 1–8 marked DONE. |
| Sprint 3 | DONE | Source/tests stable | PASS | Same. |
| Sprint 4 | DONE | WASM rule-runner k8s manifest exists; orchestrator wired | PASS | Same. |
| Sprint 5 | DONE | Module pipeline; tests | PASS | Same. |
| Sprint 6 | DONE | Migration 002_legal_rag_sprint6.sql + tests | PASS | `migrationSprint6Schema.test.ts` present. |
| Sprint 7 | DONE | Ingestion framework + tests | PASS | `ingestion.sprint7.test.ts` PASS. |
| Sprint 8 | DONE | Readiness + retrieval injection | PASS | `sprint8Ready.test.ts` PASS. |
| Sprint 9 | DONE | Migration 003_legal_rag_sprint9_uk_employment_core.sql + tests | PASS | `migrationSprint9Schema.test.ts` PASS. Rename cleanup done. |
| Sprint 10 | PASS (Docker staging scope) | Migrations 100/101/102/104/105/106 + `reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md` | PASS (Docker scope) | Non-Docker staging promotion remains separate operator decision. |
| Sprint 11 | PASS (closed) | `localTransportPolicy.ts`, `runLocalDraftingStep` wired in `handleLegalRequest`; closeout QA at `11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md` | PASS | Sprint 11 does NOT unblock production. |
| Sprint 12 | PASS FOR DRY-RUN FOUNDATION ONLY | Backup/restore scripts + 39 vitest tests + runbook + ADR | PASS-FOR-FOUNDATION | Live backup + live restore NOT EXECUTED. |
| Sprint 12A | PASS (audit-reconciliation) | `12a-audit-reconciliation/SPRINT_12A_AUDIT_RECONCILIATION_QA_REPORT.md`, `resolveBash.ts` helper | PASS | SPRINT_INDEX truth fix + Windows-bash test resolver. |
| Sprint 12B (this session's prior work) | PASS (truth + answer-path reconciliation) | `reports/ITERLAW_SPRINT_12B_TRUTH_AND_ANSWER_PATH_RECONCILIATION.md`, feature flag + tests | PASS | UNCOMMITTED in working tree. |
| Sprint 13 | PASS FOR OPERATOR-WORKSTATION READINESS ONLY | `--check` toolchain probes + operator toolchain doc + first-live-backup authorisation checklist | PASS-FOR-READINESS | First live backup + live restore NOT AUTHORISED. |
| Sprint 14 | PASS FOR INTELLIGENCE FOUNDATION / CODE-PREPARED ONLY | 11 pure-function modules + 7 test files (54 tests) + 6 architecture docs | PASS-FOR-FOUNDATION | Not wired into the answer path by this sprint. |
| Sprint 15 | PASS FOR FEATURE-FLAGGED LOCAL WIRING ONLY | feature flag config + shadow-mode wiring + `/ready` additive field + 26 new tests | PASS-FOR-FEATURE-FLAGGED | Intelligence Layer disabled by default. |
| Sprint 16 | PLANNED (start) | Plan referenced from SPRINT_INDEX | NOT STARTED | MVP polish + smoke test — no commits attributed to it yet. |
| Sprints 17–57 | PLANNED | Roadmap doc only | NOT STARTED | No implementation. |
| Agent Factory Track (LangGraph/CrewAI/Dify/n8n/Haystack/OpenHands) | (prior-session docs reverted) | No active docs; 0 source files | NOT STARTED + NOT DOCUMENTED | Prior session's IA-1..IA-14 doc set was reverted at commits `7204673` + `d49ffeb`. |

Definitions used as instructed (PASS, PARTIAL, FAIL, UNKNOWN, NOT STARTED).

## 5. What Is Really Done

| Area | Evidence | Status |
|---|---|---|
| Legal orchestrator | `apps/legal-orchestrator/src/*` with `handleLegalRequest.ts`, `intelligence/intelligenceGateway.ts`, RAG service, pipeline modules, types; vitest 73 files / 912 tests PASS | PASS |
| RAG schema | 27 SQL migrations under `apps/legal-orchestrator/db/migrations/` (000–010, 100, 101, 102, 104, 105, 106); migration-chain vitest tests PASS | PASS |
| Readiness endpoint | `apps/legal-orchestrator/src/server.ts` + `sprint8Ready.test.ts` + `intelligenceFeatureFlags.test.ts` adding `intelligence_layer` field | PASS |
| Legal safety gates | `citation_required` / `zero_citation_answer_blocked` / `insufficient_sources` / `citation_failed` — 100 grep hits in 30 files across `apps/`; transport deny policy at `apps/legal-orchestrator/src/legal/llm/localTransportPolicy.ts` | PASS |
| Tests | Orchestrator: vitest 73 files / 912 tests PASS. Root jest (web + packages): 41 suites / 185 tests PASS. | PASS |
| K3s manifests | `k8s/iterlaw/{legal-orchestrator,redis,wasm-rule-runner,synthesis-worker,web,secrets}` + `k8s/iterlaw-data/{postgres,backups,secrets}` + `k8s/iterlaw-disabled-master-order/` + `k8s/iterlaw-disabled-standalone-legal-orchestrator/` + `k8s/synthesis-worker/` + `k8s/deploy.yaml`; namespace/RBAC/quota files present | PRESENT — NOT VERIFIED IN-CLUSTER (no kubectl run this session; cluster reachability not asserted) |
| Backup scripts | `scripts/operator/sprint10-docker-staging-replay.ps1`, Sprint 12/13 backup + restore-verify scripts, Sprint 12 vitest 39 tests PASS, Sprint 13 vitest 25 tests PASS | PASS for DRY-RUN; live not executed |
| Agent docs | None active (prior session's IA-track docs were reverted) | NOT STARTED |
| Security docs | `docs/iterlaw/architecture/ITERLAW_WASM_POLICY_GATE_ARCHITECTURE.md`, `docs/iterlaw/architecture/ITERLAW_RAG_TRUST_AND_FRESHNESS_MODEL.md`, `docs/iterlaw/project/05-security/RLS_SECURITY_MODEL.md` (referenced) | PRESENT (doc-only) |

## 6. What Is Documented Only

| Item | Document | Status |
|---|---|---|
| GraphRAG roadmap | `docs/iterlaw/ITERLAW_GRAPHRAG_ROADMAP.md` | DOCUMENTED ONLY |
| Intelligence Layer architecture | `docs/iterlaw/ITERLAW_INTELLIGENCE_LAYER_ARCHITECTURE.md` | DOCUMENTED ONLY (foundation modules exist; layer disabled by default) |
| Semantic cache design | `docs/iterlaw/ITERLAW_SEMANTIC_CACHE_DESIGN.md` | DOCUMENTED ONLY |
| Legal evaluation harness | `docs/iterlaw/ITERLAW_LEGAL_EVALUATION_HARNESS.md` | DOCUMENTED ONLY |
| Sprint 16 plan | Referenced in `SPRINT_INDEX.md` | DOCUMENTED ONLY — NOT STARTED |
| Sprints 17–57 (roadmap incl. Speed-first retrieval 26–34, WASM stack 35–45, workspace/RLS/SC/approval 46–51, document intelligence 52–57) | `ROADMAP_REMAINING_SPRINTS.md` | DOCUMENTED ONLY — NOT STARTED |
| `legal_review_queue` schema | Only in legacy `backend/supabase/migrations/012_phase1_controlled_answer_engine.sql` and `apps/web/lib/supabase/migrations/012-phase1-controlled-answer-engine.sql` | DOCUMENTED ONLY in `apps/legal-orchestrator` (the actual answer path does not query a `legal_review_queue` table; gating is implemented differently) |
| First live backup / live restore | `13-backup-mvp-polish/FIRST_LIVE_BACKUP_AUTHORISATION_CHECKLIST.md` | DOCUMENTED ONLY — NOT AUTHORISED |

## 7. What Remains

| Priority | Workstream | Remaining Work | Recommended Next Sprint |
|---|---|---|---|
| High | Sprint 12B commit | Stage and commit the 12B truth-reconciliation + feature-flag work (working tree only; not committed) | Commit Sprint 12B (immediate operator action) |
| High | Sprint 12C wider doc drift | Reconcile 14 files outside Sprint 12B scope (see §11) | Sprint 12C |
| High | Sprint 16 | MVP polish + smoke test | Sprint 16 |
| High | Security advisories | Sprint 12E **resolved PostCSS** via lockfile regeneration + `overrides: { "postcss@<8.5.10": "8.5.14" }` + root `next` devDep pin. Production audit now shows **1** remaining advisory (Next.js high, range `<15.5.16`). Tests + build + typecheck + lint all PASS. Fixing Next.js requires change-controlled major upgrade (14 → 15.5.16+ or 16). See `reports/ITERLAW_SPRINT_12E_LOCKFILE_POSTCSS_RECONCILIATION.md`. | Change-controlled Next 14 → 15.5.16+ upgrade |
| Medium | First live backup + live restore | Operator-side; requires authorisation per checklist (default NO) | Operator decision; outside coding sprints |
| Medium | Sprint 17 — Member / auth / subscription foundation | Per SPRINT_INDEX legacy entries | Sprint 17 |
| Medium | Sprint 18 — Law Module Engine Foundation | Per roadmap | Sprint 18 |
| Medium | Agent Factory (operating model + governance + sprint plan) | Not started; prior attempt reverted | Decide whether to re-open before/after Sprint 16 |
| Low | Sprints 19–25 (Law Module Engine work) | Roadmap items | Sequential after Sprint 18 |
| Low | Sprints 26–34 (Speed-first retrieval) | Roadmap items | After Sprints 18–25 |
| Low | Sprints 35–45 (WASM stack) | Roadmap items | After Sprints 26–34 |
| Low | Sprints 46–57 (Workspace/RLS/SC/Approval/Document intelligence) | Post-Sprint-45 backlog | Planning decision |

## 8. Legal Safety Verification

| Safety Control | Evidence | Status | Notes |
|---|---|---|---|
| `citation_required` | 22 hits in `apps/legal-orchestrator/src/`, plus tests `citationGate.test.ts`, `sprint8Ready.test.ts`, `sprint11RagGatewayHardening.test.ts`, `endToEndMock.test.ts`. Server returns the flag in `/ready`. | PASS | Active and tested. |
| `zero_citation_answer_blocked` | 7 hits across 5 files; surfaced in `/ready`. | PASS | Active and tested. |
| `insufficient_sources` | 27 hits across 10 source/test files in `apps/legal-orchestrator/` including `rag.service.ts`, `handleLegalRequest.ts`, `intelligenceGateway.ts`, `types/legal.ts`. | PASS | Active refusal reason code. |
| `citation_failed` | Counted with `insufficient_sources` (same grep family); seen in `handleLegalRequest.ts` + types. | PASS | Active refusal reason code. |
| `legal_review_queue` | Only in legacy `backend/supabase/migrations/012_phase1_controlled_answer_engine.sql` + `apps/web/lib/supabase/migrations/012-phase1-controlled-answer-engine.sql` + 2 audit reports. **Not** referenced from `apps/legal-orchestrator/` answer path. | PARTIAL / PLANNED | Conceptually preserved as gating; no live queue table in orchestrator. |
| No direct legal-answer bypass | Orchestrator transport deny list (`api.openai.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`, `api.cohere.ai`, `api.mistral.ai`) at `apps/legal-orchestrator/src/legal/llm/localTransportPolicy.ts`; web `callAIFallback` gated by Sprint 12B feature flag (default OFF). | PASS | Both surfaces guarded. |

## 9. AI Agent / Agent Factory Status

| Component | Status | Evidence | Notes |
|---|---|---|---|
| LangGraph | NOT STARTED | 0 hits in active code/docs | Prior IA-track doc set was reverted (`d49ffeb`). |
| CrewAI | NOT STARTED | 0 hits in active code/docs | Same. |
| Dify/n8n | NOT STARTED | 0 hits in active code/docs | Same. |
| Haystack + pgvector | NOT STARTED (Haystack); pgvector PRESENT | 0 Haystack hits; `apps/legal-orchestrator/db/migrations/000_pgvector_prerequisite.sql` | pgvector extension is set up; Haystack not used. |
| OpenHands / Claude Code / Cursor | NOT STARTED as platform integration | None | Used as a developer tool (this session) but no in-repo integration. |
| Agent governance | NOT STARTED | Prior `ITERLAW_AGENT_GOVERNANCE_RULES.md` / `ITERLAW_AI_AGENT_OPERATING_MODEL.md` were reverted | Re-introduction requires a planning decision. |

## 10. Infrastructure / Deployment Status

| Area | Evidence | Real Status | Notes |
|---|---|---|---|
| K3s namespace files | `k8s/iterlaw/namespace.yaml`, `k8s/iterlaw-data/namespace.yaml`, RBAC + ResourceQuota + LimitRange manifests | PRESENT — NOT VERIFIED IN-CLUSTER | No kubectl run; no live cluster assertion. |
| Traefik / Ingress | No `ingress.yaml` found at `k8s/iterlaw/legal-orchestrator/`; `deploy.yaml`, `configmap.yaml`, `service.yaml`, `networkpolicy.yaml`, `deployment.yaml` present | PARTIAL — ingress configuration not present in this path | Ingress may live elsewhere or be deferred. |
| Postgres / pgvector | `k8s/iterlaw-data/postgres/statefulset.yaml` + configmap + service + networkpolicy; pgvector migration 000 | PRESENT — NOT VERIFIED IN-CLUSTER | Local Docker staging verified per Sprint 10 report. |
| Ollama / local LLM | No `ollama` manifest under `k8s/iterlaw/`; transport policy targets local HTTP transport but Ollama deployment is not in the repo | DOCUMENTED ONLY for runtime | Phase 2B uses injected HTTP transport. |
| CI / CD | `.github/workflows/build.yml`, `ci.yml`, `ci-reusable.yml`, `iterlaw-k3s-verify.yml`, `legal-orchestrator-ci.yml`, `pull-request.yml`, `test.yml` | PRESENT | 7 workflows on disk. |
| Production deployment | None | NOT DEPLOYED | Explicit `Production: BLOCKED` per `SPRINT_INDEX.md` / `ITERLAW_PROJECT_STATUS.md`. |

## 11. Contradictions or False Claims Found

| Claim | Source | Evidence Against | Correction Needed |
|---|---|---|---|
| "Sprint 10 real staging DB verification: PENDING" | `docs/iterlaw/ITERLAW_SPRINT_ROADMAP.md:116` | `SPRINT_INDEX.md` line 8 + `ITERLAW_PROJECT_STATUS.md` (post-12B) say Docker staging PASS 2026-05-13 | Sprint 12C: reconcile this file. |
| "Sprint 10: repo + local Docker DB PASS. Real staging DB verification: PENDING. Production: BLOCKED." | `docs/iterlaw/project/README.md:28-29` | Same as above | Sprint 12C. |
| "Sprint 11: foundation + Phase 2A audit/transport guardrails PASS. Live HTTP transport: NOT STARTED. Pipeline wiring: NOT STARTED." | `docs/iterlaw/project/README.md:29` | Sprint 11 closed PASS (Phase 2B + Phase 4 wired) | Sprint 12C. |
| "Sprint 11 is READY TO START / UNBLOCKED" | `docs/iterlaw/project/07-sprints/SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md:161` | Sprint 11 closed PASS | Sprint 12C. |
| "Sprint 10 real staging DB verification: PENDING" | `docs/iterlaw/project/02-database/DATABASE_SUMMARY.md:138`, `01-architecture/WORKSPACE_AND_USER_DATA_ARCHITECTURE.md:127`, `01-architecture/LEGAL_AI_CORE_PLATFORM_SCOPE.md:149`, `01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md:114`, `04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md:154`, `11-ai-governance/SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md:231,409`, `11-ai-governance/AIA_OPERATING_MODEL.md:335` | Same as above | Sprint 12C — batch doc-drift fix. |
| Acceptable-procedural: operator runbook says "PENDING → PASS" as a step | `docs/iterlaw/project/07-sprints/SPRINT_10_STAGING_DB_OPERATOR_RUNBOOK.md`, `docs/iterlaw/project/09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md` | Procedural; not a current-status claim | No correction needed; flag as expected text. |
| Acceptable-pedagogical: policy doc uses "Sprint 10 staging PENDING" as a style example | `docs/iterlaw/project/11-ai-governance/DOCUMENTATION_TRUTH_PROTOCOL.md:35,198` | Pedagogical example | No correction needed. |

## 12. Bugs / Gaps Found

| ID | Severity | Area | Issue | Recommended Fix |
|---|---|---|---|---|
| GAP-001 | High | docs | Wider doc drift outside Sprint 12B scope: 14 files claim Sprint 10 PENDING / Sprint 11 BLOCKED while `SPRINT_INDEX.md` says PASS | Open Sprint 12C to batch-update these files. |
| GAP-002 | High | security | 2 production `npm audit --omit=dev` advisories (Next.js + PostCSS) per parallel-session report | Upgrade under change control in Sprint 16 or Sprint 16A patch sprint. |
| GAP-003 | Medium | answer-path | `apps/web/lib/answer/orchestrator.ts` calls `callAIFallback` which now correctly returns `null` by default — but the upstream surface is the **web answer path**, not the orchestrator answer path. Existing path is documented as legacy with feature flag; behavioural correctness should be verified end-to-end | E2E test or operator decision to remove the web fallback path entirely. |
| GAP-004 | Medium | infra | No Ingress manifest found at `k8s/iterlaw/legal-orchestrator/`; only `service.yaml` + `deployment.yaml` + `configmap.yaml` + `networkpolicy.yaml` | Add explicit Ingress / IngressRoute manifest under change control for the production deploy sprint. |
| GAP-005 | Medium | answer-path | `legal_review_queue` is referenced in legacy `backend/` Supabase and `apps/web/lib/supabase/migrations/` but **not** in the orchestrator answer path | Decide whether to import the queue model into the orchestrator path or leave as web/admin-only feature. |
| GAP-006 | Low | docs | `apps/legal-orchestrator/package.json` name is `@ordinoxai/legal-orchestrator` (kept from earlier naming) | Cosmetic; rename considered in a future planning decision. |
| GAP-007 | Low | docs | `ROADMAP_REMAINING_SPRINTS.md` count went from "36 remaining incl. Sprint 10" to "30 remaining (Sprint 16 → Sprint 45)" — verify this matches `SPRINT_INDEX.md` recount | Sanity-check during Sprint 12C. |

## 13. Next Claude Code Tasks

### Task 1 — Commit Sprint 12B work (operator-gated)

**Objective:** Land the Sprint 12B truth-reconciliation + feature-flag gate that is currently uncommitted in the working tree.

**Files:**

- `docs/iterlaw/project/07-sprints/ROADMAP_REMAINING_SPRINTS.md` (modified)
- `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md` (modified)
- `apps/web/lib/ai/claude.ts` (modified)
- `apps/web/lib/ai/gemini.ts` (modified)
- `apps/web/lib/ai/orchestrate.ts` (modified)
- `apps/web/lib/ai/featureFlag.ts` (new)
- `apps/web/lib/ai/__tests__/claude.test.ts` (modified)
- `apps/web/lib/ai/__tests__/gemini.test.ts` (modified)
- `apps/web/lib/ai/__tests__/orchestrate.test.ts` (modified)
- `apps/web/lib/ai/__tests__/featureFlag.test.ts` (new)
- `apps/web/lib/ai/__tests__/sprintTruthConsistency.test.ts` (new)
- `reports/ITERLAW_SPRINT_12B_TRUTH_AND_ANSWER_PATH_RECONCILIATION.md` (new)

**Commands:**

```
git add <files above>
git -c user.email=serverax@gmail.com -c user.name="IterLaw Operator" commit -m "docs(iterlaw): reconcile sprint truth and block external legal LLM path"
```

**Acceptance gates:**

- Orchestrator `npm test` PASS (73 / 912).
- Root `npm test` PASS (41 / 185).
- Root `npm run typecheck`, `npm run lint`, `npm run build` PASS.

**Evidence required:**

- Captured commit hash.
- Captured `git status` clean of these 12 entries.

**Rollback:**

- `git revert <commit>` (history preserved).

### Task 2 — Sprint 12C wider doc drift reconciliation

**Objective:** Update the 14 files listed in §11 to remove stale "Sprint 10 PENDING / Sprint 11 BLOCKED / NOT STARTED" text, leaving operator-procedure / pedagogical / historical hits intact.

**Files (active-status corrections):**

- `docs/iterlaw/ITERLAW_SPRINT_ROADMAP.md` (line ~116)
- `docs/iterlaw/project/README.md` (lines 28–29)
- `docs/iterlaw/project/02-database/DATABASE_SUMMARY.md` (line 138)
- `docs/iterlaw/project/01-architecture/WORKSPACE_AND_USER_DATA_ARCHITECTURE.md` (line 127)
- `docs/iterlaw/project/01-architecture/LEGAL_AI_CORE_PLATFORM_SCOPE.md` (line 149)
- `docs/iterlaw/project/01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md` (line 114)
- `docs/iterlaw/project/04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md` (line 154)
- `docs/iterlaw/project/11-ai-governance/SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md` (lines 231, 409)
- `docs/iterlaw/project/11-ai-governance/AIA_OPERATING_MODEL.md` (line 335)
- `docs/iterlaw/project/07-sprints/SPRINT_11_LOCAL_LLM_GATEWAY_AND_TRANSPORT_POLICY.md` (line 17)
- `docs/iterlaw/project/07-sprints/SPRINT_11_IMPLEMENTATION_CHECKLIST.md` (lines 3, 87)
- `docs/iterlaw/project/07-sprints/SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md` (line 161)

**Commands:**

- After edits: re-run grep `Sprint 10.*PENDING|Sprint 11.*BLOCKED|Sprint 11.*NOT STARTED|Sprint 11.*UNBLOCKED` against `docs/iterlaw/` — expect only operator-procedure / pedagogical / historical hits, no active-status hits.
- `npm test`; `npm run typecheck`; `npm run build`; orchestrator vitest.

**Acceptance gates:**

- Doc-consistency tests (the `sprintTruthConsistency.test.ts` introduced in Sprint 12B) still PASS.
- All other test suites unchanged.

**Evidence required:**

- Captured grep before / after.
- Captured commit hash.

**Rollback:** `git revert` the commit.

### Task 3 — Sprint 16 (operator-decision sprint)

**Objective:** MVP polish + smoke test against seeded UK Employment corpus.

**Files (proposed; subject to planning):**

- Smoke test fixtures and scripts.
- Updates to `apps/web` answer surface for cited-answer rendering.
- `reports/ITERLAW_SPRINT_16_QA_REPORT.md` template.

**Commands:**

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

**Acceptance gates:**

- End-to-end cited answer against seeded UK Employment corpus (mock or Docker staging).
- Citation gates remain enforced.

**Evidence required:**

- Captured smoke-test outputs.
- Updated SPRINT_INDEX row.

**Rollback:** `git revert` per change.

### Task 4 — Security advisories patch

**Objective:** Address the 2 production `npm audit --omit=dev` advisories (Next.js + PostCSS) under change control.

**Files:** `package.json`, `package-lock.json`, lockfile.

**Commands:** `npm audit --omit=dev`, `npm install --omit=dev <pinned>`, then `npm run build`, `npm test`.

**Acceptance gates:** advisories cleared; tests still PASS.

**Evidence required:** before / after audit output; commit hash.

**Rollback:** lockfile rollback / `git revert`.

## 14. Final Verdict

**Final status: PARTIAL.**

**Reason:**

- The orchestrator answer path is real, tested, and stable (73 / 912 tests PASS, build PASS, typecheck PASS). The web surface is real, tested, and stable (41 / 185 tests PASS, lint clean, build PASS).
- Legal safety gates (`citation_required`, `zero_citation_answer_blocked`, `insufficient_sources`, `citation_failed`) are active and tested. External-LLM transport deny policy is enforced in the orchestrator; the web fallback path is gated by Sprint 12B feature flag (default OFF).
- Sprint 12B work is **complete in the working tree but not yet committed**. Sprint 12C wider doc-drift reconciliation has not started. Sprint 16 onwards has not started.
- 2 production security advisories remain (per parallel-session reconciliation report). Live backup + live restore + production deployment remain not authorised / blocked.
- The Agent Factory track is not started in active docs (prior session attempt reverted).

The repo is internally coherent on the core answer path and legal safety, but **wider documentation drift and the security advisories prevent a PASS verdict**. PARTIAL is the honest classification.
