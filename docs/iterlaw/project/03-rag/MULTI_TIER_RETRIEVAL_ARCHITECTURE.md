# Multi-Tier Legal Retrieval Architecture

How IterLaw answers a legal question with the fewest LLM calls and the lowest latency, while never bypassing citation safety. This implements the offline-first legal DB model — see [`../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md`](../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md) and the decision record [`../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md).

**Status:** target architecture. The current code runs a single-tier retrieval (`postgresRetrieval`) plus a disabled bounded synthesis. Tiers 0–4 land in Sprints 19–32. Tier 5 (LLM) interface exists today (Sprint 11) but is disabled / mock-safe. See `ROADMAP_REMAINING_SPRINTS.md`.

## Tier overview

```
Tier 0  Redis exact hash cache                          ── instant
   ↓
Tier 1  Semantic Q&A cache (HNSW)                       ── fast
   ↓
Tier 2  law_section_modules / section registry lookup   ── fast
   ↓
Tier 3  Semantic law section / RAG search               ── medium
   ↓
Tier 4  Deterministic legal knowledge graph /           ── deterministic
        formula lookup                                       (no LLM, no retrieval)
   ↓
Tier 5  Local LLM fallback                              ── slow path
              ↑
   Background: answer enrichment, RAV verification, cache generation
```

**The LLM (Tier 5) must not be called if Tier 0–4 can answer safely.** Every served answer — from any tier — must still pass the citation gate.

## Tier 0 — Redis exact hash cache

- Key: `(country_id, module_id, question_fingerprint)` where the fingerprint is a deterministic hash of the normalised question.
- Value: the full cited answer envelope plus citation chunk ids.
- TTL: low (e.g. 24 h) — Tier 1 is the durable layer; Tier 0 is hot.
- **Hit:** re-run the citation gate against the current corpus before serving. If any citation no longer resolves, miss the cache and fall through.

## Tier 1 — Semantic Q&A cache (HNSW)

- Backed by `module_qa_cache` (see [`../01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md`](../01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md)).
- Index: HNSW on `question_embedding` (pgvector).
- Direct-serve when similarity ≥ **0.92** AND `verification_status` ∈ {`auto_generated`, `human_reviewed`, `solicitor_approved`}.
- Near-miss window: **0.80 – 0.91** routes to the background enrichment queue so the cache fills over time.
- **Hit:** re-run the citation gate (same rule as Tier 0). On any citation drift, invalidate the row and fall through.

## Tier 2 — `law_section_modules` / section registry lookup

- The user's question is classified into category + tags.
- Lookup against `law_section_modules.tags` and `section_ref` for high-precision matches (e.g. "qualifying period for unfair dismissal" → ERA 1996 s.108).
- Returns the section's `plain_english` block as the candidate answer, **always** linked to the underlying `legal_documents` / `legal_chunks` rows.
- The section row's `verification_status` must be ≥ `auto_generated`. `unverified` sections are not eligible for direct serve.

## Tier 3 — Semantic law section / RAG search

- pgvector similarity search across `law_section_modules.embedding` (target column) and the full `legal_chunks` corpus, constrained by `(country, module)` and effective-date filter.
- Returns the top-N sections / chunks ranked by similarity + `authority_level` + recency.
- Output is a **candidate evidence pack**, not yet a draft answer. Tier 4 (if applicable) and Tier 5 build on it.

## Tier 4 — Deterministic legal knowledge graph / formula lookup

- Backed by `legal_fact_registry` (target table): deterministic facts keyed by `(country, module, fact_code)`. Examples for UK Employment: `qualifying_period_unfair_dismissal`, `basic_award_weeks_cap`, `acas_ec_clock_days`, `et_limitation_months`.
- Backed by formula rules in the module's WASM-runnable rule pack: deadline calculators (ACAS clock, statutory limitation), statutory rate calculators, schedule-of-loss formulae.
- **No LLM call.** **No retrieval beyond a direct key lookup.** Determinism + provenance audit (`legal_fact_provenance`) carries the citation.
- A question reducible to a deterministic fact / formula is **answered here** — Tier 5 is skipped.

## Tier 5 — Local LLM fallback

- The slow path. Runs the existing `runLocalDraftingStep` (Sprint 11) over the candidate chunks from Tiers 2 / 3.
- Citation-bound prompt builder restricts the LLM to the supplied chunk ids.
- Output guard rejects empty / zero-citation / hallucinated outputs.
- On success: pass through the safety gate and (optionally) write back into `module_qa_cache` for future direct-serve at Tier 1.
- On any refusal (`insufficient_sources`, `llm_unavailable`, `citation_failed`, `blocked_by_policy`): return the refusal to the user; do not invent.

## Background — cache enrichment + RAV verification

A continuous background worker:

- Pre-builds canonical questions (nightly).
- Drains the near-miss queue from Tier 1.
- Re-validates cache rows older than the staleness threshold.
- Runs **retrieval-augmented verification (RAV)** on cache rows: for each cached answer, re-retrieve the cited evidence and confirm the answer is still supported. Failures invalidate the row.
- Watches `legal_documents` updates: corpus change → invalidate downstream cache rows that cite changed chunk ids.

## Decision flow

```
1. Subscription entitlement gate
2. Tier 0 → hit? serve (after citation re-check).
3. else Tier 1 → high-similarity hit? serve (after citation re-check).
4. else Tier 2 → strong tag/section match in category? serve plain-English with citation.
5. else Tier 3 → assemble candidate evidence pack.
6. then  Tier 4 → deterministic fact / formula? serve from fact registry.
7. else  Tier 5 → bounded LLM synthesis under the citation gate.
8. else → refuse with insufficient_sources / citation_failed / llm_unavailable.
```

A request never falls through to Tier 5 without first having retrieved citation-complete chunks. Tier 5 with empty chunks short-circuits to `insufficient_sources`. Tier 5 must **not** run when Tier 0–4 can answer safely.

## Citation contract (applies to every tier)

- Every served chunk / section must carry `chunk_id`, `document_id`, `title`, `url`, `citation_label`.
- Effective-date filter: `effective_date <= applicable_on AND (applicable_to IS NULL OR applicable_to >= applicable_on)`.
- A cache hit must re-verify each citation against the current corpus before serve.
- No tier may invent a citation. No tier may use a cited URL that the LLM emitted (citations come from retrieval, not from generation).
- Tier 4 facts carry provenance from `legal_fact_provenance` — the citation that backs each deterministic value.

## Deterministic legal facts must not use the LLM

For questions like:

- "What is the qualifying period for unfair dismissal?"
- "What is the ACAS early conciliation clock?"
- "What is the statutory cap on the basic award?"

these are deterministic and belong at **Tier 4** (the knowledge graph / formula lookup) or **Tier 2** (a `law_section_modules` row with a stable `plain_english` summary). They must **not** route to Tier 5 by default.

## Feature flags (required)

Each tier is feature-flagged so it can be enabled / disabled per environment:

- `ITERLAW_RETRIEVAL_TIER0_REDIS_ENABLED`
- `ITERLAW_RETRIEVAL_TIER1_QA_CACHE_ENABLED`
- `ITERLAW_RETRIEVAL_TIER2_SECTION_LOOKUP_ENABLED`
- `ITERLAW_RETRIEVAL_TIER3_SEMANTIC_SECTION_ENABLED`
- `ITERLAW_RETRIEVAL_TIER4_KNOWLEDGE_GRAPH_ENABLED`
- `ITERLAW_RETRIEVAL_TIER5_LLM_ENABLED` (also gated by `ITERLAW_LOCAL_LLM_ENABLED`)
- `ITERLAW_RETRIEVAL_BACKGROUND_REBUILD_ENABLED`

All default to **off** until each tier is benchmarked + safety-reviewed.

## Cache hit ≠ free pass

Cache hits do **not** skip:

- The citation gate.
- The policy gate.
- Module / country scope check.
- Subscription entitlement check.

Cache streaming (simulated streaming for cache hits — see [`../04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md`](../04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md)) must not bypass legal safety. Stream the bytes of an answer that already passed all gates; do not start streaming before the gates clear.

## Status today vs target

| Tier | Today | Target sprint |
| --- | --- | --- |
| 0 — Redis exact hash | not implemented | Sprint 19 |
| 1 — HNSW Q&A cache | not implemented | Sprints 19–21 |
| 2 — Section lookup | not implemented | Sprints 21–24 |
| 3 — Semantic section / RAG | partially — single-tier retrieval port exists | Sprints 24–25 |
| 4 — Knowledge graph / formula | not implemented | Sprint 32 |
| 5 — Local LLM fallback | interface only (Sprint 11; disabled + mock-safe) | Sprint 27+ for speed-layer work |
| Background enrichment | not implemented | Sprint 20 |

## Related

- Offline-first decision: [`../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md`](../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md)
- ADR: [`../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md)
- Law module engine: [`../01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md`](../01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md)
- Speed + streaming: [`../04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md`](../04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md)
