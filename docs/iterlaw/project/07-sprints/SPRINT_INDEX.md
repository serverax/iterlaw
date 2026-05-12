# Sprint Index

Authoritative pointer to sprint status. Full long-form roadmap: `docs/iterlaw/ITERLAW_SPRINT_ROADMAP.md`.

## Current state

| Sprint | Title | Status | Evidence |
| --- | --- | --- | --- |
| 1–8 | Foundation (repo + orchestrator + safety gates + WASM rule-runner + module pipeline + RAG DB foundation + ingestion framework + readiness/retrieval injection) | **DONE** | Commits + tests + verifiers. |
| 9 | Rename cleanup + backup safety baseline | **DONE** | `@rightsnow/*` → `@iterlaw/*`; LF policy; backup uploader + sealed-secret workflow; `legal_cases` (102). |
| 10 | Live RAG retrieval + corpus ingestion + DB user-workspace + RLS | **PARTIAL** — repo implementation **PASS** (typecheck/build/vitest 615 / 51 green); **local Docker DB migration-chain verification PASS** (2026-05-12, `pgvector/pgvector:pg16`, full forward chain applied; see report); real **staging DB verification PENDING** (operator action — needs confirmed non-production staging context; AKS verification blocked until a non-prod kubeconfig exists); production **BLOCKED** | See [`SPRINT_10_DB_DECISIONS.md`](SPRINT_10_DB_DECISIONS.md) + [`../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`](../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md) + `reports/ITERLAW_QA_REPORT_SPRINT_10_DB_IMPLEMENTATION.md` + `reports/ITERLAW_SPRINT_10_LOCAL_DOCKER_DB_VERIFY.md` |
| 11 | Local LLM gateway + model routing + bounded synthesis | **PARTIAL** — code-side foundation **PASS** (router + citation-bound prompt + output guard + disabled-by-default integration helper landed in `apps/legal-orchestrator/src/legal/llm/`; 32 new tests; total 647 / 52 PASS); live gateway **DISABLED / MOCK-SAFE** (no transport wired; pipeline unchanged); real deployment **BLOCKED** until Sprint 10 real staging DB verification passes; production **BLOCKED**. | See [`SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md`](SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md) + [`SPRINT_11_IMPLEMENTATION_CHECKLIST.md`](SPRINT_11_IMPLEMENTATION_CHECKLIST.md) + `docs/iterlaw/SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md` (long-form) + `docs/benchmarks/SPRINT_11_LOCAL_LLM_BENCHMARK_EXECUTION_CHECKLIST.md` + `reports/ITERLAW_QA_REPORT_SPRINT_11_LOCAL_LLM_GATEWAY.md` |
| 12 | Backup go-live | Planned | Build + push uploader image, pin digest, pin Storage Box CIDR, seal real Borg secret, first restore drill. |
| 13 | MVP polish + smoke test | Planned | Web UI, end-to-end cited answer against seeded corpus. |
| 14 | Member / auth / subscription foundation | Planned | Local-first auth path; tiered rate limits. |
| 15 | Admin / legal-review UI | Planned | Human-in-the-loop review pipeline. |
| 16 | Live evolution + safe optimisation | Planned | `docs/iterlaw/SPRINT_16_LIVE_EVOLUTION_AND_SAFE_OPTIMISATION_PLAN.md`. **HITL approval required for every prompt / rule change.** |
| 17 | UK GDPR / DPA 2018 / Data (Use and Access) Act 2025 retention + consent | Planned | Retention enforcement job; consent ledger. |
| 18 | Multimodal evidence grounding beta | Planned (future backlog) | `docs/iterlaw/SPRINT_18_MULTIMODAL_EVIDENCE_GROUNDING_BETA_PLAN.md`. DPIA-gated; local-only; pilot capped at 5 users. |
| 19 | Production hardening + public launch | Planned | Load test, SLO, on-call rota, ingress TLS plan complete. |

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
