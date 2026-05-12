# ADR — Offline-First Legal DB Model

**Date:** 2026-05-12.
**Status:** Accepted.

## Decision

IterLaw uses an **offline-first legal database model** per `(country, module)`.

- The offline / local legal database is the **first source of truth** for every legal answer.
- The local LLM is the **fallback / background builder**, not the default answer engine.
- The LLM runs only when the offline tiers (cache, semantic Q&A cache, section registry, deterministic rules / knowledge graph, RAG) cannot answer safely.
- When the LLM does run, its output is **validated** (citation gate + retrieval-augmented verification) and **stored** into the cache / section registry / review queue for future reuse.
- Each country engine owns its **own offline legal DB**; country engines do not share legal answers unless an explicit, approved mapping exists.

Architecture contract: [`../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md`](../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md).

## Context

The default pattern for chat-style legal AI products is to send every question to a hosted LLM, optionally retrieving context. That pattern is:

- **Expensive** — per-token costs per user request, with no compounding cache benefit.
- **Slow** — every answer pays full LLM latency, even for repeat questions.
- **Less controllable** — vendor changes, model updates, and provider outages affect legal answer quality directly.
- **Higher legal risk** — an answer drawn from model memory is not citation-backed.

IterLaw's volume model (one cited UK Employment beta first, then multi-country expansion) means most user questions in a mature module are **repeats** of canonical questions. Serving them from a verified local cache is faster, cheaper, and safer.

The Sprint 11 work (gateway interface + audit + transport policy) already enforces the safety perimeter the offline-first model relies on. The remaining work is the tier infrastructure: caches, section registry, knowledge graph, generation queue, and background workers.

## Consequences

### Positive

- **Cost compounds with usage.** Cache hit rate climbs over time as the cache fills; cost per cited answer drops.
- **Faster answers for repeat questions.** Tier 0 (Redis) and Tier 1 (HNSW Q&A cache) serve in milliseconds.
- **Stronger legal control.** Citations come from the local corpus; the LLM never invents authority.
- **Resilient to LLM vendor / runtime changes.** A model rollback does not change cache hits; only Tier 5 calls are affected.
- **Country / module isolation is structural.** RLS + module gate + per-country DB shape make leakage unlikely.
- **Self-improving loop.** Validated LLM outputs become cache rows; future users hit the cache.

### Costs / constraints

- **Each new country requires offline DB build before launch.** Sourcing, ingestion, section registry seeding, human review of seed rows. No quick country expansion without this.
- **Cache invalidation discipline required.** Corpus changes must invalidate downstream cache rows.
- **Section / cache verification status pipeline required.** `unverified` rows are not eligible for direct serve; promotion needs human reviewers.
- **More moving parts to operate.** Redis cache, HNSW index, knowledge graph, generation queue, background workers.
- **Per-month cost is not zero.** Servers, GPUs, backups, monitoring, SMS / email / payment processing, observability storage, human review. Spend shifts from per-call to per-month.
- **Slower beta launch per country.** Faster long-run unit economics, slower zero-to-one for each new country.

## Non-goals

- **Not** implementing every country now. UK Employment ships first; other countries follow only when the offline DB is ready.
- **Not** replacing legal review. Human review is mandatory for new sections, amendments, low-confidence answers, refunds, GDPR / DSAR requests, and security events.
- **Not** allowing an external provider LLM as the default answer path. The Sprint 11 transport policy denies provider hostnames at runtime; this ADR keeps that policy.
- **Not** dropping the LLM. Tier 5 still exists for novel questions, drafting, and background cache builds.
- **Not** sharing answers across countries. Cross-country reuse requires explicit, operator-approved mapping; none today.

## Related

- Architecture contract: [`../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md`](../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md)
- Multi-tier retrieval: [`../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md`](../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md)
- Law module engine: [`../01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md`](../01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md)
- WASM intelligence: [`../01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md`](../01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md)
- Roadmap impact: [`../07-sprints/ROADMAP_REMAINING_SPRINTS.md`](../07-sprints/ROADMAP_REMAINING_SPRINTS.md)
