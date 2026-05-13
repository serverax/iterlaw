# IterLaw — Project Overview

**IterLaw** is the legal AI product. First beta: **UK Employment Law**. Future expansion supports multiple countries and legal domains (Employment, Immigration, Housing, Benefits, Family, Debt, Consumer, Business, Tax).

Last updated: 2026-05-13.

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

### Sprint progress

- **Total roadmap:** 57 sprints.
- **Completed:** 10.
- **Current sprint:** Sprint 11.
- **Remaining:** 47.
- **Remaining range:** Sprint 11 → Sprint 57.
- **Sprint 10:** **PASS** — Docker staging verification passed.
- **Sprint 11:** **PARTIAL** — hardening tests landed; Phase 2B + Phase 4 out of scope.
- **Production:** **BLOCKED.**

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
- **Sprint 11 — Local LLM gateway + cited RAG answer path:** **PARTIAL**. Phase 1 + Phase 2A mock-safe foundation **PASS**; Sprint 11 hardening tests **PASS** (commit `c102f51`, 25 new tests, total 56 files / 733 tests; see `reports/ITERLAW_SPRINT_11_LOCAL_LLM_RAG_GATEWAY_QA_2026-05-13.md`). Phase 2B (live HTTP transport) and Phase 4 (pipeline wiring) **NOT STARTED** and out of scope. Plan: [`docs/iterlaw/project/07-sprints/SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md`](docs/iterlaw/project/07-sprints/SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md).
- **Sprints 12–57:** **PLANNED only.** Roadmap table further down.
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
- **11** Local LLM gateway + bounded synthesis — **UNBLOCKED / READY TO START**. Phase 1 + Phase 2A mock-safe foundation landed; Phase 2B + Phase 4 NOT STARTED.

### Planned (12–17)

- **12** Backup go-live — **PLANNED**.
- **13** MVP polish + smoke test — **PLANNED**.
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
