# IterLaw Project Status

Last updated: 2026-05-13.

This file mirrors the canonical project status. The single source of truth lives at [`project/ITERLAW_PROJECT_STATUS.md`](project/ITERLAW_PROJECT_STATUS.md); a thin pointer also sits at the repo root `ITERLAW_PROJECT_STATUS.md`. This copy exists so that the path `docs/iterlaw/ITERLAW_PROJECT_STATUS.md` is reachable for tools and docs that link to it.

---

## Current verified gate state

- Sprint 10 code-side migration verification: **PASS**.
- Sprint 10 real Docker staging DB replay: **PASS** (2026-05-13 via [`scripts/operator/sprint10-docker-staging-replay.ps1`](../../scripts/operator/sprint10-docker-staging-replay.ps1); container `iterlaw-staging-postgres` from `pgvector/pgvector:pg16`; report `reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`). Docker scope only — **not** AKS, **not** production.
- Sprint 10 overall: **PASS**.
- Sprint 11: **PASS** — Phase 1 + Phase 2A + hardening + Phase 2B (commit `3681fab`) + Phase 4 (commit `120b9de`). Full suite **58 files / 763 tests PASS**. Closeout QA report: [`project/11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md`](project/11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md).
- Sprint 12: **PASS FOR DRY-RUN FOUNDATION ONLY** — Track B operator-side backup + restore-verify scripts, manifest + sha256 + isolated-target validation, 39 new tests (commits `a750f88` → `fdafca3`). Full suite **59 files / 802 tests PASS**. Live backup + live restore **NOT EXECUTED**. Closeout QA report: [`project/12-backup-go-live/SPRINT_12_BACKUP_GO_LIVE_QA_REPORT.md`](project/12-backup-go-live/SPRINT_12_BACKUP_GO_LIVE_QA_REPORT.md).
- Sprint 13: **PASS FOR OPERATOR-WORKSTATION READINESS ONLY** — `--check` toolchain probes on both backup scripts, operator toolchain doc, first-live-backup authorisation checklist with default NO, 25 new tests. Full suite **61 files / 827 tests PASS**. First live backup + live restore **NOT AUTHORISED**. Closeout QA report: [`project/13-backup-mvp-polish/SPRINT_13_BACKUP_MVP_POLISH_QA_REPORT.md`](project/13-backup-mvp-polish/SPRINT_13_BACKUP_MVP_POLISH_QA_REPORT.md).
- Sprint 14: **PASS FOR INTELLIGENCE FOUNDATION / CODE-PREPARED ONLY** — 11 intelligence modules + 54 tests + 6 architecture docs (commits `5470757`, `427e8ff`, `b53fa9a`).
- Sprint 15: **PASS FOR FEATURE-FLAGGED LOCAL WIRING ONLY** — feature flag config + shadow-mode wiring + `/ready` additive field + 26 new tests; full suite **72 files / 907 tests PASS**. Intelligence Layer disabled by default; first live backup + live restore remain **NOT AUTHORISED**.
- Production: **BLOCKED**.

---

## Current delivery status

- **Completed:** Sprints 1–9.
- **Current:** Sprint 10 — staging DB verification / closeout.
- **External LLM in live answer path:** **FORBIDDEN**. The Sprint 11 transport policy denies provider hostnames at runtime; no provider SDK is present in `apps/legal-orchestrator/package.json`.
- **Offline-first legal DB model:** **ACCEPTED** ([`project/10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](project/10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md)).
- **Local LLM:** fallback / background builder only, **not** the default answer engine.
- **RAG:** local DB + pgvector + verified citations only. No external retrieval, no scraping in the answer path.
- **WASM:** control plane / safety / routing / validation layer, **not** the heavy LLM runtime.

---

## Sprint count

- **Total roadmap:** **57 sprints**.
- **Completed:** **15** (Sprints 1–11 PASS; Sprint 12 PASS-for-dry-run-foundation; Sprint 13 PASS-for-operator-workstation-readiness; Sprint 14 PASS-for-intelligence-foundation; Sprint 15 PASS-for-feature-flagged-local-wiring).
- **Current sprint:** **Sprint 16** (planned start).
- **Remaining:** **42**.
- **Remaining range:** **Sprint 16 → Sprint 57.**
- **Sprint 10:** **PASS** — Docker staging verification.
- **Sprint 11:** **PASS** — Phase 1 + Phase 2A + hardening + Phase 2B + Phase 4.
- **Sprint 12:** **PASS FOR DRY-RUN FOUNDATION ONLY** — Track B operator-side scripts; live not executed.
- **Sprint 13:** **PASS FOR OPERATOR-WORKSTATION READINESS ONLY** — `--check` probes + operator toolchain doc + first-live-backup authorisation checklist (default NO).
- **Sprint 14:** **PASS FOR INTELLIGENCE FOUNDATION / CODE-PREPARED ONLY** — 11 modules + 54 tests + 6 architecture docs; not wired.
- **Sprint 15:** **PASS FOR FEATURE-FLAGGED LOCAL WIRING ONLY** — flag default off; shadow-mode wiring; `/ready` additive field; 26 new tests.
- **Sprints 16–57:** **PLANNED.**
- **Production:** **BLOCKED.**

Roadmap detail: [`ITERLAW_SPRINT_ROADMAP.md`](ITERLAW_SPRINT_ROADMAP.md). Authoritative sprint table: [`project/07-sprints/SPRINT_INDEX.md`](project/07-sprints/SPRINT_INDEX.md). Sprint 11 task contract: [`project/07-sprints/SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md`](project/07-sprints/SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md). Remaining-sprint detail: [`project/07-sprints/ROADMAP_REMAINING_SPRINTS.md`](project/07-sprints/ROADMAP_REMAINING_SPRINTS.md).

---

## Sprint 26–57 — PLANNED only

The addendum below adds Sprints 26–57 to the roadmap. **Every sprint in this section is PLANNED. None are implemented. None are claimed complete.**

### Speed-first retrieval infrastructure (26–34)

| # | Title | Status |
| --- | --- | --- |
| 26 | Speed-First Retrieval Infrastructure (HNSW + cache) | **PLANNED** |
| 27 | Ollama Runtime Speed Layer (keep_alive, prefix reuse, flash attention) | **PLANNED** |
| 28 | Structured Fill-in-the-Blank Answering | **PLANNED** |
| 29 | Retrieval-Augmented Verification | **PLANNED** |
| 30 | Speculative Prefill UI | **PLANNED** |
| 31 | Two-Stage Local Model Cascade | **PLANNED** |
| 32 | Deterministic Legal Knowledge Graph | **PLANNED** |
| 33 | ChatGPT-Style Streaming UX (SSE, openers, 3-part reveal) | **PLANNED** |
| 34 | Graceful Failure + Escalation | **PLANNED** |

### WASM intelligence stack (35–45)

| # | Title | Status |
| --- | --- | --- |
| 35 | IterLaw WASM Runtime Foundation | **PLANNED** |
| 36 | WASM Gateway + Security Layer (gatekeeper / pii_guard / rate_limit) | **PLANNED** |
| 37 | WASM Cache + Retrieval Engine (cache_lookup / retrieval_router) | **PLANNED** |
| 38 | WASM Intent + Complexity Classifier | **PLANNED** |
| 39 | WASM Legal Source Federation | **PLANNED** |
| 40 | WASM LLM Routing Layer | **PLANNED** |
| 41 | WASM External AI Federation (interface only — no provider call) | **PLANNED** |
| 42 | WASM Synthesis + Validation Engine | **PLANNED** |
| 43 | Streaming Legal Adviser Experience (WASM streamer) | **PLANNED** |
| 44 | WASM Observability + Cost Intelligence | **PLANNED** |
| 45 | WASM Production Hardening | **PLANNED** |

### Workspace, RLS, Supreme Controller, approval (46–51)

| # | Title | Status |
| --- | --- | --- |
| 46 | User Workspace and Subscription Foundation | **PLANNED** |
| 47 | PostgreSQL RLS User Isolation | **PLANNED** |
| 48 | Case Management Engine | **PLANNED** |
| 49 | Supreme Controller Foundation | **PLANNED** |
| 50 | Human Approval Queue | **PLANNED** |
| 51 | Quality and Self-Monitoring Agents | **PLANNED** |

### Document intelligence stack (52–57)

| # | Title | Status |
| --- | --- | --- |
| 52 | Document Intelligence Foundation | **PLANNED** |
| 53 | Cited Legal Document Model | **PLANNED** |
| 54 | DOCX and PDF Rendering | **PLANNED** |
| 55 | XLSX Legal Calculators | **PLANNED** |
| 56 | Document Approval and Solicitor Review | **PLANNED** |
| 57 | Full Workspace UX | **PLANNED** |

---

## Naming + guardrails

- **Active product name:** IterLaw.
- **Forbidden in active material:** RightsNow (legacy product name; allowed only in clearly marked legacy / disabled / archive material — see [`project/00-index/CANONICAL_NAMES.md`](project/00-index/CANONICAL_NAMES.md)).
- **Canonical Kubernetes namespaces:** `iterlaw-ai`, `iterlaw-rag`, `iterlaw-api`, `iterlaw-monitoring`, `iterlaw-security`. **Forbidden:** `iterlaw-prod`, bare `iterlaw`.
- **No external LLM call** in the orchestrator request path.
- **No `:latest`** in any active deployable manifest.

---

## Truth statement

> No push performed.
> No deployment performed.
> No kubectl mutating command performed.
> No database touched.
> No production DB touched.
> No external LLM calls performed.
> No secret values printed.
> Sprints 12–57: **PLANNED only.** No implementation completion is claimed.
