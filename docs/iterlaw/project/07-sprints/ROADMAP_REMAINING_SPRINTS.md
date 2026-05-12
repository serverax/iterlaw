# IterLaw — Remaining Sprint Roadmap

Forward-looking architecture roadmap. These are **planned future sprints**, not committed delivery. They land **after** the first IterLaw beta (UK Employment) is shipped.

## Remaining sprint count

**Roadmap target:** Sprint 45.

**Completed:**

- Sprints 1–9.

**Current:**

- Sprint 10 is pending staging DB verification.

**Remaining:**

- **36 sprints remaining including Sprint 10.**
- **35 sprints remaining after Sprint 10 passes.**

**Do not mark Sprint 10 as complete.**

Sprint 46+ entries listed lower in this document (Workspace + RLS + Supreme Controller + Approval + Document intelligence) are now **post-Sprint-45 backlog** and are not counted in the 36 / 35 above.

## Current state (do not move without evidence)

- Sprint 10 repo + local Docker DB: **PASS**.
- Sprint 10 real staging DB verification: **PENDING**.
- Sprint 11 Phase 1 (foundation) + Phase 2A (audit / transport guardrails): **PASS** (mock-safe).
- Sprint 11 live HTTP transport: **NOT STARTED**.
- Sprint 11 pipeline wiring: **NOT STARTED**.
- Production: **BLOCKED**.

Authoritative architecture docs are referenced beside each sprint.

## Law Module Engine (18–25)

| Sprint | Title | Anchor doc |
| --- | --- | --- |
| 18 | Law Module Engine Foundation | `../01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md` |
| 19 | Multi-Tier Legal Retrieval Engine | `../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md` |
| 20 | Background Legal Intelligence Builder | `../01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md` (§nightly pre-builder, §near-miss queue) |
| 21 | Law Section Intelligence System | `../01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md` (§law_section_modules) |
| 22 | Country Expansion Engine | `../01-architecture/LEGAL_AI_CORE_PLATFORM_SCOPE.md` |
| 23 | Module-Specific AI Isolation | `../01-architecture/LEGAL_AI_CORE_PLATFORM_SCOPE.md`, `MULTI_TIER_RETRIEVAL_ARCHITECTURE.md` |
| 24 | Pre-Built Legal Knowledge Seeding | `LAW_MODULE_ENGINE_ARCHITECTURE.md` (§nightly pre-builder) |
| 25 | Persistent Legal Memory Engine | `LAW_MODULE_ENGINE_ARCHITECTURE.md` (§module_qa_cache, RAV) |

## Speed-first retrieval infrastructure (26–34)

| Sprint | Title | Anchor doc |
| --- | --- | --- |
| 26 | Speed-First Retrieval Infrastructure (HNSW + cache) | `../04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md` |
| 27 | Ollama Runtime Speed Layer (keep_alive, prefix reuse, flash attention) | `SPEED_AND_STREAMING_ARCHITECTURE.md` |
| 28 | Structured Fill-in-the-Blank Answering | `SPEED_AND_STREAMING_ARCHITECTURE.md` |
| 29 | Retrieval-Augmented Verification | `SPEED_AND_STREAMING_ARCHITECTURE.md` |
| 30 | Speculative Prefill UI | `SPEED_AND_STREAMING_ARCHITECTURE.md` |
| 31 | Two-Stage Local Model Cascade | `SPEED_AND_STREAMING_ARCHITECTURE.md` |
| 32 | Deterministic Legal Knowledge Graph | `SPEED_AND_STREAMING_ARCHITECTURE.md` (§knowledge graph) |
| 33 | ChatGPT-Style Streaming UX (SSE, openers, 3-part reveal) | `SPEED_AND_STREAMING_ARCHITECTURE.md` |
| 34 | Graceful Failure + Escalation | `SPEED_AND_STREAMING_ARCHITECTURE.md`, `../01-architecture/SUPREME_CONTROLLER_ARCHITECTURE.md` |

## WASM intelligence stack (35–45)

| Sprint | Title | Anchor doc |
| --- | --- | --- |
| 35 | IterLaw WASM Runtime Foundation | `../01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md` |
| 36 | WASM Gateway + Security Layer (gatekeeper / pii_guard / rate_limit) | `WASM_INTELLIGENCE_ARCHITECTURE.md` |
| 37 | WASM Cache + Retrieval Engine (cache_lookup / retrieval_router) | `WASM_INTELLIGENCE_ARCHITECTURE.md` |
| 38 | WASM Intent + Complexity Classifier | `WASM_INTELLIGENCE_ARCHITECTURE.md` |
| 39 | WASM Legal Source Federation | `WASM_INTELLIGENCE_ARCHITECTURE.md` |
| 40 | WASM LLM Routing Layer | `WASM_INTELLIGENCE_ARCHITECTURE.md` |
| 41 | WASM External AI Federation | `WASM_INTELLIGENCE_ARCHITECTURE.md` (interface only — no provider call) |
| 42 | WASM Synthesis + Validation Engine | `WASM_INTELLIGENCE_ARCHITECTURE.md` |
| 43 | Streaming Legal Adviser Experience (WASM streamer) | `WASM_INTELLIGENCE_ARCHITECTURE.md`, `SPEED_AND_STREAMING_ARCHITECTURE.md` |
| 44 | WASM Observability + Cost Intelligence | `WASM_INTELLIGENCE_ARCHITECTURE.md` |
| 45 | WASM Production Hardening | `WASM_INTELLIGENCE_ARCHITECTURE.md` |

## Post-Sprint-45 backlog (not in remaining-sprint count)

The two blocks below describe earlier-documented Sprint 46–57 entries. They are **not** part of the current Sprint-45 roadmap target and are **not** included in the 36 / 35 remaining-sprint counts above. They remain as backlog references; folding any of them back into the active roadmap is an explicit planning decision.

## Workspace, RLS, Supreme Controller, approval (46–51 — post-45 backlog)

| Sprint | Title | Anchor doc |
| --- | --- | --- |
| 46 | User Workspace and Subscription Foundation | `../01-architecture/WORKSPACE_AND_USER_DATA_ARCHITECTURE.md`, `MODULE_SUBSCRIPTION_ARCHITECTURE.md` |
| 47 | PostgreSQL RLS User Isolation | `WORKSPACE_AND_USER_DATA_ARCHITECTURE.md`, `../05-security/RLS_SECURITY_MODEL.md` |
| 48 | Case Management Engine | `WORKSPACE_AND_USER_DATA_ARCHITECTURE.md` |
| 49 | Supreme Controller Foundation | `../01-architecture/SUPREME_CONTROLLER_ARCHITECTURE.md` |
| 50 | Human Approval Queue | `SUPREME_CONTROLLER_ARCHITECTURE.md` (§human approval gate) |
| 51 | Quality and Self-Monitoring Agents | `SUPREME_CONTROLLER_ARCHITECTURE.md` (§agent registry — quality_agent / security_agent) |

## Document intelligence stack (52–57 — post-45 backlog)

| Sprint | Title | Anchor doc |
| --- | --- | --- |
| 52 | Document Intelligence Foundation | `../01-architecture/DOCUMENT_INTELLIGENCE_ARCHITECTURE.md` |
| 53 | Cited Legal Document Model | `DOCUMENT_INTELLIGENCE_ARCHITECTURE.md` (§paragraph-level citation model) |
| 54 | DOCX and PDF Rendering | `DOCUMENT_INTELLIGENCE_ARCHITECTURE.md` (§output formats) |
| 55 | XLSX Legal Calculators | `DOCUMENT_INTELLIGENCE_ARCHITECTURE.md` (§output formats — XLSX) |
| 56 | Document Approval and Solicitor Review | `DOCUMENT_INTELLIGENCE_ARCHITECTURE.md` (§citation failure handling), `SUPREME_CONTROLLER_ARCHITECTURE.md` |
| 57 | Full Workspace UX | `WORKSPACE_AND_USER_DATA_ARCHITECTURE.md`, `DOCUMENT_INTELLIGENCE_ARCHITECTURE.md` |

## How to read this roadmap

- Sprints 18–57 are **target architecture**, not committed delivery.
- Each entry has at least one anchor doc in this project tree describing the contract.
- First beta = **IterLaw UK Employment**. The team continues current delivery through Sprints 12–17 (legacy entries in `SPRINT_INDEX.md`) before opening Sprint 18.
- Production: **BLOCKED**. Sprint 10 real staging DB verification: **PENDING**.

## Risk fence

Future scope must **not** delay the first IterLaw beta. If any Sprint 18+ work is needed to ship UK Employment beta, that requirement is escalated to a planning decision — not silently absorbed into a Sprint 12–17 deliverable.

## Naming guardrails (still apply)

- Active product name: **IterLaw**.
- Forbidden in active material: `RightsNow`, bare `iterlaw` namespace, `iterlaw-prod`.
- Canonical Kubernetes namespaces: `iterlaw-ai`, `iterlaw-rag`, `iterlaw-api`, `iterlaw-monitoring`, `iterlaw-security`.

## Offline-first legal DB model — mandatory across the roadmap

Locked decision: [`../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md). Architecture contract: [`../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md`](../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md).

- The offline-first legal DB model is **mandatory** for every sprint that touches the answer path.
- **Each country engine requires its own offline legal DB** built + seeded + human-reviewed before that country can launch. No country launches without its DB ready.
- **LLM fallback / background builder is a later layer**, not the first answer path. Sprint 27+ runtime optimisations sit on top of the offline-first tier infrastructure, not in place of it.
- **Sprints 18–25** must be aligned to the offline-first DB model (Law Module Engine, section registry, Q&A cache, generation queue, country expansion, module isolation, knowledge seeding, persistent memory).
- **Sprints 26–34** optimise speed and streaming **on top of** the offline-first model (HNSW, keep-alive, structured output, RAV, speculative prefill, two-stage cascade, knowledge graph, SSE, graceful failure).
- **Sprints 35–45** apply WASM to the offline-first engine (gateway, cache, retrieval router, classifier, sources, LLM routing, synthesis, validation, streaming, observability, hardening).

No future sprint is marked complete by this update.
