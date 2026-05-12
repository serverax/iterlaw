# Sprint Index

Authoritative pointer to sprint status. Full long-form roadmap: `docs/iterlaw/ITERLAW_SPRINT_ROADMAP.md`.

## Current state

| Sprint | Title | Status | Evidence |
| --- | --- | --- | --- |
| 1–8 | Foundation (repo + orchestrator + safety gates + WASM rule-runner + module pipeline + RAG DB foundation + ingestion framework + readiness/retrieval injection) | **DONE** | Commits + tests + verifiers. |
| 9 | Rename cleanup + backup safety baseline | **DONE** | `@rightsnow/*` → `@iterlaw/*`; LF policy; backup uploader + sealed-secret workflow; `legal_cases` (102). |
| 10 | Live RAG retrieval + corpus ingestion + DB user-workspace + RLS | **PARTIAL** — code-side DONE; staging-DB verification PENDING; production BLOCKED | See [`SPRINT_10_DB_DECISIONS.md`](SPRINT_10_DB_DECISIONS.md) + `reports/ITERLAW_QA_REPORT_SPRINT_10_DB_IMPLEMENTATION.md` |
| 11 | Local LLM gateway + bounded synthesis | **In Progress** — interface-only landed; benchmark pending | `docs/iterlaw/SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md` + `docs/benchmarks/SPRINT_11_LOCAL_LLM_BENCHMARK_EXECUTION_CHECKLIST.md` |
| 12 | Backup go-live | Planned | Build + push uploader image, pin digest, pin Storage Box CIDR, seal real Borg secret, first restore drill. |
| 13 | MVP polish + smoke test | Planned | Web UI, end-to-end cited answer against seeded corpus. |
| 14 | Member / auth / subscription foundation | Planned | Local-first auth path; tiered rate limits. |
| 15 | Admin / legal-review UI | Planned | Human-in-the-loop review pipeline. |
| 16 | Live evolution + safe optimisation | Planned | `docs/iterlaw/SPRINT_16_LIVE_EVOLUTION_AND_SAFE_OPTIMISATION_PLAN.md`. **HITL approval required for every prompt / rule change.** |
| 17 | UK GDPR / DPA 2018 / Data (Use and Access) Act 2025 retention + consent | Planned | Retention enforcement job; consent ledger. |
| 18 | Multimodal evidence grounding beta | Planned (future backlog) | `docs/iterlaw/SPRINT_18_MULTIMODAL_EVIDENCE_GROUNDING_BETA_PLAN.md`. DPIA-gated; local-only; pilot capped at 5 users. |
| 19 | Production hardening + public launch | Planned | Load test, SLO, on-call rota, ingress TLS plan complete. |

## Sprint 10 close-out — what's pending

Operator-side action required (no agent will perform these):

1. Apply migrations `000 → 010, 101, 102, 104, 105, 106` on a confirmed **dev / staging** DB (the `SPRINT_10_LIVE_DB_CLOSEOUT_OPERATOR_CHECKLIST.md` carries the production-host refusal guard).
2. Seed at least one source row in `legal_sources` (e.g. `legislation.gov.uk` Employment Rights Act 1996).
3. Run `bash scripts/infra/verify-iterlaw-rag-db.sh` with `DATABASE_URL` set; expect live-DB checks to flip from `NOT EXECUTED` to `PASS`.
4. Run the RLS staging test plan (Appendix C of the Sprint 10 QA report).
5. Update [`SPRINT_10_DB_DECISIONS.md`](SPRINT_10_DB_DECISIONS.md) "Deployment gate" section to reflect the new state.

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
