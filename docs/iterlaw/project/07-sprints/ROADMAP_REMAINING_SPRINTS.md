# IterLaw — Remaining Sprint Roadmap

Forward-looking architecture roadmap. These are **planned future sprints**, not committed delivery. They land **after** the first IterLaw beta (UK Employment) is shipped.

> **Rebaseline note (2026-05-14, HEAD `b7af17f`).** Numbered sprints 1–20 delivered. Numbered sprints remaining: **37** (Sprints 21–57). Sprints 16 (MVP smoke), 17 (Next 14→15), 18 (Law Module Engine), 19 (Multi-tier retrieval), 20 (UK Employment ingestion pack) all delivered with reports + commits — see [`SPRINT_INDEX.md`](./SPRINT_INDEX.md) and [`../ITERLAW_PROJECT_STATUS.md`](../ITERLAW_PROJECT_STATUS.md). Operational / wiring sprints delivered alongside: 12A → 12J + 18A + 19A. Next 10-sprint bundle plan (12K → 26): [`./NEXT_10_SPRINT_BUNDLE_AFTER_12H_PLAN.md`](./NEXT_10_SPRINT_BUNDLE_AFTER_12H_PLAN.md) — not yet executed.

## Remaining sprint count

**Roadmap target:** Sprint 45 (Sprints 46–57 remain as post-Sprint-45 backlog and are not in the active remaining count).

**Completed (per [`SPRINT_INDEX.md`](./SPRINT_INDEX.md), reconciled 2026-05-13):**

- **Sprints 1–9** — DONE.
- **Sprint 10** — PASS (Docker staging scope; report [`../../../reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`](../../../reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md)). Non-Docker staging promotion remains a separate operator decision.
- **Sprint 11** — PASS (Phase 1 + Phase 2A + hardening + Phase 2B + Phase 4; full suite 58 files / 763 tests PASS at close).
- **Sprint 12** — PASS FOR DRY-RUN FOUNDATION ONLY (Track B operator-side scripts; live backup + live restore **NOT EXECUTED**).
- **Sprint 12A** — PASS (audit-reconciliation; SPRINT_INDEX truth fix, header corrections, Windows-bash test resolver).
- **Sprint 13** — PASS FOR OPERATOR-WORKSTATION READINESS ONLY (`--check` toolchain probes + operator toolchain doc + first-live-backup authorisation checklist default NO; first live backup + live restore **NOT AUTHORISED**).
- **Sprint 14** — PASS FOR INTELLIGENCE FOUNDATION / CODE-PREPARED ONLY (11 pure-function modules + 54 tests + 6 architecture docs; not wired into the answer path).
- **Sprint 15** — PASS FOR FEATURE-FLAGGED LOCAL WIRING ONLY (feature flag config + shadow-mode wiring + `/ready` additive field + 26 new tests; Intelligence Layer disabled by default).

**Current:**

- **Sprint 16** — PLANNED start (no commitments past this line).

**Remaining (active roadmap, ending at Sprint 45) — refreshed 2026-05-14 (post-bundle 12M → 34):**

- Numbered remaining inside the active roadmap window (Sprints 35 → 45): **11 sprints**.
- Numbered remaining including the post-Sprint-45 backlog (Sprints 35 → 57): **23 sprints**.
- Sprints 46+ (Workspace + RLS + Supreme Controller + Approval + Document intelligence) remain **post-Sprint-45 backlog** and are not in the active 11-count above.
- **Legacy line preserved for archive:** "30 sprints remaining (Sprint 16 → Sprint 45)" was correct as of 2026-05-13 morning. Bundles 12F→12G, 12H→12J, 12K→26, and 12M→34 delivered Sprints 16–34.

**Authoritative status source:** [`SPRINT_INDEX.md`](./SPRINT_INDEX.md). If this section disagrees with `SPRINT_INDEX.md`, `SPRINT_INDEX.md` wins; reopen the reconciliation procedure.

## Current state (reconciled 2026-05-13)

- Sprint 10 repo + local Docker DB verification: **PASS**.
- Sprint 10 real Docker staging DB replay: **PASS** (2026-05-13 via [`scripts/operator/sprint10-docker-staging-replay.ps1`](../../../scripts/operator/sprint10-docker-staging-replay.ps1); report [`../../../reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`](../../../reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md)). Scope: local Docker container only.
- Sprint 11 Phase 1 + Phase 2A + hardening: **PASS** (mock-safe foundation).
- Sprint 11 Phase 2B (live local HTTP transport, commit `3681fab`): **PASS**.
- Sprint 11 Phase 4 (pipeline wiring of `runLocalDraftingStep` into `handleLegalRequest`, commit `120b9de`): **PASS**.
- Sprint 11 overall: **PASS** at close (58 files / 763 tests PASS). Sprint 11 is **NOT** a production-unblock sprint.
- Sprints 12 / 12A / 13 / 14 / 15: PASS scoped as above. Live backup + live restore remain **NOT AUTHORISED**.
- Production: **BLOCKED** (separate gates).

## Sprint 10 + Sprint 11 closeout — what was delivered

- Migration 100 compatibility shim landed in commit `21364f4`.
- Migration 102 compatibility shim landed in commit `c17ffc2`.
- Sprint 10 Docker staging replay executed 2026-05-13; report archived under `reports/`.
- Sprint 11 Phase 2B live local HTTP transport landed in commit `3681fab`; Phase 4 pipeline wiring landed in commit `120b9de`.
- Test suite at Sprint 11 close: 58 files / 763 tests PASS. (Later Sprint 12 / 13 / 14 / 15 grew the suite to 72 files / 907 tests at Sprint 15 close; reconciled 73 files / 912 tests in Sprint 12A.)
- Sprint 10 is **PASS** (Docker staging scope); promotion past Docker staging remains a separate operator decision.
- Sprint 11 is **PASS** (closed); does not unblock production.
- Production remains **BLOCKED** (independent gate set).

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
- First beta = **IterLaw UK Employment**. The team continues current delivery through Sprints 16–17 before opening Sprint 18.
- Production: **BLOCKED** (independent gate set). Sprint 10 Docker staging DB verification: **PASS** (Docker scope only; non-Docker staging promotion remains a separate operator decision).

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
