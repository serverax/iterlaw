# IterLaw Core Platform Scope

The full top-down picture of what IterLaw is, before any single sprint adds detail. This is the scope reference all later architecture docs build on.

## What IterLaw is

IterLaw is **one web application** that delivers legal AI assistance across **multiple countries** and **multiple law domains**. Each user picks a country, picks a legal module, picks a subscription plan, and works through legal questions inside that scope.

First product focus is **UK Employment Law**. Other modules follow. Future scope must not delay the first beta.

## Top-level structure

```
IterLaw
  ├── Country modules
  │     ├── UK
  │     ├── Sweden
  │     ├── Germany
  │     ├── France
  │     ├── Netherlands
  │     ├── Norway
  │     ├── Denmark
  │     ├── UAE
  │     ├── Saudi Arabia
  │     └── future countries
  │
  ├── Legal domains
  │     ├── Employment
  │     ├── Immigration
  │     ├── Housing
  │     ├── Benefits
  │     ├── Family
  │     ├── Debt
  │     ├── Consumer
  │     ├── Business
  │     └── Tax
  │
  ├── Local legal DB per (country, domain)
  ├── RAG per (country, domain)
  ├── Local language support
  ├── Document reading
  ├── Document generation
  ├── Subscription engine
  ├── AI routing
  └── Specialist AIA management inside IterLaw
```

A module is the cross-product: `country × law domain`. Example modules: "UK Employment", "UK Housing", "Germany Immigration", "Saudi Labour Law".

## What is shared, what is module-local

| Layer | Shared (one for the platform) | Module-local (one per country × domain) |
| --- | --- | --- |
| Auth, identity, sessions | Shared | — |
| Billing, subscriptions, entitlement | Shared | — |
| Dashboard, chat UI, notifications | Shared | — |
| Case management, document workspace | Shared | — |
| Document engine (DOCX / PDF / XLSX rendering) | Shared | — |
| RAG engine (multi-tier retrieval framework) | Shared | — |
| AI gateway / model routing | Shared | — |
| Audit / monitoring | Shared | — |
| Postgres + pgvector + Redis cache | Shared | — |
| WASM deterministic modules | Shared runtime | Module-supplied rule packs |
| RAG corpus (sources, documents, chunks, embeddings) | — | Module-local |
| Legal rules / prompts / templates / calculators | — | Module-local |
| Specialist AIA workflow | — | Module-local |
| Citation policy | — | Module-local |
| Language pack | — | Module-local |

## Subscription gating

- Users choose **country**, **legal module**, **subscription plan**.
- Multi-module subscriptions are allowed.
- Multi-module subscriptions receive a **discount** (planned; see [`MODULE_SUBSCRIPTION_ARCHITECTURE.md`](MODULE_SUBSCRIPTION_ARCHITECTURE.md)).
- The dashboard surfaces locked modules with an upgrade message.
- Backend rule: every legal question must include `country_id + module_id`; backend rejects unpaid module access.

## Local-first cost model

Heavy LLM inference does **not** run for every question.

- Tier 0: Redis exact hash cache (instant).
- Tier 1: HNSW semantic Q&A cache (`module_qa_cache`).
- Tier 2: Law-section module lookup (`law_section_modules`).
- Tier 3: Semantic law section search.
- Tier 4: Local LLM bounded synthesis.

Background job pre-builds caches over time. Deterministic legal facts come from the knowledge graph (target), not the LLM.

## What the LLM is for

- Novel questions not yet covered by cache or knowledge graph.
- Bounded synthesis from retrieved chunks (under the citation gate).
- Pre-building (background worker).
- Document drafting (cited, jurisdiction-locked).
- Difficult / edge-case explanation.

The LLM is the **slow path**, not the default path. External provider LLMs are **not** the default path.

## What WASM is for

- Routing.
- Orchestration.
- Policy.
- Validation.
- Retrieval.
- Caching.
- Lightweight classification.
- Streaming control.

WASM is **not** the heavy LLM. Heavy inference stays in Ollama / vLLM / llama.cpp workers, sidecars, or shared runtime. See [`WASM_INTELLIGENCE_ARCHITECTURE.md`](WASM_INTELLIGENCE_ARCHITECTURE.md).

## Country / domain adapters

Each module ships an adapter that the shared platform calls:

- `getCorpusForModule(country, module)` — returns the RAG retrieval port.
- `getRulesForModule(country, module)` — returns the deterministic rule pack.
- `getPromptsForModule(country, module)` — returns prompts, templates.
- `getCalculatorsForModule(country, module)` — returns deadline / award calculators.
- `getDocumentTemplatesForModule(country, module)` — returns DOCX / PDF templates.
- `getCitationPolicyForModule(country, module)` — returns the citation rules.
- `getAiaWorkflowForModule(country, module)` — returns the specialist workflow.

These adapters are **target architecture**. None are wired today. See `ROADMAP_REMAINING_SPRINTS.md` Sprints 18 onwards.

## Naming

- Active product name: **IterLaw**.
- Forbidden in active material: `RightsNow` (legacy), bare `iterlaw` namespace, `iterlaw-prod`.
- Canonical namespaces: `iterlaw-ai`, `iterlaw-rag`, `iterlaw-api`, `iterlaw-monitoring`, `iterlaw-security`.

## Status

- First-beta scope (UK Employment) is partially implemented across Sprints 1–11.
- Multi-country / multi-domain platform scope is **target architecture** for Sprints 18–57.
- Production: **BLOCKED**. Sprint 10 real staging DB verification: **PENDING**.
