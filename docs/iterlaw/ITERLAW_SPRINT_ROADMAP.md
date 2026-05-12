# IterLaw — Sprint Roadmap

Authoritative top-level pointer to every planned and completed
sprint. The detailed plan / status for each sprint lives in its own
file; this roadmap is the index.

Last updated: 2026-05-12.

## Naming

- Product: **IterLaw**.
- Platform / company brain: **OrdinoxAI**.
- Legacy name **RightsNow** appears only inside material clearly
  marked legacy.
- Canonical namespaces: `iterlaw-ai`, `iterlaw-rag`, `iterlaw-api`,
  `iterlaw-monitoring`, `iterlaw-security`. Legacy `iterlaw-data`
  may remain. No standalone `iterlaw` namespace.

---

## Completed (1–9)

| # | Sprint | Status | Notes |
| --- | --- | --- | --- |
| 1 | Repo + naming baseline | DONE | Phase 0 CI/CD scaffold; package layout. |
| 2 | Legal-orchestrator foundation | DONE | Deterministic legal pipeline (AEE → ART → LVC → SEA). |
| 3 | Safety gates / citation rules | DONE | Citation gate, policy gate, source ranker, rule engine. |
| 4 | WASM rule-runner baseline | DONE | Interface in place; production runtime deferred to Sprint 16+. |
| 5 | Module pipeline | DONE | Cross-module wiring + tests. |
| 6 | RAG DB foundation (001-chain) | DONE | `legal_domains`, `legal_sources`, `legal_documents`, `legal_chunks`, audit tables. |
| 7 | Ingestion framework baseline | DONE | Chunker, normaliser, citation extractor, source registry. |
| 8 | Readiness / retrieval injection | DONE | `/ready` envelope; `createRagService` mock-safe selection. |
| 9 | Rename cleanup + backup safety baseline | DONE | RightsNow → IterLaw; `@rightsnow/*` → `@iterlaw/*`; LF policy; backup uploader + sealed-secret workflow; `legal_cases` (102). |

## In progress

| # | Sprint | Status | Plan |
| --- | --- | --- | --- |
| 10 | Live RAG DB wiring | **PARTIAL** — code-side DONE, operator-side PENDING | [`SPRINT_10_LIVE_RAG_PLAN.md`](./SPRINT_10_LIVE_RAG_PLAN.md). Reader queries canonical schema; live DB migrations + seed pending. |
| 11 | Local LLM gateway + bounded synthesis | **In Progress** — interface-only landed | [`SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md`](./SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md). Default mode `disabled`. Benchmarks pending. |

## Planned (12–19)

| # | Sprint | Status | Plan |
| --- | --- | --- | --- |
| 12 | Backup go-live | Planned | Build + push uploader image; pin digest + Storage Box CIDR; seal real Borg secret; apply manifests; first restore drill. |
| 13 | MVP polish + smoke test | Planned | Web UI for question entry + cited answer + doc download. End-to-end against the seeded corpus. |
| 14 | Member / auth / subscription foundation | Planned | Supabase Auth with RLS; tiered rate limiting. |
| 15 | Admin / legal-review UI | Planned | Human-in-the-loop legal review pipeline UI. |
| 16 | **Live evolution + safe optimisation** | **Planned** | [`SPRINT_16_LIVE_EVOLUTION_AND_SAFE_OPTIMISATION_PLAN.md`](./SPRINT_16_LIVE_EVOLUTION_AND_SAFE_OPTIMISATION_PLAN.md). Nightly auditable optimisation framework; **no production mutation without HITL approval**. |
| 17 | UK GDPR, retention, audit, consent | Planned | UK GDPR + DPA 2018 + Data (Use and Access) Act 2025 obligations; retention enforcement job; consent ledger. |
| 18 | **Multimodal Evidence Grounding Beta** | **Planned (future backlog)** | [`SPRINT_18_MULTIMODAL_EVIDENCE_GROUNDING_BETA_PLAN.md`](./SPRINT_18_MULTIMODAL_EVIDENCE_GROUNDING_BETA_PLAN.md). Local-only transcription + timestamp citation; DPIA gate; pilot capped at 5 advanced users. |
| 19 | Production hardening + public launch | Planned | Real CI on every push, load test, paid SLO, on-call rota. |

## Hard rules (apply to every sprint)

1. No `git push` without explicit operator instruction.
2. No `kubectl apply` / `helm install`.
3. No `psql` against production.
4. No real secrets committed.
5. No external LLM call from the legal answer path.
6. No fabricated citations.
7. No fake metric values — report `NOT_MEASURED` when a value is
   unavailable.
8. Active product name is **IterLaw**; `RightsNow` appears only in
   legacy-marked material.

## Performance claims policy

No performance claim (latency, throughput, accuracy improvement,
hallucination reduction) may be added to active docs unless a
matching benchmark output exists in `docs/benchmarks/` or a
reviewable artefact. Policy is enforced by
`scripts/qa/verify-iterlaw-v3-safety.sh`.
