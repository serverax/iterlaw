# Multi-Tier Legal Retrieval Architecture

How IterLaw answers a legal question with the fewest LLM calls and the lowest latency, while never bypassing citation safety.

**Status:** target architecture. The current code runs a single-tier retrieval (`postgresRetrieval`) plus a disabled bounded synthesis. Tiers 0/1/2/3 land in Sprints 19–32. See `ROADMAP_REMAINING_SPRINTS.md`.

## Tier overview

```
Tier 0  Redis exact hash cache              ── instant
   ↓
Tier 1  HNSW semantic Q&A cache             ── fast
   ↓
Tier 2  law_section_modules tag/section     ── fast
   ↓
Tier 3  Semantic law section search         ── medium
   ↓
Tier 4  Local LLM / Ollama synthesis        ── slow path
              ↑
   Background: cache enrichment + RAV verification
```

Every tier may **refuse** (no answer) but must **not** invent. Each tier carries the same citation contract as Tier 4.

## Tier 0 — Redis exact hash cache

- Key: `(module_id, country_id, question_fingerprint)` where the fingerprint is a deterministic hash of the normalised question.
- Value: the full cited answer envelope plus citation chunk ids.
- TTL: low (e.g. 24 h) — Tier 1 is the durable layer; Tier 0 is hot.
- **Hit:** re-run the citation gate against the current corpus before serving. If any citation no longer resolves, miss the cache and fall through.

## Tier 1 — HNSW semantic Q&A cache

- Backed by `module_qa_cache` (see [`../01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md`](../01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md)).
- Index: HNSW on `question_embedding` (pgvector).
- Direct-serve when similarity ≥ **0.92** AND `verification_status` ∈ {`auto_generated`, `human_reviewed`, `solicitor_approved`}.
- Near-miss window: **0.80 – 0.91** routes to the background enrichment queue so the cache fills over time.
- **Hit:** re-run the citation gate (same rule as Tier 0). On any citation drift, invalidate the row and fall through.

## Tier 2 — `law_section_modules` tag / section lookup

- The user's question is classified into category + tags.
- Lookup against `law_section_modules.tags` and `section_ref` for high-precision matches (e.g. "qualifying period for unfair dismissal" → ERA 1996 s.108).
- Returns the section's `plain_english` block as the candidate answer, **always** linked to the underlying `legal_documents` / `legal_chunks` rows.
- The section row's `verification_status` must be ≥ `auto_generated`. `unverified` sections are not eligible for direct serve.

## Tier 3 — Semantic law section search

- pgvector similarity search across `law_section_modules.embedding` (target column) constrained by `(country, module)` and effective-date filter.
- Returns the top-N sections ranked by similarity + `authority_level` + recency.
- Output is **a candidate evidence pack**, not yet a draft answer. The next tier (Tier 4) drafts on top.

## Tier 4 — Local LLM / Ollama bounded synthesis

- The slow path. Runs the existing `runLocalDraftingStep` (Sprint 11) over the candidate chunks from Tiers 2/3.
- Citation-bound prompt builder restricts the LLM to the supplied chunk ids.
- Output guard rejects empty / zero-citation / hallucinated outputs.
- On success: pass through the safety gate and (optionally) write back into `module_qa_cache` for future direct-serve.
- On any refusal reason (`insufficient_sources`, `llm_unavailable`, `citation_failed`, `blocked_by_policy`): return the refusal to the user; do not invent.

## Background — cache enrichment + RAV verification

A continuous background worker:

- Pre-builds canonical questions (nightly).
- Drains the near-miss queue from Tier 1.
- Re-validates cache rows older than the staleness threshold.
- Runs **retrieval-augmented verification (RAV)** on cache rows: for each cached answer, re-retrieve the cited evidence and confirm the answer is still supported. Failures invalidate the row.

## Decision flow

```
1. Tier 0 → hit? serve (after citation re-check).
2. else Tier 1 → high-similarity hit? serve (after citation re-check).
3. else Tier 2 → strong tag/section match in category? serve plain-English (with citation).
4. else Tier 3 → assemble candidate evidence pack.
5. else / then Tier 4 → bounded LLM synthesis under the citation gate.
6. else → refuse with insufficient_sources / citation_failed / llm_unavailable.
```

A request never falls through to Tier 4 without first having retrieved citation-complete chunks. Tier 4 with empty chunks short-circuits to `insufficient_sources`.

## Citation contract (applies to every tier)

- Every served chunk / section must carry `chunk_id`, `document_id`, `title`, `url`, `citation_label`.
- Effective-date filter: `effective_date <= applicable_on AND (applicable_to IS NULL OR applicable_to >= applicable_on)`.
- A cache hit must re-verify each citation against the current corpus before serve.
- No tier may invent a citation. No tier may use a cited URL that the LLM emitted (citations come from retrieval, not from generation).

## Deterministic legal facts should not use the LLM

For things like:

- "What is the qualifying period for unfair dismissal?"
- "What is the ACAS early conciliation clock?"
- "What is the statutory cap on the basic award?"

these are deterministic and belong in:

- the **deterministic legal knowledge graph** (Sprint 32 target), or
- a `law_section_modules` row with a stable `plain_english` summary.

They must **not** route to Tier 4 by default.

## Feature flags (required)

Each tier is feature-flagged so it can be enabled / disabled per environment:

- `ITERLAW_RETRIEVAL_TIER0_REDIS_ENABLED`
- `ITERLAW_RETRIEVAL_TIER1_QA_CACHE_ENABLED`
- `ITERLAW_RETRIEVAL_TIER2_SECTION_LOOKUP_ENABLED`
- `ITERLAW_RETRIEVAL_TIER3_SEMANTIC_SECTION_ENABLED`
- `ITERLAW_RETRIEVAL_TIER4_LLM_ENABLED` (already gated by `ITERLAW_LOCAL_LLM_ENABLED`)
- `ITERLAW_RETRIEVAL_BACKGROUND_REBUILD_ENABLED`

All default to **off** until each tier is benchmarked + safety-reviewed.

## Cache hit ≠ free pass

Cache hits do **not** skip:

- The citation gate.
- The policy gate.
- Module scope check.
- Subscription entitlement check.

Cache streaming (simulated streaming for cache hits — see [`../04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md`](../04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md)) must not bypass legal safety. Stream the bytes of an answer that already passed all gates; do not start streaming before the gates clear.

## Status today vs target

| Tier | Today | Target sprint |
| --- | --- | --- |
| 0 — Redis exact hash | not implemented | Sprint 19 |
| 1 — HNSW Q&A cache | not implemented | Sprints 19–21 |
| 2 — Section lookup | not implemented | Sprints 21–24 |
| 3 — Semantic section search | not implemented | Sprints 24–25 |
| 4 — Local LLM synthesis | interface only (Sprint 11; disabled + mock-safe) | Sprint 27+ for speed-layer work |
| Background enrichment | not implemented | Sprint 20 |

## Related

- Law module engine: [`../01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md`](../01-architecture/LAW_MODULE_ENGINE_ARCHITECTURE.md)
- Speed + streaming: [`../04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md`](../04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md)
- Knowledge graph (deterministic facts): planned in Sprint 32.
