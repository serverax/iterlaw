# Offline-First Legal Database Architecture

How IterLaw answers a legal question from local data first, and only falls back to the LLM when the local layers cannot answer safely. Decision record: [`../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md).

## 1. Decision

- **Offline legal DB is the first source of truth.** Local Postgres + pgvector + Redis hold the corpus, the section registry, the Q&A cache, the rule packs, and the deterministic fact registry. Every legal answer is sourced from these first.
- **Local LLM is the fallback / background path, not the default.** It runs only when Tiers 0–4 (cache, section registry, deterministic facts, RAG) cannot answer safely, and even then under the citation gate.
- **No external LLM in the live answer path.** The Sprint 11 transport policy denies public-provider hosts at runtime.
- **Each country engine is isolated.** Country A's DB / rules / templates do not serve Country B users without an explicit, approved mapping.

## 2. Request flow

```
1. User question + (country_id, module_id, user_id)
       │
2. Subscription entitlement check
       │   (paid?) ─ no ─► refuse: module_not_subscribed
       │
3. Tier 0  — Redis exact hash cache       ── instant
       │
4. Tier 1  — semantic Q&A cache (HNSW)    ── fast
       │
5. Tier 2  — law_section_modules lookup   ── fast
       │     (tag / section ref)
       │
6. Tier 3  — semantic law section / RAG   ── medium
       │
7. Tier 4  — deterministic knowledge graph / formula lookup
       │     (statutory caps, qualifying periods, ACAS clock, etc.)
       │
8. Tier 5  — local LLM bounded synthesis  ── slow path / fallback
       │
9. Citation validation gate
       │
10. Answer returned only if citation-supported
       │
11. Cache / store / queue for future reuse
       │     - direct hit  ─► refresh Tier 0/1 TTL
       │     - LLM result  ─► write module_qa_cache row (verification_status=auto_generated)
       │     - near miss   ─► enqueue answer_generation_queue
```

Each tier may refuse. The orchestrator never invents an answer to fill a refusal.

Multi-tier flow detail: [`../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md`](../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md).

## 3. Country engine isolation

Each country runs its own offline legal engine. None of the columns / rows below are shared between countries:

| Slice | Per country |
| --- | --- |
| Legal sources (`legal_sources`) | Yes |
| Legal documents (`legal_documents`) | Yes |
| Chunks + embeddings (`legal_chunks`, `legal_chunk_embeddings`) | Yes |
| Section registry (`law_section_modules`) | Yes |
| Q&A cache (`module_qa_cache`) | Yes |
| RAG indexes (HNSW + FTS) | Yes |
| Citation rules | Yes |
| Legal rule packs (WASM-runnable) | Yes |
| Document templates (DOCX / PDF / XLSX) | Yes |
| Calculators (deadlines, awards, statutory rates) | Yes |
| Language pack | Yes |
| Specialist AIA workflow | Yes |

Cross-country reads in the answer path are **forbidden** unless an explicit `allow_cross_country` flag is set per request — none exists today.

## 4. Law module isolation

Within one country, each law domain (Employment, Housing, Immigration, ...) is also isolated:

- The RAG corpus is partitioned per module — UK Employment chunks are never returned to a UK Housing query.
- Module-specific legal rules, prompts, calculators, document templates, and citation policy.
- The retrieval port filters on `module_id` + `country_id` + `jurisdiction` before any tier returns results.

A user holding a UK Employment subscription cannot read UK Housing rows, and vice versa. RLS plus subscription entitlement enforce this together.

## 5. Self-improving loop

The system gets faster over time without sending more user requests to the LLM:

1. A user's question hits Tiers 0–4 → if found, served from the local DB / cache, no LLM call.
2. If Tiers 0–4 miss, Tier 5 runs the local LLM under the citation gate.
3. The LLM result is **validated** (citation gate + RAV) and **stored** into `module_qa_cache` with `verification_status = 'auto_generated'`.
4. The next user with the same question hits Tier 1 directly — instant + cited.
5. **Near-miss** Tier 1 hits (similarity 0.80–0.91) enqueue a job in `answer_generation_queue`. A background worker drains the queue using the same pipeline.
6. Solicitor / human approval upgrades `auto_generated` rows to `human_reviewed` / `solicitor_approved`. Only rows at or above `auto_generated` are eligible for direct serve.

The cache thus learns the module's question shape. Nightly pre-builders enqueue canonical questions per category so the cache is populated **before** users ask.

## 6. Cost model

- **Local DB / caches reduce per-answer inference cost.** Tier 0 / Tier 1 hits are essentially free in compute terms compared with a Tier 5 LLM call.
- **Local-metal servers reduce external API dependency.** No external-provider per-token fees. Sprint 11 transport policy bars provider hostnames anyway.
- **Cost is not zero.** Servers, GPU power, backups, monitoring, SMS / email / payment processing, observability storage, and human review costs remain.
- **Spend shifts from per-call to per-month**: hardware + maintenance + human review + storage, not per-request inference fees.

This model is observed in the architecture, not yet measured in production. Speed and cost numbers require benchmarks in `docs/benchmarks/`.

## 7. Legal safety

- **No uncited answers.** Every served answer carries chunk-level citations resolved against the local corpus. A cache hit re-verifies its citations before serve.
- **No cross-country leakage.** Country / module pair is validated server-side before retrieval.
- **No cross-module leakage.** Module scope enforced at every tier.
- **Low-confidence output goes to human approval.** Below the per-module confidence floor → `human_approval_queue`; the user receives `human_review_required` until a reviewer acts. See [`SUPREME_CONTROLLER_ARCHITECTURE.md`](SUPREME_CONTROLLER_ARCHITECTURE.md).
- **Section verification status** — sections at `unverified` are not eligible for direct serve; they require human promotion to `auto_generated` / `human_reviewed` / `solicitor_approved`.
- **Cache integrity** — every cache hit re-runs the citation gate against the current corpus; on drift the row is invalidated and the request falls through.

## Status

- Sprint 10 ships the user-workspace + RLS migrations and the corpus tables. Docker staging DB replay: **PASS** (2026-05-13). The offline-first tiered retrieval system itself is **target architecture** (Sprints 18–25, 26–34, 35–45).
- Sprint 11 shipped the local LLM gateway interface (Phase 1) + audit + transport policy guardrails (Phase 2A) + live local HTTP transport (Phase 2B, commit `3681fab`) + pipeline wiring of `runLocalDraftingStep` into `handleLegalRequest` (Phase 4, commit `120b9de`). **PASS** at close.
- Production: **BLOCKED** (separate gate set; live backup/restore/deployment NOT AUTHORISED). Non-Docker staging promotion remains a separate operator decision.

## Related

- Multi-tier retrieval contract: [`../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md`](../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md)
- Law module engine: [`LAW_MODULE_ENGINE_ARCHITECTURE.md`](LAW_MODULE_ENGINE_ARCHITECTURE.md)
- Speed + streaming on top of the offline-first model: [`../04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md`](../04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md)
- Subscription entitlement: [`MODULE_SUBSCRIPTION_ARCHITECTURE.md`](MODULE_SUBSCRIPTION_ARCHITECTURE.md)
- Workspace + RLS: [`WORKSPACE_AND_USER_DATA_ARCHITECTURE.md`](WORKSPACE_AND_USER_DATA_ARCHITECTURE.md)
- Decision record: [`../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md)
