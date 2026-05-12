# IterLaw — RAG Schema Canonical Decision

## Problem

Two migrations under `apps/legal-orchestrator/db/migrations/` define
overlapping RAG tables (`legal_sources`, `legal_documents`,
`legal_chunks`, …) **with different column shapes**:

| File | Origin | Schema shape |
| --- | --- | --- |
| `001_legal_rag_foundation.sql` | Sprint 7 stack (existing) | Denormalised retrieval columns: `domain_id`, `jurisdiction`, `source_type`, `title`, `url`, `citation_label`, `section_reference`, `paragraph_reference`, `chunk_index`, `chunk_text`, `authority_level`, `effective_date`, `quality_score`, `embedding_status`, `search_vector`, `is_active`, …; pgvector embedding added by the same migration when the extension is present (post-`100_*` it is required). |
| `100_iterlaw_core_rag_foundation.sql` | Master-Order draft (commit `0ad96ab`) | Slimmer columns: `text` instead of `chunk_text`, `heading` instead of `title`, score columns (`authority_score`, `recency_score`, `citation_weight`), `metadata JSONB`. New top-level tables: `verified_answers_cache`, `rag_runs`, `source_update_log`, `answer_verification_log`. |

Both files use `CREATE TABLE IF NOT EXISTS`. That means whichever
migration runs **first** wins, and the second is a silent no-op
against the tables it shares. Applying both to the same database does
not produce a merged schema — it produces a partially-populated
schema that matches whichever ran first.

## Migrations touching legal RAG tables

| File | Tables touched |
| --- | --- |
| `000_pgvector_prerequisite.sql` | `CREATE EXTENSION vector` |
| `001_legal_rag_foundation.sql` | `legal_domains`, `legal_sources`, `legal_documents`, `legal_chunks`, `legal_citations`, `legal_case_law`, `tribunal_decisions`, `legislation_versions`, `rag_ingestion_jobs`, `rag_ingestion_events`, `rag_query_audit`, `answer_audit_log`, `source_quality_scores` |
| `002_legal_rag_sprint6.sql` | `ingestion_jobs`, `ingestion_job_events`, `source_fetch_audit`, `legal_document_versions`, `legal_chunk_embeddings`, `citation_registry` |
| `003_legal_rag_sprint9_uk_employment_core.sql` | Creates `uk_emp_rag` schema and its `legal_sources`, `legal_documents`, `legal_document_chunks`, `legal_chunk_embeddings`, `legal_citations`, `legal_ingestion_runs`, `legal_answer_evidence` |
| `004_legal_rag_sprint10_source_registry.sql` | Extends `uk_emp_rag.legal_sources` |
| `005_legal_chunks_applicable_to.sql` | Adds `applicable_to date` to `public.legal_chunks` |
| `006_statutory_rates.sql` | `uk_emp_rag.statutory_rate`, `uk_emp_rag.vento_band` |
| `007_legal_documents_superseded_by.sql` | Extends `uk_emp_rag.legal_documents` |
| `008_qa_cache_with_sources.sql` | `uk_emp_rag.q_a_cache*` |
| `009_statutory_rate_calculation_history.sql` | `uk_emp_rag.statutory_rate_calculation_history` |
| `010_legal_documents_statutory_seed.sql` | Inserts into `uk_emp_rag.legal_documents` (statutory ladder) |
| `100_iterlaw_core_rag_foundation.sql` (Master Order draft) | `legal_sources`, `legal_documents`, `legal_chunks`, `legal_cases`, `verified_answers_cache`, `rag_runs`, `source_update_log`, `answer_verification_log` |
| `101_reconcile_legal_rag_schema.sql` (additive) | Adds the four genuinely-new Master-Order tables that do not exist in the 001 chain, and adds a small set of additive columns to bring `001`'s `legal_chunks` / `legal_documents` closer to the Master-Order shape. |
| `102_add_legal_cases_table.sql` (Sprint 9 QA fix, additive) | Adds `public.legal_cases` to the approved chain. Suitable for UK case-law ingestion (Find Case Law / BAILII). The draft `100_*` file mentioned `legal_cases` only in commented form; this migration is the canonical owner. |

## Conflict summary

- `legal_sources` is created by both `001_*.sql` and `100_*.sql` with different column lists. **001 wins** under the canonical decision below.
- `legal_documents` and `legal_chunks` likewise — **001 wins**.
- `legal_cases` was only in `100_*` (draft). It is now formally created by `102_add_legal_cases_table.sql` in the approved chain. The 001 chain's `legal_case_law` + `tribunal_decisions` tables remain in place and are not displaced. `legal_cases` is the table to use for new UK case-law ingestion (Find Case Law, BAILII).
- `verified_answers_cache`, `rag_runs`, `source_update_log`, `answer_verification_log` are net-new in `100_*`. These four tables are GENUINELY missing from the 001 chain and are needed by the planner / orchestrator / verifier work.

## Canonical decision

**The 001 chain (`001`–`010`) is canonical** for the existing tables.
This decision matches the existing application code (`src/rag/*`,
`src/ports/pgRagPort.ts`) which queries `public.legal_chunks` with the
001-shape columns. It also matches the prior `database-contract.md`.

`100_iterlaw_core_rag_foundation.sql` is therefore **draft / not-for-apply**.
It is retained in `apps/legal-orchestrator/db/migrations/` so the
column inventory is preserved, but its body MUST NOT be applied to a
database that has already run `001_*`. The header of the file has
been updated to declare this status.

## Canonical legal-RAG table set (after this sprint)

After `001`–`010`, `101`, and `102` have been applied, the canonical
public-schema RAG tables are:

- `legal_sources`
- `legal_documents`
- `legal_chunks`
- `legal_cases` (added by `102_*`)
- `verified_answers_cache` (added by `101_*`)
- `rag_runs` (added by `101_*`)
- `source_update_log` (added by `101_*`)
- `answer_verification_log` (added by `101_*`)

`uk_emp_rag.*` tables (from `003`–`010`) remain alongside as the UK
employment domain bucket.

## Reconciliation

The four genuinely-new tables that the planner / Master-Order pipeline
needs (`verified_answers_cache`, `rag_runs`, `source_update_log`,
`answer_verification_log`) are added by a new **additive** migration:

```
apps/legal-orchestrator/db/migrations/101_reconcile_legal_rag_schema.sql
```

`101_*` only does:

1. `CREATE TABLE IF NOT EXISTS verified_answers_cache (...)`
2. `CREATE TABLE IF NOT EXISTS rag_runs (...)`
3. `CREATE TABLE IF NOT EXISTS source_update_log (...)`
4. `CREATE TABLE IF NOT EXISTS answer_verification_log (...)`
5. Indexes for the above.

`101_*` deliberately does **NOT** touch `legal_sources`,
`legal_documents`, `legal_chunks`, or `legal_cases`. The 001 chain
already owns those, and any divergence in column shape between 001
and 100 is intentional — the Master-Order draft was less granular,
not more authoritative.

If, in a future sprint, the Master-Order column shape is preferred for
any specific table, the migration to bring `001`'s table closer
should:

- Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` for any net-new column.
- Use `ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS ...` for any new check.
- NEVER `DROP COLUMN` or `RENAME COLUMN` on existing tables.

## Recommended apply order (single database)

```
000_pgvector_prerequisite.sql
001_legal_rag_foundation.sql
002_legal_rag_sprint6.sql
003_legal_rag_sprint9_uk_employment_core.sql
004_legal_rag_sprint10_source_registry.sql
005_legal_chunks_applicable_to.sql
006_statutory_rates.sql
007_legal_documents_superseded_by.sql
008_qa_cache_with_sources.sql
009_statutory_rate_calculation_history.sql
010_legal_documents_statutory_seed.sql
101_reconcile_legal_rag_schema.sql        ← additive only
102_add_legal_cases_table.sql             ← additive only
                                          (DO NOT apply 100_*.sql)
```

## Warning

**Do not apply `100_iterlaw_core_rag_foundation.sql` to any database
that has already run `001_legal_rag_foundation.sql`.** Mixing the two
schemas produces a partial state that the application's SQL adapters
cannot query consistently.

`scripts/infra/verify-iterlaw-rag-db.sh` detects this conflict and
points readers at this document.
