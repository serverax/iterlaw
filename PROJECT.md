# IterLaw — Project Overview

**IterLaw** is the legal AI product. First beta: **UK Employment Law**. Future expansion supports multiple countries and legal domains (Employment, Immigration, Housing, Benefits, Family, Debt, Consumer, Business, Tax).

Last updated: 2026-05-14.

> **Rebaseline note (2026-05-14, HEAD `b7af17f`).** Two 5-sprint bundles delivered since the "Current status" section below was last fully refreshed: bundle 12F / 17 / 18 / 19 / 12G (PARTIAL — Sprint 12F operator-environment-blocked; Sprints 17 / 18 / 19 / 12G PASS) and bundle 12H / 18A / 19A / 20 / 12J (PARTIAL — Sprint 12H operator-environment-blocked; Sprints 18A / 19A / 20 / 12J PASS).
>
> **Bundle 12K / 20A / 19B / 21 / 12L / 22 / 23 / 24 / 25 / 26 — executed 2026-05-14 (PARTIAL).** Sprint 12K PARTIAL (operator-environment blocker repeats); Sprints 20A, 19B, 21, 12L, 22, 23, 24, 25, 26 all PASS.
>
> **Bundle 12M / 27 / 28 / 29 / 30 / 31 / 32 / 12N / 33 / 34 — executed 2026-05-14 (PARTIAL).** Sprint 12M PARTIAL (Docker daemon offline + SSH TCP timeout); Sprint 31 PARTIAL (no committed authoritative rate evidence — structure + validation delivered, seed empty); Sprints 27, 28, 29, 30, 32, 12N, 33, 34 PASS. **8 of 10 PASS; 2 PARTIAL.**
>
> **Bundle 12P / 35 / 36 / 37 / 38 / 12Q / 39 / 40 / 41 / 42 — executed 2026-05-14 (PARTIAL).** Sprint 12P PARTIAL (Docker daemon offline + **host-truth unresolved**: repo pins IterLaw to 138.201.253.56, operator note says 148.251.247.56 — no SSH probe performed; verifier script NOT edited). Sprint 12Q PARTIAL (live execution not authorised; apply-script refusal re-confirmed). Sprint 37 PARTIAL (no authoritative cited rate values committed — operator action documented). Sprints 35, 36, 38, 39, 40, 41, 42 all PASS. **7 of 10 PASS; 3 PARTIAL.** Numbered roadmap progression: Sprints 1–42 delivered with reports + commits; Sprints 43–57 remain PLANNED (**15 numbered sprints remaining**). Production readiness: **NO** (12 / 17 gates PASS; G09 / G10 / G11 NOT_VERIFIED, G12 PARTIAL, G13 NOT_VERIFIED — all operator-environment dependencies; G10/G11 now additionally blocked on host-truth resolution). Local / code testing readiness: **YES**. Production / live testing readiness: **NO**.
>
> Full evidence: [`reports/ITERLAW_NEXT_10_SPRINT_BUNDLE_12K_20A_19B_21_12L_22_23_24_25_26_SUMMARY.md`](reports/ITERLAW_NEXT_10_SPRINT_BUNDLE_12K_20A_19B_21_12L_22_23_24_25_26_SUMMARY.md).

---

## Naming + namespaces

- **Active product name:** IterLaw. Used in runtime UI, config, package names (`@iterlaw/*`), READMEs, project docs, repo name.
- **Forbidden in active material:** `RightsNow` (legacy product name; allowed only in clearly marked legacy / disabled / archive material).
- **Canonical Kubernetes namespaces:**
  - `iterlaw-ai`
  - `iterlaw-rag`
  - `iterlaw-api`
  - `iterlaw-monitoring`
  - `iterlaw-security`
- **Forbidden namespaces:** `iterlaw-prod`, bare `iterlaw`. Legacy `iterlaw-data` may remain in the data plane until safely retired.

Authoritative naming reference: [`docs/iterlaw/project/00-index/CANONICAL_NAMES.md`](docs/iterlaw/project/00-index/CANONICAL_NAMES.md) + [`docs/iterlaw/project/11-ai-governance/NAMING_CONSISTENCY_POLICY.md`](docs/iterlaw/project/11-ai-governance/NAMING_CONSISTENCY_POLICY.md).

---

## Current status (high level)

### Sprint progress (refreshed 2026-05-14)

- **Total numbered roadmap:** 57 sprints.
- **Numbered sprints delivered with reports + commits:** **42** (Sprints 1–42).
- **Numbered sprints remaining:** **15** (Sprints 43–57).
- **Operational / correction / wiring sprints delivered alongside (not in the 57 count):** **19** — 12A, 12B, 12C, 12D, 12E, 12F, 12G, 12H, 12J, 12K, 12L, 12M, 12N, 12P, 12Q, 18A, 19A, 19B, 20A.
- **Most recent two completed bundles:** 12F / 17 / 18 / 19 / 12G (summary `2821511`) and 12H / 18A / 19A / 20 / 12J (summary `b7af17f`). See `reports/ITERLAW_NEXT_5_SPRINT_BUNDLE_12F_17_18_19_12G_SUMMARY.md` and `reports/ITERLAW_NEXT_5_SPRINT_BUNDLE_12H_18A_19A_20_12J_SUMMARY.md`.
- **Production-readiness gates:** 17 total; **12 PASS**; 5 not PASS (G09 / G10 / G11 NOT_VERIFIED, G12 PARTIAL, G13 NOT_VERIFIED). Verifier: `node scripts/verify-production-readiness-gate.mjs` (exits 1 today).
- **Legacy sprint-count line (kept for archive):** as of 2026-05-13 morning the project recorded "Completed: 15, Remaining: 42, Current: Sprint 16 planned start". The two bundles above completed Sprints 16, 17, 18, 19, 20.
- **Next 10-sprint bundle:** 12K / 20A / 19B / 21 / 12L / 22 / 23 / 24 / 25 / 26 — planned in [`docs/iterlaw/project/07-sprints/NEXT_10_SPRINT_BUNDLE_AFTER_12H_PLAN.md`](docs/iterlaw/project/07-sprints/NEXT_10_SPRINT_BUNDLE_AFTER_12H_PLAN.md). **Not yet executed.**
- **Sprint 10:** **PASS** — Docker staging verification passed.
- **Sprint 11:** **PASS** — Phase 1 + Phase 2A + hardening + Phase 2B + Phase 4. Full suite 58 files / 763 tests PASS.
- **Sprint 12:** **PASS FOR DRY-RUN FOUNDATION ONLY** — Track B operator-side backup + restore-verify scripts, manifest + sha256 + isolated-target validators, runbook, 39 new tests; full suite **59 files / 802 tests PASS**. Live backup + live restore **NOT EXECUTED**.
- **Sprint 13:** **PASS FOR OPERATOR-WORKSTATION READINESS ONLY** — `--check` toolchain probes for both backup scripts, operator toolchain doc (Windows/Linux/macOS), first-live-backup authorisation checklist (default NO), 25 new tests; full suite **61 files / 827 tests PASS**. First live backup remains **NOT AUTHORISED**; live restore remains **NOT AUTHORISED**.
- **Sprint 14:** **PASS FOR INTELLIGENCE FOUNDATION / CODE-PREPARED ONLY** — 11 pure-function intelligence modules + 7 test files (54 tests) + 6 architecture docs (commits `5470757`, `427e8ff`, `b53fa9a`). Not wired into the answer path by this sprint.
- **Sprint 15:** **PASS FOR FEATURE-FLAGGED LOCAL WIRING ONLY** — feature flag config + shadow-mode wiring of `runIntelligenceGateway` in `handleLegalRequest` (intentional PARTIAL ACTIVE wiring; gateway result discarded) + `/ready` additive field + 26 new tests; full suite **72 files / 907 tests PASS** at Sprint 15 close; **73 files / 912 tests PASS** after Sprint 12A reconciliation. Intelligence Layer disabled by default.
- **Production:** **BLOCKED.**
- **Dependency security (`npm audit --omit=dev`):** **PARTIAL** — **2** production advisories (Next.js + PostCSS) remain until a planned major Next upgrade; see `reports/ITERLAW_POST_CURSOR_AUDIT_RECONCILIATION.md`.

### Sprint 10 PASS scope (narrow on purpose)

- Docker staging only.
- Local `pgvector/pgvector:pg16` container (`iterlaw-staging-postgres` on `localhost:5433`, stopped + removed at script teardown).
- No production DB touched.
- No deployment performed.
- Production remains **blocked** until the later production gates pass (operator-managed staging promotion, security review, backup drill, ingress TLS, pod-security baseline verifier, operator sign-off).

### Per-sprint detail

- **Sprints 1–9:** DONE.
- **Sprint 10 — Live RAG DB wiring:** **PASS** (Docker staging scope).
  - Code-side migration verification: **PASS** (commits `21364f4`, `c17ffc2`).
  - Real Docker staging DB replay: **PASS** (2026-05-13 via `scripts/operator/sprint10-docker-staging-replay.ps1`; report `reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`).
  - Scope: local Docker container only. **Not** AKS staging, **not** production.
- **Sprint 11 — Local LLM gateway + cited RAG answer path:** **PASS**. Phase 1 + Phase 2A + hardening tests + Phase 2B (live local HTTP transport, commit `3681fab`) + Phase 4 (pipeline wiring of `runLocalDraftingStep` into `handleLegalRequest`, commit `120b9de`). Full suite **58 files / 763 tests PASS**. Closeout QA report: [`docs/iterlaw/project/11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md`](docs/iterlaw/project/11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md). ADR: [`docs/iterlaw/project/11-ai-governance/ADR_SPRINT_11_LOCAL_LLM_TRANSPORT_AND_PIPELINE_WIRING.md`](docs/iterlaw/project/11-ai-governance/ADR_SPRINT_11_LOCAL_LLM_TRANSPORT_AND_PIPELINE_WIRING.md).
- **Sprint 12 — Backup go-live (Track B operator-workstation foundation):** **PASS FOR DRY-RUN FOUNDATION ONLY**. ADR `a750f88`, backup script `dad1906`, restore-verify script `7683936`, 39 tests `4be05a6`, runbook `fdafca3`. Manifest + sha256 + production-host refusal + isolated-target refusal verified end-to-end in dry-run. Full suite **59 files / 802 tests PASS**. Live backup + live isolated restore **NOT EXECUTED** (deferred to operator decision). Closeout QA report: [`docs/iterlaw/project/12-backup-go-live/SPRINT_12_BACKUP_GO_LIVE_QA_REPORT.md`](docs/iterlaw/project/12-backup-go-live/SPRINT_12_BACKUP_GO_LIVE_QA_REPORT.md). ADR: [`docs/iterlaw/project/12-backup-go-live/ADR_SPRINT_12_BACKUP_AND_RECOVERY_POLICY.md`](docs/iterlaw/project/12-backup-go-live/ADR_SPRINT_12_BACKUP_AND_RECOVERY_POLICY.md). Runbook: [`docs/iterlaw/project/12-backup-go-live/SPRINT_12_BACKUP_RESTORE_RUNBOOK.md`](docs/iterlaw/project/12-backup-go-live/SPRINT_12_BACKUP_RESTORE_RUNBOOK.md). Track A (cluster-side Borg path) **unchanged** in this sprint.
- **Sprints 13–57:** **PLANNED only.** Roadmap table further down.
- **Production:** **BLOCKED.**
- **External LLM in live answer path:** **FORBIDDEN** (transport policy denies provider hostnames at runtime).
- **Offline-first legal DB model:** **ACCEPTED** ([`docs/iterlaw/project/10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](docs/iterlaw/project/10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md)).

Canonical status file: [`docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md`](docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md). Pointer copy: [`ITERLAW_PROJECT_STATUS.md`](ITERLAW_PROJECT_STATUS.md) and [`docs/iterlaw/ITERLAW_PROJECT_STATUS.md`](docs/iterlaw/ITERLAW_PROJECT_STATUS.md).

---

## Sprint roadmap

### Completed (1–9)

DONE — see [`docs/iterlaw/ITERLAW_SPRINT_ROADMAP.md`](docs/iterlaw/ITERLAW_SPRINT_ROADMAP.md) Completed table for per-sprint detail.

### In progress

- **10** Live RAG DB wiring — **PASS** (Docker staging scope; report `reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`).
- **11** Local LLM gateway + bounded synthesis — **PASS** (Phase 1 + Phase 2A + hardening + Phase 2B + Phase 4; commits `3681fab` + `120b9de` + `00f03f9`).
- **12** Backup go-live — **PASS FOR DRY-RUN FOUNDATION ONLY** (Track B operator-side scripts + 39 tests; live backup + live restore NOT EXECUTED; commits `a750f88` → `fdafca3`).
- **13** Backup MVP polish + operator readiness — **PASS FOR OPERATOR-WORKSTATION READINESS ONLY** (`--check` toolchain probes, operator doc, first-live-backup authorisation checklist with default NO, 25 new tests; commits `45a10e3` → `f72ae26`).
- **14** Intelligence Layer foundation — **PASS FOR INTELLIGENCE FOUNDATION / CODE-PREPARED ONLY** (11 pure-function modules, 7 test files, 6 architecture docs; commits `5470757`, `427e8ff`, `b53fa9a`).
- **15** Intelligence Layer feature-flagged wiring — **PASS FOR FEATURE-FLAGGED LOCAL WIRING ONLY** (feature flag config, shadow-mode wiring with intentional PARTIAL ACTIVE wiring, `/ready` additive field, 26 new tests; commits Sprint 15 sequence).

### Planned (16–17)
- **14** Member / auth / subscription foundation — **PLANNED**.
- **15** Admin / legal-review UI — **PLANNED**.
- **16** Live evolution + safe optimisation — **PLANNED** ([`docs/iterlaw/SPRINT_16_LIVE_EVOLUTION_AND_SAFE_OPTIMISATION_PLAN.md`](docs/iterlaw/SPRINT_16_LIVE_EVOLUTION_AND_SAFE_OPTIMISATION_PLAN.md)).
- **17** UK GDPR / DPA 2018 / Data (Use and Access) Act 2025 retention + consent — **PLANNED**.

### Planned (18–25 — Law Module Engine)

- **18** Law Module Engine Foundation — **PLANNED**.
- **19** Multi-Tier Legal Retrieval Engine — **PLANNED**.
- **20** Background Legal Intelligence Builder — **PLANNED**.
- **21** Law Section Intelligence System — **PLANNED**.
- **22** Country Expansion Engine — **PLANNED**.
- **23** Module-Specific AI Isolation — **PLANNED**.
- **24** Pre-Built Legal Knowledge Seeding — **PLANNED**.
- **25** Persistent Legal Memory Engine — **PLANNED**.

### Planned (26–34 — Speed-first retrieval infrastructure)

- **26** Speed-First Retrieval Infrastructure (HNSW + cache) — **PLANNED**.
- **27** Ollama Runtime Speed Layer (keep_alive, prefix reuse, flash attention) — **PLANNED**.
- **28** Structured Fill-in-the-Blank Answering — **PLANNED**.
- **29** Retrieval-Augmented Verification — **PLANNED**.
- **30** Speculative Prefill UI — **PLANNED**.
- **31** Two-Stage Local Model Cascade — **PLANNED**.
- **32** Deterministic Legal Knowledge Graph — **PLANNED**.
- **33** ChatGPT-Style Streaming UX (SSE, openers, 3-part reveal) — **PLANNED**.
- **34** Graceful Failure + Escalation — **PLANNED**.

### Planned (35–45 — WASM intelligence stack)

- **35** IterLaw WASM Runtime Foundation — **PLANNED**.
- **36** WASM Gateway + Security Layer (gatekeeper / pii_guard / rate_limit) — **PLANNED**.
- **37** WASM Cache + Retrieval Engine (cache_lookup / retrieval_router) — **PLANNED**.
- **38** WASM Intent + Complexity Classifier — **PLANNED**.
- **39** WASM Legal Source Federation — **PLANNED**.
- **40** WASM LLM Routing Layer — **PLANNED**.
- **41** WASM External AI Federation (interface only — no provider call) — **PLANNED**.
- **42** WASM Synthesis + Validation Engine — **PLANNED**.
- **43** Streaming Legal Adviser Experience (WASM streamer) — **PLANNED**.
- **44** WASM Observability + Cost Intelligence — **PLANNED**.
- **45** WASM Production Hardening — **PLANNED**.

### Planned (46–51 — Workspace, RLS, Supreme Controller, approval)

- **46** User Workspace and Subscription Foundation — **PLANNED**.
- **47** PostgreSQL RLS User Isolation — **PLANNED**.
- **48** Case Management Engine — **PLANNED**.
- **49** Supreme Controller Foundation — **PLANNED**.
- **50** Human Approval Queue — **PLANNED**.
- **51** Quality and Self-Monitoring Agents — **PLANNED**.

### Planned (52–57 — Document intelligence stack)

- **52** Document Intelligence Foundation — **PLANNED**.
- **53** Cited Legal Document Model — **PLANNED**.
- **54** DOCX and PDF Rendering — **PLANNED**.
- **55** XLSX Legal Calculators — **PLANNED**.
- **56** Document Approval and Solicitor Review — **PLANNED**.
- **57** Full Workspace UX — **PLANNED**.

> Implementation status across Sprints 12–57: **PLANNED only.** No claim of completion is made for any sprint in this range. Sprint 10 closeout and Sprint 11 implementation precede Sprint 12+ work. Sprints 18+ are target architecture; first IterLaw beta (UK Employment) ships before Sprint 18 opens.

---

## Architecture anchor documents

| Topic | Doc |
| --- | --- |
| Documentation index | [`docs/iterlaw/project/README.md`](docs/iterlaw/project/README.md) |
| AI agent start-here | [`docs/iterlaw/project/00-index/AI_TOOL_START_HERE.md`](docs/iterlaw/project/00-index/AI_TOOL_START_HERE.md) |
| Architecture summary | [`docs/iterlaw/project/01-architecture/ARCHITECTURE_SUMMARY.md`](docs/iterlaw/project/01-architecture/ARCHITECTURE_SUMMARY.md) |
| Platform scope | [`docs/iterlaw/project/01-architecture/LEGAL_AI_CORE_PLATFORM_SCOPE.md`](docs/iterlaw/project/01-architecture/LEGAL_AI_CORE_PLATFORM_SCOPE.md) |
| Offline-first legal DB | [`docs/iterlaw/project/01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md`](docs/iterlaw/project/01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md) |
| Law module engine | [`docs/iterlaw/project/01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md`](docs/iterlaw/project/01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md) |
| Multi-tier retrieval (Tier 0–5 + background) | [`docs/iterlaw/project/03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md`](docs/iterlaw/project/03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md) |
| Speed + streaming roadmap | [`docs/iterlaw/project/04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md`](docs/iterlaw/project/04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md) |
| WASM intelligence | [`docs/iterlaw/project/01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md`](docs/iterlaw/project/01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md) |
| Workspace + RLS + cases | [`docs/iterlaw/project/01-architecture/WORKSPACE_AND_USER_DATA_ARCHITECTURE.md`](docs/iterlaw/project/01-architecture/WORKSPACE_AND_USER_DATA_ARCHITECTURE.md) |
| Supreme Controller | [`docs/iterlaw/project/01-architecture/SUPREME_CONTROLLER_ARCHITECTURE.md`](docs/iterlaw/project/01-architecture/SUPREME_CONTROLLER_ARCHITECTURE.md) |
| Document intelligence | [`docs/iterlaw/project/01-architecture/DOCUMENT_INTELLIGENCE_ARCHITECTURE.md`](docs/iterlaw/project/01-architecture/DOCUMENT_INTELLIGENCE_ARCHITECTURE.md) |
| Sprint index | [`docs/iterlaw/project/07-sprints/SPRINT_INDEX.md`](docs/iterlaw/project/07-sprints/SPRINT_INDEX.md) |
| Remaining-sprint roadmap | [`docs/iterlaw/project/07-sprints/ROADMAP_REMAINING_SPRINTS.md`](docs/iterlaw/project/07-sprints/ROADMAP_REMAINING_SPRINTS.md) |
| Sprint 10 staging runbook | [`docs/iterlaw/project/07-sprints/SPRINT_10_STAGING_DB_OPERATOR_RUNBOOK.md`](docs/iterlaw/project/07-sprints/SPRINT_10_STAGING_DB_OPERATOR_RUNBOOK.md) |
| Operations rules | [`docs/iterlaw/project/09-operations/OPERATIONS_RULES.md`](docs/iterlaw/project/09-operations/OPERATIONS_RULES.md) |

---

## Hard rules

1. **Active product name is IterLaw.** Do not use `RightsNow` in active code, config, or docs.
2. **No production deploy** without staging verification first.
3. **No legal answer without verified citations.** The orchestrator returns `insufficient_sources` / `needs_more_facts` / `citation_failed` before any model output.
4. **No external LLM call** in the orchestrator answer path. Local LLM only, behind the gateway, behind retrieval + citation gates.
5. **No `:latest` image tag** in any active deployable manifest.
6. **No `kubectl apply` / `helm install` / `git push`** by any agent without explicit operator instruction in the same message.
7. **No real secrets** committed to the repo.
8. **No cross-country / cross-module retrieval** in the answer path.
9. **No access to an unsubscribed module** (when subscription gating ships).

## Truth statement

> No push performed.
> No deployment performed.
> No kubectl mutating command performed.
> No production DB touched.
> No external LLM calls performed.
> No secret values printed.
