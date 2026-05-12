# Sprint Index

Authoritative pointer to sprint status. Full long-form roadmap: `docs/iterlaw/ITERLAW_SPRINT_ROADMAP.md`. Project status: [`../ITERLAW_PROJECT_STATUS.md`](../ITERLAW_PROJECT_STATUS.md).

## Current verified gate state

- Sprint 10 code-side migration verification: **PASS**.
- Sprint 10 real staging DB verification: **PENDING** — operator runbook at [`SPRINT_10_STAGING_DB_OPERATOR_RUNBOOK.md`](SPRINT_10_STAGING_DB_OPERATOR_RUNBOOK.md).
- Sprint 10 overall: **PARTIAL**.
- Sprint 11: **BLOCKED**.
- Production: **BLOCKED**.

## Sprint count

- **Total roadmap target:** Sprint 45.
- **Completed:** 9.
- **Current pending:** Sprint 10.
- **Remaining including Sprint 10:** **36**.
- **Remaining after Sprint 10 passes:** **35**.

Sprint 46+ (Workspace + RLS + Supreme Controller + Approval + Document intelligence) is currently **post-Sprint-45 backlog** and is not counted in the 36 / 35 above.

## Sprint 11 — Local LLM Gateway and Transport Policy

**Status:** PLANNED / blocked by Sprint 10 staging DB closeout.

**Purpose:**

- Build the local LLM gateway safely.
- Keep the offline-first model mandatory.
- Keep external LLMs forbidden.
- Keep the LLM as fallback / background builder only.

Plan: [`./SPRINT_11_LOCAL_LLM_GATEWAY_AND_TRANSPORT_POLICY.md`](./SPRINT_11_LOCAL_LLM_GATEWAY_AND_TRANSPORT_POLICY.md).

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
