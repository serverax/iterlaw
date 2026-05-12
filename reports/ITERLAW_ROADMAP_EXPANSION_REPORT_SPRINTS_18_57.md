# IterLaw — Roadmap Expansion Report (Sprints 18–57)

**Date:** 2026-05-12.

This report records the docs-only expansion of IterLaw's project documentation and sprint roadmap to cover the multi-country / multi-domain platform architecture. **No source code, migrations, tests, or Kubernetes manifests were changed.**

## 1. Files changed

### Updated docs

| File | Change |
| --- | --- |
| `docs/iterlaw/project/README.md` | Rewrote "At a glance" + added "Current scope". Removed legacy platform-brand naming. Linked new architecture docs + roadmap. |
| `docs/iterlaw/project/01-architecture/ARCHITECTURE_SUMMARY.md` | Added seven new sections: One App / Many Modules, Country + Module Routing, Subscription Entitlement Gate, Specialist Module Isolation, Shared Core Platform, Local-first Cost Model, LLM as Slow Path. Extended refusal-paths table and related-summaries list. |
| `docs/iterlaw/project/02-database/DATABASE_SUMMARY.md` | Added future-target tables: platform countries / modules / subscriptions, workspace extensions, law module engine tables, approval / governance, knowledge graph, document layer extensions. RLS expectations + country / module scoped RAG note. Marked all as not yet implemented. |
| `docs/iterlaw/project/03-rag/RAG_SUMMARY.md` | Added module-specific RAG, multi-tier retrieval summary (Tiers 0–4 + background), section module lookup, semantic cache / HNSW target, pre-builder, cross-module rule, LLM-slow-path rule. |
| `docs/iterlaw/project/04-ai-llm/LOCAL_LLM_AND_WASM.md` | Reframed legacy cluster-DNS URL (manifest reality, IterLaw canonical namespaces called out). Added slow-path / background-worker model + Sprint 11 status. |
| `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` | Added pointer to post-core roadmap (Sprints 18–57). Legacy Sprint 18 / 19 entries flagged as superseded by the new numbering pending a future planning sprint. |

### New docs (architecture)

| File | Purpose |
| --- | --- |
| `docs/iterlaw/project/01-architecture/LEGAL_AI_CORE_PLATFORM_SCOPE.md` | IterLaw Core Platform Scope — top-down picture, country / domain matrix, shared vs module-local layers, subscription gating, local-first cost model, country / domain adapters. |
| `docs/iterlaw/project/01-architecture/MODULE_SUBSCRIPTION_ARCHITECTURE.md` | Subscription model — user journey, example modules, multi-module discount in prose, backend entitlement rule, RLS interaction, planned tables, dashboard rules, operator guardrails. |
| `docs/iterlaw/project/01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md` | Law module engine — `law_category_modules`, `law_section_modules`, `module_qa_cache`, `answer_generation_queue`, nightly pre-builder, direct-serve / near-miss thresholds, verification status pipeline. |
| `docs/iterlaw/project/01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md` | WASM intelligence — what WASM is for / not for, runtime evaluation candidates (SpinKube, containerd-wasm-shim, Wasmtime, WasmEdge), K3s deployment, canonical namespaces, per-module requirements, planned module set, boundary to local LLM, embedding placement. |
| `docs/iterlaw/project/01-architecture/WORKSPACE_AND_USER_DATA_ARCHITECTURE.md` | Workspace + RLS + case data mental model, planned objects, RLS rule summary, naming reconciliation between roadmap and Sprint 10 tables, subscription interaction, audit. |
| `docs/iterlaw/project/01-architecture/SUPREME_CONTROLLER_ARCHITECTURE.md` | Supreme Controller — PERCEIVE → REASON → HUMAN APPROVAL GATE → ACT → MONITOR loop, agent registry, human approval triggers, hard rules, audit, failure handling. |
| `docs/iterlaw/project/01-architecture/DOCUMENT_INTELLIGENCE_ARCHITECTURE.md` | Document intelligence — document_agent role, storage model, hard rules, document types, output formats, paragraph-level citation model, rendering, citation failure handling, module template adapters. |

### New docs (RAG / AI / sprints)

| File | Purpose |
| --- | --- |
| `docs/iterlaw/project/03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md` | Tiers 0–4 + background, citation contract per tier, deterministic-facts rule, feature flags, cache-hit-is-not-free-pass rule, today-vs-target table. |
| `docs/iterlaw/project/04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md` | HNSW semantic cache, Ollama keep_alive, flash attention requested, prefix reuse, structured JSON, fill-in-the-blank, RAV, speculative prefill, two-stage cascade, knowledge graph, SSE streaming, simulated streaming for cache hits, openers, three-part reveal, graceful mid-stream failure handling. |
| `docs/iterlaw/project/07-sprints/ROADMAP_REMAINING_SPRINTS.md` | Future Sprint 18–57 roadmap with anchor docs per sprint. |

### Reports

| File | Purpose |
| --- | --- |
| `reports/ITERLAW_ROADMAP_EXPANSION_REPORT_SPRINTS_18_57.md` | This report. |

## 2. Architecture areas added

| Area | Anchor doc |
| --- | --- |
| Multi-country / multi-domain platform scope | `LEGAL_AI_CORE_PLATFORM_SCOPE.md` |
| Module subscription model + entitlement gate | `MODULE_SUBSCRIPTION_ARCHITECTURE.md` |
| Pre-built law section DB + Q&A cache + generation queue | `LAW_MODULE_ENGINE_ARCHITECTURE.md` |
| Multi-tier retrieval (Tiers 0–4 + background) | `MULTI_TIER_RETRIEVAL_ARCHITECTURE.md` |
| Speed + streaming roadmap | `SPEED_AND_STREAMING_ARCHITECTURE.md` |
| WASM-native intelligence architecture | `WASM_INTELLIGENCE_ARCHITECTURE.md` |
| User workspace + RLS + case management mental model | `WORKSPACE_AND_USER_DATA_ARCHITECTURE.md` |
| Supreme Controller + agent registry + human approval queue | `SUPREME_CONTROLLER_ARCHITECTURE.md` |
| Document intelligence engine (cited docs, DOCX/PDF/XLSX) | `DOCUMENT_INTELLIGENCE_ARCHITECTURE.md` |

## 3. Sprint blocks added

| Block | Sprints | Anchor |
| --- | --- | --- |
| Law Module Engine | 18–25 | `LAW_MODULE_ENGINE_ARCHITECTURE.md` |
| Speed-first retrieval | 26–34 | `SPEED_AND_STREAMING_ARCHITECTURE.md` |
| WASM intelligence stack | 35–45 | `WASM_INTELLIGENCE_ARCHITECTURE.md` |
| Workspace, RLS, Supreme Controller, approval | 46–51 | `WORKSPACE_AND_USER_DATA_ARCHITECTURE.md`, `SUPREME_CONTROLLER_ARCHITECTURE.md` |
| Document intelligence | 52–57 | `DOCUMENT_INTELLIGENCE_ARCHITECTURE.md` |

## 4. Current Sprint 10 / 11 state (unchanged)

| Item | Status |
| --- | --- |
| Sprint 10 repo implementation | **PASS** |
| Sprint 10 local Docker DB verification | **PASS** |
| Sprint 10 real staging DB verification | **PENDING** (operator action; AKS context observed is production-only) |
| Sprint 11 foundation (Phase 1) | **PASS** |
| Sprint 11 audit + transport guardrails (Phase 2A) | **PASS** |
| Sprint 11 live HTTP transport (Phase 2B) | **NOT STARTED** |
| Sprint 11 pipeline wiring (Phase 4) | **NOT STARTED** |
| Gateway | **DISABLED / MOCK-SAFE** |
| Production | **BLOCKED** |
| HEAD | `b14fd2d` |

This report **does not** mark Sprint 10 real staging DB verification as PASS and **does not** mark production as approved.

## 5. Remaining roadmap summary

- **Sprints 12–17** (legacy index): backup go-live, MVP polish + smoke, auth / subscription foundation, admin / legal-review UI, live evolution / safe optimisation, UK GDPR / DPA 2018 / DUAA 2025 retention + consent. These remain the immediate pre-beta work.
- **Sprint 18+** (new roadmap): post-core architecture covering modules, speed, WASM, workspace + Supreme Controller, document intelligence. Roadmap only; not committed delivery.

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| **Scope creep** — speed / WASM / module engine work pulled forward before first beta. | Hard fence: Sprint 18+ is post-beta. Sprints 12–17 stay focused on UK Employment first-beta delivery. |
| **Too many future sprints before beta** — 40 future sprints can pressure delivery to "wait for v2". | This roadmap is reference, not commitment. Beta ships on the Sprint 12–17 path. |
| **Legal accuracy per country** — every new module must meet the same citation + jurisdiction-lock contract as UK Employment. | Module adapter pattern; per-module corpus + rule pack; verification_status gate on `law_section_modules`. |
| **RLS complexity** — adding `module_id` / `country_id` / `subscription` predicates expands the policy surface. | Sprint 47 dedicated to RLS user isolation review; Sprint 10 helper functions reused; testing covers user-A-vs-B + module-not-subscribed cases. |
| **Subscription entitlement complexity** — billing edge cases (refunds, downgrades, multi-module discounts) hit legal-access logic. | Backend rule (subscription gate) is single-source; refunds / disputes route through human approval queue. |
| **Document liability risk** — generated legal documents are real-world artefacts. | Paragraph-level citation, jurisdiction lock, version stamp, audit trail; low-confidence drafts blocked at the download gate; human approval for review-required drafts. |
| **WASM operational risk** — new runtime, new failure modes. | Sprint 35 + 36 land first, with observability + structured logging + feature flags per module; Sprint 45 dedicated to production hardening. |
| **External AI cost / control risk** — third-party providers add cost, vendor risk, exfiltration risk. | External AI is **not** the default path; Sprint 11 transport policy denies provider hosts at runtime; the abstraction in Sprint 41 is interface-only. |

## 7. Recommendation

- **Continue current delivery through Sprints 12–17 first.** First beta = IterLaw UK Employment.
- **Keep Sprints 18–57 as roadmap.** Do not let future architecture block first beta.
- **Operator action remains:** run Sprint 10 real staging DB verification (no agent will run it). Capture the sign-off into `reports/ITERLAW_SPRINT_10_STAGING_APPLY_<YYYY-MM-DD>.log`.
- **No push of the local-ahead commits** without operator authorisation.

## Truth statement

> No source code changed.
> No migrations changed.
> No tests changed.
> No Kubernetes manifests changed.
> No push performed.
> No deployment performed.
> No kubectl mutating command performed.
> No database touched.
> No production DB touched.
> No external LLM calls performed.
> No secret values printed.
