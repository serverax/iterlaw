# IterLaw — Offline-First DB Architecture Update Report

**Date:** 2026-05-12.

This report records the docs-only update locking the offline-first legal database model as an IterLaw architectural decision. **No source code, migrations, tests, or Kubernetes manifests were changed.**

## 1. Files changed

### New docs

| File | Purpose |
| --- | --- |
| `docs/iterlaw/project/01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md` | The architecture contract: decision, request flow with Tier 0–5 + background, country / module isolation, self-improving loop, cost model, legal safety. |
| `docs/iterlaw/project/10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md` | ADR — decision, context, consequences (positive + costs), non-goals. |
| `reports/ITERLAW_OFFLINE_FIRST_DB_ARCHITECTURE_UPDATE_REPORT.md` | This report. |

### Updated docs

| File | Change |
| --- | --- |
| `docs/iterlaw/project/01-architecture/ARCHITECTURE_SUMMARY.md` | Added §8 "Offline-First Legal Database Model". Realigned request-flow tier numbering to the 6-tier model (Tier 5 = local LLM fallback). |
| `docs/iterlaw/project/01-architecture/LEGAL_AI_CORE_PLATFORM_SCOPE.md` | Added "Country engine isolation" section explaining per-country offline DBs and the no-accidental-mixing rule. |
| `docs/iterlaw/project/03-rag/RAG_SUMMARY.md` | Added "RAG is not the first tier (offline-first model)", country / module scope rules, and citation-verification re-statement. |
| `docs/iterlaw/project/03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md` | Rewrote to the 6-tier model: Tier 0 Redis / Tier 1 Q&A cache / Tier 2 section registry / Tier 3 semantic + RAG / Tier 4 deterministic knowledge graph + formula / Tier 5 local LLM fallback + background enrichment. Updated feature flags. |
| `docs/iterlaw/project/01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md` | Added "Role in the offline-first model" section: WASM controls the offline-first routing path, orchestrates the tiers, enforces country / module isolation before retrieval, never bypasses citation validation. |
| `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` | Added "Offline-first legal DB model — mandatory roadmap constraint" section. |
| `docs/iterlaw/project/07-sprints/ROADMAP_REMAINING_SPRINTS.md` | Added equivalent mandatory-constraint section keyed against Sprints 18–25, 26–34, 35–45. |

## 2. Decision summary

IterLaw uses an **offline-first legal database model**:

- The local DB / cache / section registry / deterministic facts / RAG answer **before** the LLM.
- The local LLM (Tier 5) runs only when Tiers 0–4 cannot answer safely.
- Validated LLM outputs are stored back into the cache so the next user hits Tier 1.
- Each country runs its **own offline legal engine**.
- External provider LLMs remain **forbidden** in the live answer path (Sprint 11 transport policy denies provider hostnames at runtime).

ADR: `docs/iterlaw/project/10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`.

## 3. Country engine isolation summary

| Slice | Per country (isolated) |
| --- | --- |
| Legal sources / documents / chunks / embeddings | Yes |
| Section registry (`law_section_modules`) | Yes |
| Q&A cache (`module_qa_cache`) | Yes |
| RAG indexes (HNSW + FTS) | Yes |
| Citation rules | Yes |
| Legal rule packs | Yes |
| Document templates (DOCX / PDF / XLSX) | Yes |
| Calculators | Yes |
| Language pack | Yes |
| Specialist AIA workflow | Yes |

Cross-country reads in the answer path are forbidden unless an explicit `allow_cross_country` flag is set per request — none today.

## 4. WASM role summary

WASM is the **control plane** of the offline-first engine. It:

- Controls the Tier 0 → Tier 5 fall-through path.
- Orchestrates cache lookup, section lookup, deterministic rules / knowledge graph, RAG, validation, and streaming.
- Enforces `(country_id, module_id)` isolation **before** retrieval runs.
- Never bypasses citation validation; the validator module runs before the streamer emits any byte.
- Hands the bounded prompt to the local LLM worker; **does not** host heavy LLM inference itself.

## 5. Sprint roadmap impact

- **Offline-first is mandatory** for every roadmap sprint that touches the answer path.
- **Sprints 18–25** are aligned to building the offline-first engine — Law Module Engine, section registry, Q&A cache, generation queue, country expansion, module isolation, knowledge seeding, persistent legal memory.
- **Sprints 26–34** optimise speed and streaming **on top of** the offline-first model.
- **Sprints 35–45** apply WASM to the offline-first engine.
- **Each new country launch** requires its offline legal DB to be built + seeded + human-reviewed first.
- No future sprint is marked complete by this update.

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| **Source data quality** — bad ingestion produces bad section registry rows. | Per-source trust tier in `legal_sources`; ingestion audit (`source_fetch_audit`); human review on every new `law_section_modules` row before promotion to `auto_generated`. |
| **Stale law** — legislation amendments not reflected in the offline DB. | Effective-date model (`effective_date` / `applicable_to` / `superseded_by`); nightly source refresh; RAV re-verification on cache rows; corpus-change → cache invalidation. |
| **Cache invalidation** — cache hits drift behind the corpus. | Every Tier 0 / Tier 1 hit re-runs the citation gate against the current corpus before serve. Background RAV worker invalidates rows that fail re-verification. |
| **Jurisdiction leakage** — UK answer served to a Germany user, or one module's chunk leaks into another. | `(country_id, module_id)` validated server-side before retrieval. RLS policies key on workspace + subscription. Per-country offline DB shape makes cross-reads structurally unlikely. |
| **Human approval bottlenecks** — cache fills faster than reviewers can promote. | Confidence-tiered serve eligibility (`auto_generated` is sufficient for non-critical cases); approval queue dashboards + SLO targets; escalation path; reviewer capacity planned per module. |
| **Per-country launch cost** — offline DB build is expensive per country. | Country expansion is roadmap, not pre-beta. UK Employment ships first; other countries follow when their DB is ready. |
| **Tier 4 fact errors** — a wrong value in the deterministic knowledge graph propagates broadly. | `legal_fact_provenance` audit-trail; reviewer-approval gate on every `legal_fact_registry` change; nightly fact re-validation against the corpus. |

## 7. Current Sprint 10 / 11 state (unchanged)

| Item | Status |
| --- | --- |
| Sprint 10 repo implementation | **PASS** |
| Sprint 10 local Docker DB verification | **PASS** |
| Sprint 10 real staging DB verification | **PENDING** |
| Sprint 11 foundation (Phase 1) | **PASS** |
| Sprint 11 audit + transport guardrails (Phase 2A) | **PASS** |
| Sprint 11 live HTTP transport (Phase 2B) | **NOT STARTED** |
| Sprint 11 pipeline wiring (Phase 4) | **NOT STARTED** |
| Gateway | **DISABLED / MOCK-SAFE** |
| Production | **BLOCKED** |

This report does **not** mark Sprint 10 real staging DB verification as PASS and does **not** mark production as approved.

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
