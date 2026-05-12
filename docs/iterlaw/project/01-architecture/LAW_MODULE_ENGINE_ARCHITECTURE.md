# Law Module Engine Architecture

How IterLaw represents a law area as a structured engine of categories, sections, cached answers, and a generation queue, so most user questions hit a pre-built answer rather than a fresh LLM call.

**Status:** target architecture. Not implemented today. See `ROADMAP_REMAINING_SPRINTS.md` (Sprints 18–25).

## Mental model

A **law module** = country × law domain (e.g. "UK Employment").

Inside one law module the engine has four concentric layers:

```
              ┌────────────────────────────┐
              │  module_qa_cache (Tier 1)  │  ← pre-built Q&A
              ├────────────────────────────┤
              │   law_section_modules      │  ← addressable sections
              ├────────────────────────────┤
              │   law_category_modules     │  ← topic groupings
              └────────────────────────────┘
                          ↑
              answer_generation_queue       ← background work
```

## `law_category_modules`

Top-level topic groupings inside one module.

Example for UK Employment: "Dismissal", "Discrimination", "Pay & deductions", "Working time", "Holiday & leave", "Transfer (TUPE)", "Whistleblowing", "Redundancy".

Each row carries:

- `category_id`
- `module_id` (FK → `platform_modules`)
- `code` (e.g. `dismissal`)
- `display_name`
- `description`
- `parent_category_id` (nullable; supports subcategories)
- `status` (`draft` / `published` / `deprecated`)

Used for navigation, dashboard grouping, and to constrain semantic search ("answer this question within Dismissal").

## `law_section_modules`

Addressable law-section references. A section is a citable, plain-English unit:

- `section_id`
- `module_id`
- `category_id`
- `act_name` (e.g. "Employment Rights Act 1996")
- `section_ref` (e.g. "s.98")
- `jurisdiction`
- `effective_from`, `effective_to`
- `full_text` (verbatim)
- `plain_english` (rewritten, cited)
- `tags` (string array — e.g. `["unfair_dismissal", "qualifying_period"]`)
- `verification_status` (`unverified` / `auto_generated` / `human_reviewed` / `solicitor_approved`)
- `last_verified_at`
- `source_document_id` (FK → `legal_documents`)

A section is referenced like `ERA 1996 s.98`. The plain-English rewrite is the citable "what the law says, in human language" block used by retrieval Tier 2 (see `MULTI_TIER_RETRIEVAL_ARCHITECTURE.md`).

Important: a section is **never displayed as final** if `verification_status = 'unverified'`. Human reviewers (Sprint 50 approval queue) move sections to `auto_generated` → `human_reviewed` → `solicitor_approved` over time.

## `module_qa_cache`

Pre-built question / answer pairs.

- `qa_id`
- `module_id`
- `category_id`
- `question_text`
- `question_fingerprint` (deterministic hash)
- `question_embedding` (pgvector)
- `answer_text` (cited)
- `citation_chunk_ids` (string array)
- `cited_section_ids` (string array — FKs into `law_section_modules`)
- `confidence_score` (0.0–1.0)
- `verification_status`
- `created_at`, `last_validated_at`
- `serve_count`, `last_served_at`

Two retrieval modes:

- **Tier 0** (Redis): exact hash on `question_fingerprint`.
- **Tier 1** (Postgres + HNSW): semantic similarity on `question_embedding`.

Direct-serve threshold around **0.92** similarity; near-miss window **0.80 – 0.91** routes to the generation queue so the cache learns over time.

## `answer_generation_queue`

Background queue that pre-builds and validates Q&A cache rows.

- `job_id`
- `module_id`
- `question_text`
- `question_fingerprint`
- `trigger` (`near_miss` / `nightly_prebuild` / `operator_seed` / `corpus_change`)
- `status` (`pending` / `running` / `succeeded` / `failed` / `needs_review`)
- `attempt_count`, `last_attempt_at`
- `qa_id_result` (FK → `module_qa_cache`; nullable until success)
- `failure_reason`

Worker loop:

1. Pull next `pending` job.
2. Run the standard retrieval → bounded LLM → citation gate pipeline.
3. On success: write to `module_qa_cache` with `verification_status = 'auto_generated'`.
4. On failure: write to `failed` and either retry on schedule or escalate to the human approval queue.

The worker uses the **same** local LLM gateway the live answer path uses — the only difference is the trigger source (background queue, not user request).

## Nightly pre-builder

A scheduled job (nightly + on corpus update) enqueues:

- High-frequency user questions that missed the cache.
- A standing list of canonical questions per category.
- Re-validation of cache rows older than the staleness threshold (e.g. 90 days).

Pre-built rows allow most repeat user questions to land at Tier 0 / Tier 1 with no LLM call.

## Near-miss queue (0.80 – 0.91)

When a user question hits a semantic similarity in this band:

- Serve the closest existing answer **only if** confidence is high enough; otherwise refuse.
- In either case, enqueue a new generation job so the gap fills over time.

The exact direct-serve threshold and the near-miss window are tunable per module.

## Direct-serve threshold (around 0.92)

Above this threshold the cached answer is served directly, **with** an integrity check:

- Re-run the citation gate against the current corpus (chunk ids must still resolve).
- If any citation no longer resolves → invalidate the cache row and route to the generation queue.

This keeps cache hits safe when the underlying corpus changes.

## Section-row content rules

Every `law_section_modules` row carries:

- `act_name` — verbatim statute / regulation name.
- `section_ref` — addressable reference (e.g. `s.98`, `reg.4`).
- `full_text` — the verbatim section text from `legal_documents`.
- `plain_english` — the rewritten human-language summary.
- `tags` — topic tags used by retrieval Tier 2.
- `jurisdiction` — country code.
- `effective_from`, `effective_to` — temporal validity (matches `legal_chunks.effective_date` / `applicable_to`).
- `verification_status` — see above.

**No claim of "already implemented".** These rows are part of the target architecture (Sprints 18–25).

## What this module engine replaces

- The current single-pass retrieve-then-LLM pipeline.
- Re-asking the LLM the same question twice.
- Citation-by-LLM-memory (the section model lets us cite by stable id).

## What this module engine does NOT do

- It does not replace the citation gate. Every cache row's citations are re-verified before serve.
- It does not replace the human approval queue. Low-confidence and amendments still escalate.
- It does not allow cross-module reuse of sections / cache rows. Each `(country, module)` has its own engine.

## Dependencies on other docs

- Multi-tier retrieval flow: [`../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md`](../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md)
- Speed-first retrieval roadmap: [`../04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md`](../04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md)
- Approval queue / amendment review: [`SUPREME_CONTROLLER_ARCHITECTURE.md`](SUPREME_CONTROLLER_ARCHITECTURE.md)
- DB shape (current vs target): [`../02-database/DATABASE_SUMMARY.md`](../02-database/DATABASE_SUMMARY.md)
