# apps/legal-orchestrator/db

SQL migrations for the OrdinoxAI legal RAG schema.

## Status

**This directory contains migration FILES ONLY. No migration has been
applied to any database from this repository.** The schema must be
executed manually by an operator with credentials.

## Files

```
migrations/
  001_legal_rag_foundation.sql   13 tables + indexes + safe seed (domain only)
```

## Tables created by 001

| Table | Purpose |
|---|---|
| `legal_domains` | One row per practice-area + jurisdiction (e.g. `uk_employment_law`). |
| `legal_sources` | Upstream sources (statutes, guidance, cases). |
| `legal_documents` | Versioned documents per source. |
| `legal_chunks` | Searchable RAG units + denormalised metadata + tsvector. |
| `legal_citations` | Stable citation labels referencing chunks. |
| `legal_case_law` | Case metadata (ET + EAT base). |
| `tribunal_decisions` | ET-specific fields (region, panel, etc.). |
| `legislation_versions` | In-force-on versions of statutes. |
| `rag_ingestion_jobs` | One row per ingestion run. |
| `rag_ingestion_events` | Granular per-event log within a job. |
| `rag_query_audit` | Audit of every RAG search. |
| `answer_audit_log` | Audit of every generated answer (incl. failed ones). |
| `source_quality_scores` | Solicitor + auto quality scores per source. |

## How to apply (operator-only, not done automatically)

```bash
# Apply directly via psql (one-shot, idempotent):
psql "$DATABASE_URL" -f apps/legal-orchestrator/db/migrations/001_legal_rag_foundation.sql

# Or inside a K3s postgres pod:
kubectl -n ordinox-ai exec -i deploy/postgres-pgvector -- \
  psql -U ordinox_legal -d ordinox_legal_ai \
  < apps/legal-orchestrator/db/migrations/001_legal_rag_foundation.sql
```

The migration is **idempotent** — every CREATE uses `IF NOT EXISTS`,
INSERTs use `ON CONFLICT DO NOTHING`, and triggers are dropped + recreated.
Safe to run repeatedly.

## pgvector

The migration creates the schema regardless of pgvector availability.
The optional embedding column + IVFFlat index are added inside a guarded
`DO $$ ... $$` block that checks `pg_extension` for `vector`. To enable
vector search later:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
\i 001_legal_rag_foundation.sql   -- re-run; idempotent
```

## What this migration does NOT do

- Does not enable Row-Level Security. Add via a separate migration if
  needed; defaults are safe (no public read).
- Does not insert real scraped law content.
- Does not create database users / roles.
- Does not configure pgvector (only uses it if already enabled).
- Does not execute against any cluster from this repo — agent + CI run
  scripts must invoke `psql` explicitly.

## Verification queries after applying

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'legal\_%' ESCAPE '\\' ORDER BY table_name;

SELECT domain_code, jurisdiction FROM legal_domains;
SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') AS pgvector_installed;
```
