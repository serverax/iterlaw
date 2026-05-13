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

## Sprint roadmap addendum — Sprints 26–57 (PLANNED only)

Added 2026-05-13. Every sprint in this addendum is **PLANNED**. None are implemented. None are claimed complete. The addendum is the canonical statement of Sprints 26–57; the per-track architecture contracts live in [`project/01-architecture/`](./project/01-architecture/) and the operational sprint table is [`project/07-sprints/SPRINT_INDEX.md`](./project/07-sprints/SPRINT_INDEX.md). Cross-reference: [`project/07-sprints/ROADMAP_REMAINING_SPRINTS.md`](./project/07-sprints/ROADMAP_REMAINING_SPRINTS.md).

### Planned (26–34) — Speed-first retrieval infrastructure

| # | Sprint | Status | Anchor |
| --- | --- | --- | --- |
| 26 | Speed-First Retrieval Infrastructure (HNSW + cache) | **PLANNED** | `project/04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md` |
| 27 | Ollama Runtime Speed Layer (keep_alive, prefix reuse, flash attention) | **PLANNED** | `project/04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md` |
| 28 | Structured Fill-in-the-Blank Answering | **PLANNED** | `project/04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md` |
| 29 | Retrieval-Augmented Verification | **PLANNED** | `project/04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md` |
| 30 | Speculative Prefill UI | **PLANNED** | `project/04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md` |
| 31 | Two-Stage Local Model Cascade | **PLANNED** | `project/04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md` |
| 32 | Deterministic Legal Knowledge Graph | **PLANNED** | `project/04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md` (§knowledge graph) |
| 33 | ChatGPT-Style Streaming UX (SSE, openers, 3-part reveal) | **PLANNED** | `project/04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md` |
| 34 | Graceful Failure + Escalation | **PLANNED** | `project/04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md`, `project/01-architecture/SUPREME_CONTROLLER_ARCHITECTURE.md` |

### Planned (35–45) — WASM intelligence stack

| # | Sprint | Status | Anchor |
| --- | --- | --- | --- |
| 35 | IterLaw WASM Runtime Foundation | **PLANNED** | `project/01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md` |
| 36 | WASM Gateway + Security Layer (gatekeeper / pii_guard / rate_limit) | **PLANNED** | `project/01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md` |
| 37 | WASM Cache + Retrieval Engine (cache_lookup / retrieval_router) | **PLANNED** | `project/01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md` |
| 38 | WASM Intent + Complexity Classifier | **PLANNED** | `project/01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md` |
| 39 | WASM Legal Source Federation | **PLANNED** | `project/01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md` |
| 40 | WASM LLM Routing Layer | **PLANNED** | `project/01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md` |
| 41 | WASM External AI Federation (interface only — no provider call) | **PLANNED** | `project/01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md` |
| 42 | WASM Synthesis + Validation Engine | **PLANNED** | `project/01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md` |
| 43 | Streaming Legal Adviser Experience (WASM streamer) | **PLANNED** | `project/01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md`, `project/04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md` |
| 44 | WASM Observability + Cost Intelligence | **PLANNED** | `project/01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md` |
| 45 | WASM Production Hardening | **PLANNED** | `project/01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md` |

### Planned (46–51) — Workspace, RLS, Supreme Controller, approval

| # | Sprint | Status | Anchor |
| --- | --- | --- | --- |
| 46 | User Workspace and Subscription Foundation | **PLANNED** | `project/01-architecture/WORKSPACE_AND_USER_DATA_ARCHITECTURE.md`, `project/01-architecture/MODULE_SUBSCRIPTION_ARCHITECTURE.md` |
| 47 | PostgreSQL RLS User Isolation | **PLANNED** | `project/01-architecture/WORKSPACE_AND_USER_DATA_ARCHITECTURE.md`, `project/05-security/RLS_SECURITY_MODEL.md` |
| 48 | Case Management Engine | **PLANNED** | `project/01-architecture/WORKSPACE_AND_USER_DATA_ARCHITECTURE.md` |
| 49 | Supreme Controller Foundation | **PLANNED** | `project/01-architecture/SUPREME_CONTROLLER_ARCHITECTURE.md` |
| 50 | Human Approval Queue | **PLANNED** | `project/01-architecture/SUPREME_CONTROLLER_ARCHITECTURE.md` (§human approval gate) |
| 51 | Quality and Self-Monitoring Agents | **PLANNED** | `project/01-architecture/SUPREME_CONTROLLER_ARCHITECTURE.md` (§agent registry — quality_agent / security_agent) |

### Planned (52–57) — Document intelligence stack

| # | Sprint | Status | Anchor |
| --- | --- | --- | --- |
| 52 | Document Intelligence Foundation | **PLANNED** | `project/01-architecture/DOCUMENT_INTELLIGENCE_ARCHITECTURE.md` |
| 53 | Cited Legal Document Model | **PLANNED** | `project/01-architecture/DOCUMENT_INTELLIGENCE_ARCHITECTURE.md` (§paragraph-level citation model) |
| 54 | DOCX and PDF Rendering | **PLANNED** | `project/01-architecture/DOCUMENT_INTELLIGENCE_ARCHITECTURE.md` (§output formats) |
| 55 | XLSX Legal Calculators | **PLANNED** | `project/01-architecture/DOCUMENT_INTELLIGENCE_ARCHITECTURE.md` (§output formats — XLSX) |
| 56 | Document Approval and Solicitor Review | **PLANNED** | `project/01-architecture/DOCUMENT_INTELLIGENCE_ARCHITECTURE.md` (§citation failure handling), `project/01-architecture/SUPREME_CONTROLLER_ARCHITECTURE.md` |
| 57 | Full Workspace UX | **PLANNED** | `project/01-architecture/WORKSPACE_AND_USER_DATA_ARCHITECTURE.md`, `project/01-architecture/DOCUMENT_INTELLIGENCE_ARCHITECTURE.md` |

### Addendum guardrails

- No sprint in this addendum is implemented today.
- No sprint in this addendum is claimed complete.
- All work after the first IterLaw UK Employment beta is gated on operator approval per sprint.
- Production: **BLOCKED** (separate gate set; live backup/restore/deployment **NOT AUTHORISED**). Sprint 10 Docker staging DB replay: **PASS** (2026-05-13; see `reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`); non-Docker staging promotion remains a separate operator decision. Sprint 11: **PASS** (closed; Phase 2B + Phase 4 wired; Sprint 11 does **not** unblock production).
- Canonical Kubernetes namespaces preserved: `iterlaw-ai`, `iterlaw-rag`, `iterlaw-api`, `iterlaw-monitoring`, `iterlaw-security`. **Forbidden:** `iterlaw-prod`, bare `iterlaw`.
- Naming: use **IterLaw** for the product. Do not introduce `RightsNow` into active material.

---

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

## AI Architecture Governance

AI architecture is governed by the Superior AI Architect AIA and reviewed through the OrdinoxAI AIA Collaboration Model (see [`SUPERIOR_AI_ARCHITECT_AIA.md`](./SUPERIOR_AI_ARCHITECT_AIA.md) + [`ORDINOXAI_AIA_COLLABORATION_MODEL.md`](./ORDINOXAI_AIA_COLLABORATION_MODEL.md)).

Any change involving RAG, GraphRAG, Self-RAG, local LLM routing, prompts, reranking, citation verification, synthetic evaluation, or WASM legal gates must be reviewed for:

- source grounding
- citation safety
- hallucination risk
- external LLM risk
- prompt governance
- evaluation coverage
- privacy / logging impact

## Performance claims policy

No performance claim (latency, throughput, accuracy improvement,
hallucination reduction) may be added to active docs unless a
matching benchmark output exists in `docs/benchmarks/` or a
reviewable artefact. Policy is enforced by
`scripts/qa/verify-iterlaw-v3-safety.sh`.
