# Sprint Index

Authoritative pointer to sprint status. Full long-form roadmap: `docs/iterlaw/ITERLAW_SPRINT_ROADMAP.md`. Project status: [`../ITERLAW_PROJECT_STATUS.md`](../ITERLAW_PROJECT_STATUS.md).

## Current verified gate state

- Sprint 10 code-side migration verification: **PASS**.
- Sprint 10 real Docker staging DB replay: **PASS** (2026-05-13, container `iterlaw-staging-postgres` from `pgvector/pgvector:pg16`; see `reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`). **Not** AKS staging, **not** production, **not** the live operator staging DB.
- Sprint 10 overall: **PASS** (Docker staging scope). The non-Docker staging targets remain a separate operator decision.
- Sprint 11: **UNBLOCKED / READY TO START** — Phase 1 + Phase 2A mock-safe foundation already landed (commits `b896764`, `b14fd2d`); Phase 2B (live HTTP transport) + Phase 4 (pipeline wiring) **NOT STARTED**; no implementation is claimed complete by this update.
- Production: **BLOCKED**.

### Sprint 10 migration replay blockers fixed and replayed

- Migration 100 compatibility shim landed in commit `21364f4`.
- Migration 102 compatibility shim landed in commit `c17ffc2`.
- Static / code verification: typecheck PASS, build PASS, vitest **55 files / 708 tests PASS**.
- Real Docker staging DB replay executed by `scripts/operator/sprint10-docker-staging-replay.ps1` on 2026-05-13: all migrations applied, extensions verified, key tables present, RLS enabled where expected, policies present, smoke counts captured, orchestrator `/ready` returned `rag.configured=true`, `rag.mode=postgres`, `rag.database=configured`, `legal_safety.citation_required=true`, `legal_safety.zero_citation_answer_blocked=true`. No DSN / password leaked in `/ready` or in any committed artefact.
- QA evidence: `reports/ITERLAW_QA_REPORT_SPRINT_10_MIGRATION_102_COMPATIBILITY_FIX.md` + `reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`.

## Sprint count

- **Total roadmap:** **57 sprints**.
- **Completed:** **10** (Sprints 1–10).
- **Current:** **Sprint 11**.
- **Remaining:** **47**.
- **Remaining range:** **Sprint 11 → Sprint 57.**
- Sprint 10: **PASS** — Docker staging verification passed (`reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`).
- Sprint 11: **READY TO START / UNBLOCKED.**
- Sprints 12–57: **PLANNED.**
- Production: **BLOCKED.**

## Sprint 11 — Local LLM Gateway + Cited RAG Answer Path

**Status:** **READY TO START / UNBLOCKED.** Sprint 10 PASS gate cleared on 2026-05-13.

**Purpose:**

- Build the local LLM gateway safely with injected transport only, no external provider calls.
- Wire the cited RAG answer path (Postgres mode when `DATABASE_URL` is configured; mock when not).
- Run deterministic legal gates (PII → risk → deadline → citation → policy → rule checks) before any LLM call; LLM cannot override any gate.
- Emit a redacted audit envelope per request (no DSN / no raw prompt / no full answer body).
- Standardise the API response envelope across all eight refusal / `ok` statuses.

Sprint 11 task contract: [`./SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md`](./SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md).
Earlier planning docs (foundation phase): [`./SPRINT_11_LOCAL_LLM_GATEWAY_AND_TRANSPORT_POLICY.md`](./SPRINT_11_LOCAL_LLM_GATEWAY_AND_TRANSPORT_POLICY.md) + [`./SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md`](./SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md) + [`./SPRINT_11_IMPLEMENTATION_CHECKLIST.md`](./SPRINT_11_IMPLEMENTATION_CHECKLIST.md).

Governance: every Sprint 11 model / prompt / routing / transport-policy change is reviewed under [`../11-ai-governance/SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md`](../11-ai-governance/SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md).


## Current state

| Sprint | Title | Status | Evidence |
| --- | --- | --- | --- |
| 1–8 | Foundation (repo + orchestrator + safety gates + WASM rule-runner + module pipeline + RAG DB foundation + ingestion framework + readiness/retrieval injection) | **DONE** | Commits + tests + verifiers. |
| 9 | Rename cleanup + backup safety baseline | **DONE** | `@rightsnow/*` → `@iterlaw/*`; LF policy; backup uploader + sealed-secret workflow; `legal_cases` (102). |
| 10 | Live RAG retrieval + corpus ingestion + DB user-workspace + RLS | **PARTIAL** — repo implementation **PASS** (typecheck/build/vitest 615 / 51 green); **local Docker DB migration-chain verification PASS** (2026-05-12, `pgvector/pgvector:pg16`, full forward chain applied; see report); real **staging DB verification PENDING** (operator action — needs confirmed non-production staging context; AKS verification blocked until a non-prod kubeconfig exists); production **BLOCKED** | See [`SPRINT_10_DB_DECISIONS.md`](SPRINT_10_DB_DECISIONS.md) + [`../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`](../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md) + `reports/ITERLAW_QA_REPORT_SPRINT_10_DB_IMPLEMENTATION.md` + `reports/ITERLAW_SPRINT_10_LOCAL_DOCKER_DB_VERIFY.md` |
| 11 | Local LLM gateway + model routing + bounded synthesis | **PARTIAL** — Phase 1 foundation **PASS** (router + citation-bound prompt + output guard + disabled-by-default drafting helper); Phase 2A audit + transport guardrails **PASS** (audit types + redactor + Noop/InMemory sinks + transport policy auto-allowing loopback / cluster-DNS, blocking public providers; 42 new tests; total 689 / 53 PASS); live HTTP transport **NOT STARTED**; pipeline wiring **NOT STARTED** (`runLocalDraftingStep` still not called from `handleLegalRequest`); live gateway **DISABLED / MOCK-SAFE**; real deployment **BLOCKED** until Sprint 10 real staging DB verification passes; production **BLOCKED**. | See [`SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md`](SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md) + [`SPRINT_11_IMPLEMENTATION_CHECKLIST.md`](SPRINT_11_IMPLEMENTATION_CHECKLIST.md) + `docs/iterlaw/SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md` (long-form) + `docs/benchmarks/SPRINT_11_LOCAL_LLM_BENCHMARK_EXECUTION_CHECKLIST.md` + `reports/ITERLAW_QA_REPORT_SPRINT_11_LOCAL_LLM_GATEWAY.md` (§12 Phase 2A) |
| 12 | Backup go-live | Planned | Build + push uploader image, pin digest, pin Storage Box CIDR, seal real Borg secret, first restore drill. |
| 13 | MVP polish + smoke test | Planned | Web UI, end-to-end cited answer against seeded corpus. |
| 14 | Member / auth / subscription foundation | Planned | Local-first auth path; tiered rate limits. |
| 15 | Admin / legal-review UI | Planned | Human-in-the-loop review pipeline. |
| 16 | Live evolution + safe optimisation | Planned | `docs/iterlaw/SPRINT_16_LIVE_EVOLUTION_AND_SAFE_OPTIMISATION_PLAN.md`. **HITL approval required for every prompt / rule change.** |
| 17 | UK GDPR / DPA 2018 / Data (Use and Access) Act 2025 retention + consent | Planned | Retention enforcement job; consent ledger. |
| 18 | Multimodal evidence grounding beta *(legacy entry; superseded by the post-core roadmap below)* | Planned (future backlog) | `docs/iterlaw/SPRINT_18_MULTIMODAL_EVIDENCE_GROUNDING_BETA_PLAN.md`. DPIA-gated; local-only; pilot capped at 5 users. |
| 19 | Production hardening + public launch | Planned | Load test, SLO, on-call rota, ingress TLS plan complete. |

## Post-core roadmap (Sprints 18–57 — target architecture)

The full multi-country / multi-domain platform roadmap is in [`ROADMAP_REMAINING_SPRINTS.md`](ROADMAP_REMAINING_SPRINTS.md). It covers the Law Module Engine (18–25), speed-first retrieval (26–34), the WASM intelligence stack (35–45), workspace + RLS + Supreme Controller + approval queue (46–51), and the document intelligence stack (52–57).

These are roadmap entries, not committed delivery. They land **after** first IterLaw beta (UK Employment) is shipped. The legacy Sprint 18 / 19 entries above remain valid until they are folded into the new numbering during a future planning sprint.

### Sprints 26–57 status (PLANNED only — addendum 2026-05-13)

Every sprint numbered 26 through 57 is **PLANNED**. None is implemented. None is claimed complete. This addendum re-affirms the PLANNED designation for the full Sprint 26–57 range and is the canonical statement used by the top-level [`../../ITERLAW_SPRINT_ROADMAP.md`](../../ITERLAW_SPRINT_ROADMAP.md) addendum and by [`../../../PROJECT.md`](../../../PROJECT.md).

- **26–34** Speed-first retrieval infrastructure (HNSW + cache, Ollama runtime layer, structured fill-in-the-blank, retrieval-augmented verification, speculative prefill, two-stage cascade, knowledge graph, SSE streaming, graceful failure) — all **PLANNED**.
- **35–45** WASM intelligence stack (runtime foundation, gateway/security, cache/retrieval router, classifier, source federation, LLM routing, external-AI federation interface, synthesis/validation, streaming experience, observability/cost, production hardening) — all **PLANNED**.
- **46–51** Workspace, RLS, Supreme Controller, approval (subscription foundation, RLS isolation, case management, controller foundation, approval queue, quality/self-monitoring agents) — all **PLANNED**.
- **52–57** Document intelligence stack (foundation, cited document model, DOCX/PDF, XLSX calculators, approval / solicitor review, full workspace UX) — all **PLANNED**.

## Offline-first legal DB model — mandatory roadmap constraint

The offline-first legal DB model is now a locked architectural decision — see [`../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md) and [`../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md`](../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md).

- **Offline-first is mandatory**, not optional. Every future-sprint deliverable that touches the answer path must serve from the local DB / cache / section registry / knowledge graph before considering the LLM.
- **Each country engine requires its own offline legal DB** before that country can launch. No country goes live without its DB built + human-reviewed seed rows.
- **LLM fallback / background builder is a later layer**, not the first answer path. Sprint 27+ optimisations are applied **after** the offline-first tier infrastructure is in place.
- **Sprints 18–25** must be aligned to this offline-first DB model — Law Module Engine, section registry, Q&A cache, generation queue, country expansion engine, module-specific AI isolation, knowledge seeding, persistent legal memory.
- **Sprints 26–34** optimise speed / streaming **on top of** the offline-first model — HNSW, keep-alive, structured fill-in-the-blank, RAV, speculative prefill, two-stage cascade, knowledge graph, SSE, graceful failure.
- **Sprints 35–45** apply WASM to the offline-first engine — gateway, cache, retrieval router, classifier, legal sources, LLM routing, synthesis, streaming, observability, hardening.

No future sprint is marked complete by this docs update.

## Sprint 10 close-out — what's pending

Operator-side action required (no agent will perform these). Authoritative procedure: [`../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`](../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md).

Summary:

1. Apply migrations `104` / `105` / `106` on a confirmed **dev / staging** DB (after the existing `000 → 010, 101, 102` chain). Production-host refusal guard in checklist §0 + §2.
2. Run the 5 SQL verification queries (checklist §3–§7): tables exist, indexes exist, RLS policies exist, `relrowsecurity = t` on user-data tables, `relrowsecurity = f` on corpus.
3. Run the 5 RLS test cases (checklist §8 C.1–C.5): user-A-vs-B isolation, fail-closed, solicitor scoping, admin override, child-table inheritance.
4. Run `bash scripts/infra/verify-iterlaw-rag-db.sh` with `DATABASE_URL` set; expect previously `NOT EXECUTED` live-DB checks to flip to `PASS`.
5. Capture the sign-off block (checklist §12) into `reports/ITERLAW_SPRINT_10_STAGING_APPLY_<YYYY-MM-DD>.log`.
6. On all-PASS, update this index + `SPRINT_10_DB_DECISIONS.md` per checklist §13.

## How to find the latest QA report

`reports/ITERLAW_QA_REPORT_SPRINT_10_DB_IMPLEMENTATION.md` is the latest Sprint 10 evidence artefact at the time of writing. Always check `reports/` for newer reports before claiming a status.

## How to declare a sprint DONE

A sprint is DONE only when:

- All in-scope tests pass (with command output recorded).
- Verifiers pass (with command output recorded).
- The relevant operator action (apply / pin / seal / drill / launch) has been performed and evidenced.
- The status in this index is updated.
- The sprint's plan file in `docs/iterlaw/SPRINT_*_PLAN.md` carries a "DONE" header.

No agent declares DONE without all four. See [`../08-qa/QA_PROCESS.md`](../08-qa/QA_PROCESS.md).
