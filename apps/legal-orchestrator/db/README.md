# apps/legal-orchestrator/db

SQL migrations for the OrdinoxAI legal RAG schema (UK employment first).

## Status

**This directory contains migration FILES ONLY.** Applying them to a database is an **operator** action (`psql`, migration runner, or cluster exec). Nothing here runs automatically from `npm test`.

## Files

Migrations are **numbered PostgreSQL `.sql` files only** (no `.ts` runners in
`db/migrations/`). Optional paired `*.down.sql` files roll back the matching
forward file. Static validation runs via `npm run validate:migrations` in
`apps/legal-orchestrator` (Vitest; no live DB).

### Sprint 10+ numbering (canonical forward chain excerpt)

| File | Role |
|------|------|
| `000_pgvector_prerequisite.sql` | Extension prerequisite. |
| `001`–`010`, `101_reconcile_legal_rag_schema.sql` | Core RAG + reconciliation (see `docs/iterlaw/RAG_SCHEMA_CANONICAL_DECISION.md`). |
| `102_add_legal_cases_table.sql` | Adds `public.legal_cases` (additive; no DROP). |
| *(no `103_*.sql`)* | **Reserved** for future GraphRAG foundation — see header in `104_user_workspace_foundation.sql`. |
| `104_user_workspace_foundation.sql` | Users / workspaces / members (tenant data). |
| `105_case_workspace.sql`, `106_enable_rls.sql` | Case workspace + RLS (see each file). |

**Draft:** `100_iterlaw_core_rag_foundation.sql` — **do not apply** (bannered draft).

```
migrations/
  001_legal_rag_foundation.sql   — Core domain, sources, documents, chunks,
                                   citations, case law, ingestion (rag_*),
                                   rag_query_audit, answer audit, pgvector
                                   guard on legal_chunks.embedding (optional).
  002_legal_rag_sprint6.sql      — Sprint 6: canonical ingestion_jobs,
                                   ingestion_job_events, source_fetch_audit,
                                   legal_document_versions, legal_chunk_embeddings,
                                   citation_registry; extends rag_query_audit;
                                   widens legal_sources.source_type CHECK;
                                   denormalised legal_domain + dates on
                                   sources/documents/chunks.
  002_legal_rag_sprint6.down.sql — Rollback for 002 only (restores 001 CHECK).
```

## Apply order

```bash
psql "$DATABASE_URL" -f apps/legal-orchestrator/db/migrations/001_legal_rag_foundation.sql
psql "$DATABASE_URL" -f apps/legal-orchestrator/db/migrations/002_legal_rag_sprint6.sql
```

## Rollback (002 only)

```bash
psql "$DATABASE_URL" -f apps/legal-orchestrator/db/migrations/002_legal_rag_sprint6.down.sql
```

## Sprint 6 table summary

| Table | Role |
|-------|------|
| `ingestion_jobs` | One row per ingestion run (fetch / bulk / reembed). |
| `ingestion_job_events` | Append-only events with HTTP status, checksum, errors. |
| `source_fetch_audit` | Per-URL fetch outcome, checksum, HTTP status, errors. |
| `legal_document_versions` | Version hash + publication / effective dates per document. |
| `legal_chunk_embeddings` | Embeddings per chunk + model; `embedding_bytea` always; optional `embedding vector(1536)` if pgvector. |
| `citation_registry` | Stable citation rows: exact URL, title, section/para, `accessed_at`. |

**Extended (001 tables):** `rag_query_audit` gains `retrieved_chunk_ids`, `ranking_scores`, `final_citation_ids`, `query_redacted`. `legal_sources`, `legal_documents`, `legal_chunks` gain `legal_domain`, date/check columns where listed in `002`.

## pgvector

002 adds `legal_chunk_embeddings.embedding vector(1536)` **only if** the `vector` extension exists. **IVFFlat/HNSW** is intentionally **not** created in 002 (empty tables often fail IVFFlat); create an appropriate index **after bulk load**.

## Static validation (CI / local)

```bash
cd apps/legal-orchestrator
npm run validate:migrations
```

This runs Vitest against the SQL files only (no live DB).

## What migrations do NOT do

- No scraping, no HTTP calls, no secrets.
- No Row-Level Security (add a later migration if required).
- No automatic execution from the Node HTTP server.
