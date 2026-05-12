# IterLaw — RAG Summary

How retrieval works in IterLaw and the non-negotiable rules around it. Full plan: `docs/iterlaw/SPRINT_10_LIVE_RAG_PLAN.md`.

## Primary trusted sources

UK employment law corpus is fetched from these publishers only (allow-list; rate-limited per source ToS):

| Source | Role |
| --- | --- |
| `legislation.gov.uk` | Statute + regulations (Employment Rights Act 1996, Equality Act 2010, TUPE, Working Time Regulations, etc.). Authoritative. |
| `gov.uk` | GOV.UK employment guidance (dismissal, redundancy, holiday pay, tribunal procedure). Operator-facing. |
| ACAS | Codes of Practice and guidance (disciplinary + grievance, settlement agreements). Highly persuasive. |
| Find Case Law (`caselaw.nationalarchives.gov.uk`) | UK case law — Supreme Court, Court of Appeal, EAT, tribunal decisions. Citable precedent. |
| EHRC | Code on employment discrimination. Statutory code. |
| HMCTS | ET1 / ET3 procedural notes. |
| CAC | Central Arbitration Committee decisions on trade-union recognition (where relevant). |

These map onto rows in `legal_sources` (per `004_legal_rag_sprint10_source_registry.sql`). Each source carries a trust tier, refresh cadence, and per-source rate limit.

## Hard rules

- **Citations required.** Every legal claim in a returned answer must map to a real chunk in `legal_chunks` (or `legal_cases` for case-law) with `chunk_id`, `document_id`, `title`, `url`, and `citation_label` all set.
- **Effective dates required.** Retrieval applies `effective_date <= applicable_on AND (applicable_to IS NULL OR applicable_to >= applicable_on)`. The user's `applicable_on` is derived from facts (`dismissal_date` first, `incident_date` fallback).
- **No unsupported legal answers.** If retrieval returns zero chunks → `insufficient_sources`. If returned chunks lack citation metadata → `citation_failed`.
- **Local DB is source of truth before local LLM drafting.** The bounded synthesis layer drafts only from retrieved + citation-complete chunks. The local LLM is **never** allowed to invent statutes, cases, or guidance pages.
- **No external LLM in the orchestrator request path.** Sprint 11 added the local-LLM gateway interface (default `disabled`). No public-provider call ever appears in the answer pipeline.
- **No uncontrolled scraping.** Ingestion respects each source's published rate limit and `robots.txt`. Per-fetch audit row written to `source_fetch_audit` (or `uk_emp_rag.legal_ingestion_runs`).
- **No user uploads as authority.** Documents the user uploads (`legal_case_documents`) inform fact extraction but never appear as legal authority in a generated answer.

## Retrieval contract (today, in code)

`apps/legal-orchestrator/src/rag/postgresRetrieval.ts` runs against the canonical 001-chain:

```
SELECT chunk_id, document_id, source_type, chunk_index, chunk_text,
       title, url, citation_label, section_reference, paragraph_reference,
       authority_level, effective_date, applicable_to
FROM legal_chunks c
JOIN legal_domains d ON d.id = c.domain_id
WHERE d.domain_code = $1
  AND c.is_active = true
  AND c.jurisdiction = $2
  AND c.search_vector @@ plainto_tsquery('english', $3)
  AND ($4::text[] IS NULL OR c.source_type = ANY($4::text[]))
  AND ($6::date IS NULL OR c.effective_date IS NULL OR c.effective_date <= $6::date)
  AND ($6::date IS NULL OR c.applicable_to IS NULL OR c.applicable_to >= $6::date)
ORDER BY ts_rank(...), authority_level DESC
LIMIT $5
```

ILIKE fallback runs when FTS returns zero. Both pass the same column set.

## Sprint 10 status

- **Code-side wired:** retrieval port, temporal filter, citation evidence, citation gate, refusal paths. Locked in by `apps/legal-orchestrator/src/tests/sprint10LiveRagWiring.test.ts`.
- **Operator-side pending:** apply migrations on a dev DB + seed at least one source per `SPRINT_10_LIVE_RAG_PLAN.md`.

## Failure modes a user might see

| Status | Cause |
| --- | --- |
| `insufficient_sources` | Empty retrieval. The corpus does not yet contain a chunk that matches. Most common during early ingestion. |
| `citation_failed` | Retrieved chunks lack required citation fields. Should not happen in production but is the safe fallback. |
| `needs_more_facts` | The user has not supplied the facts retrieval needs (e.g. dismissal_date). |
| `high_risk_deadline` | A statutory deadline is imminent / past — escalate to human advice. |

## Module-specific RAG (target)

IterLaw is one platform serving many `(country, law-domain)` modules. RAG is **module-scoped**:

- Every retrieval call carries `(country_id, module_id)`.
- The corpus is partitioned per module — UK Employment chunks live alongside (but never mix with) UK Housing, Germany Immigration, Saudi Labour, etc.
- The retrieval SQL filters on the module's domain code and jurisdiction column.
- Cross-module retrieval is **not allowed** in the answer path. A future federated query flag would have to be requested explicitly; none exists today.
- Module isolation extends to sources, prompts, calculators, citation policy, and specialist AIA workflows.

## Multi-tier retrieval (target)

The full retrieval flow is described in [`MULTI_TIER_RETRIEVAL_ARCHITECTURE.md`](MULTI_TIER_RETRIEVAL_ARCHITECTURE.md). Brief summary:

- **Tier 0** — Redis exact hash cache (instant).
- **Tier 1** — HNSW semantic Q&A cache on `module_qa_cache` (target — Sprint 19).
- **Tier 2** — Tag / section lookup on `law_section_modules` (target — Sprint 21).
- **Tier 3** — Semantic law section search via pgvector (target — Sprint 24).
- **Tier 4** — Local LLM bounded synthesis (existing Sprint 11 interface; disabled by default).
- **Background** — Cache enrichment + retrieval-augmented verification.

The LLM is the **slow path**. Most repeated and deterministic questions should hit Tier 0 / 1 / 2 / 3, never Tier 4.

## Section module lookup (target)

`law_section_modules` rows are addressable law-section references (e.g. `ERA 1996 s.98`). Each row carries the verbatim section text plus a plain-English rewrite, with `effective_from` / `effective_to` and a `verification_status` (`unverified` / `auto_generated` / `human_reviewed` / `solicitor_approved`). Sections with `verification_status = 'unverified'` are **not eligible** for direct serve. See [`../01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md`](../01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md).

## Semantic cache + HNSW target

`module_qa_cache` is the durable Q&A cache. The pgvector HNSW index on `question_embedding` is the target performance lever for sub-50 ms p95 cache reads (Sprint 26). Direct-serve threshold ~0.92 similarity; near-miss window 0.80–0.91 routes a generation job into `answer_generation_queue`.

## Background pre-builder (target)

A scheduled worker pre-builds `module_qa_cache` entries by:

- Enqueuing canonical questions per category nightly.
- Draining the near-miss queue.
- Re-validating cache rows older than the staleness threshold (RAV).

This is the mechanism that lets most user questions land on a pre-built answer, not on a live LLM call.

## No cross-module retrieval unless explicitly allowed

The answer path must not query another module's corpus. The current retrieval port enforces module / jurisdiction filtering already; the multi-tier retrieval target preserves it across every tier. A federated query would require an explicit `allow_cross_module` flag set per request, which today does not exist.

## LLM slow path only

The local LLM is reserved for:

- Novel questions not yet covered by cache or knowledge graph.
- Bounded synthesis under the citation gate.
- Background pre-building.
- Difficult / edge-case explanation.

External provider LLMs (OpenAI / Anthropic / Gemini / Cohere / Mistral) are **never** in the live answer path. Sprint 11 transport policy denies their hostnames at runtime; the Phase 2A test set asserts no provider SDK in `apps/legal-orchestrator/package.json`.

## RAG is not the first tier (offline-first model)

RAG is **not** the first tier for repeated / common questions. The offline-first model serves earlier tiers first:

- **Tier 0 (Redis exact cache)** and **Tier 1 (semantic Q&A cache)** come before RAG.
- **Tier 2 (`law_section_modules` registry)** comes before RAG when the question maps to an addressable section reference.
- **Tier 4 (deterministic knowledge graph / formula lookup)** answers facts like qualifying periods, statutory caps, and ACAS clock without retrieval at all.
- RAG (Tier 3) runs when the earlier tiers cannot answer.

This is the IterLaw offline-first contract — see [`../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md`](../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md) and [`../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md).

## RAG is scoped by country / module

Every retrieval call carries `(country_id, module_id)`. The retrieval port filters on jurisdiction + domain + the module's source allow-list:

- UK Employment chunks are never returned to a UK Housing query.
- UK chunks are never returned to a Germany query.
- A cross-module / cross-country read in the answer path requires an explicit federated flag that does not exist today.

## Retrieved chunks must be citation-verified

Every retrieved chunk must carry `chunk_id`, `document_id`, `title`, `url`, `citation_label`. A chunk missing any of these fields fails the citation gate. The local LLM (Tier 5) **never** sees a chunk that fails the gate, and never emits a citation that did not arrive in the supplied retrieval set.
