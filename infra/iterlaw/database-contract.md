# IterLaw — Database Contract

## Where the database runs

| Facet              | Value                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| Namespace          | `iterlaw-data` (NEVER `iterlaw-ai`)                                   |
| Workload           | `iterlaw-postgres` (StatefulSet)                                       |
| Service            | `iterlaw-postgres` (ClusterIP, headless)                              |
| Internal DNS       | `iterlaw-postgres.iterlaw-data.svc.cluster.local:5432`                |
| StatefulSet image  | `pgvector/pgvector:pg16` (Debian-based, ships the `vector` extension) |
| Backup CronJob image | `postgres:16-alpine` (pg_dump only; pgvector not needed)            |
| Database           | `iterlaw`                                                             |
| Storage            | `volumeClaimTemplates` PVC, default StorageClass                      |

`pgvector/pgvector:pg16` is required for the StatefulSet — pgvector is
**mandatory** for IterLaw RAG (see `Schemas` below). The backup CronJob
still runs `postgres:16-alpine` because `pg_dump` does not need the
`vector` extension. Any `image: postgres:` reference outside
`k8s/iterlaw-data/` is rejected by the repo verifier.

## Schemas

IterLaw uses **two coexisting schemas** in the same `iterlaw` database.
They are not aliases of each other; they have different shapes and
different purposes.

### `public.*` — runtime RAG retrieval schema (migrations 001, 002, 005)

The denormalised retrieval tables that the orchestrator's SQL adapters
query directly. Carries the columns needed for FTS + temporal +
authority-ranked queries:

| Table                       | Purpose                                                       |
| --------------------------- | ------------------------------------------------------------- |
| `public.legal_domains`      | Domain registry (e.g. `uk_employment_england_wales`).         |
| `public.legal_sources`      | Upstream source catalogue.                                    |
| `public.legal_documents`    | Imported / scraped documents.                                 |
| `public.legal_chunks`       | RAG-ready text chunks. Hot retrieval path. Has `search_vector`, `applicable_to`, `authority_level`, `embedding vector(1536)`, etc. |
| `public.legal_citations`    | Citation rows for answer formatting.                          |
| `public.rag_query_audit`    | Per-request audit (RAG retrieval results).                    |
| `public.answer_audit_log`   | Per-answer audit log.                                         |
| `public.source_fetch_audit` | Source-fetch history (this replaces what was previously called `source_freshness` in earlier drafts — same role, current name). |
| `public.ingestion_jobs`     | Long-running ingestion jobs.                                  |
| `public.legal_chunk_embeddings` | Sidecar embeddings (jsonb fallback before pgvector was added inline on `legal_chunks`). |

The runtime adapters `apps/legal-orchestrator/src/rag/postgresRetrieval.ts`
and `apps/legal-orchestrator/src/ports/pgRagPort.ts` query
`FROM legal_chunks c` (unqualified → resolves to `public.legal_chunks`)
intentionally. This is the canonical runtime retrieval table.

### `uk_emp_rag.*` — UK employment law domain slice (migrations 003, 006–010)

Domain-specific tables that record UK employment law specifics. **Not**
queried by the runtime RAG adapter — they store statutory rates, Vento
bands, Q&A cache, answer evidence trails, and superseded-by version
links. They have a different (simpler) chunk shape:

| Table                                                | Purpose                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `uk_emp_rag.legal_sources`                           | UK-employment source registry (canonical source-registry for this domain — there is no separate `legal_source_registry` table). |
| `uk_emp_rag.legal_documents`                         | UK-employment documents with `status` + `superseded_by` tracking (migration 007).                    |
| `uk_emp_rag.legal_document_chunks`                   | Domain-slice chunks (simpler shape: no `domain_id`/`jurisdiction`/`authority_level`/`search_vector`). |
| `uk_emp_rag.legal_chunk_embeddings`                  | Domain-slice embedding store (pgvector or jsonb fallback).                                           |
| `uk_emp_rag.legal_citations`                         | Domain-slice citations.                                                                              |
| `uk_emp_rag.statutory_rate`                          | Rates per `effective_from` window (NMW, statutory redundancy, etc.).                                  |
| `uk_emp_rag.vento_band`                              | Vento injury-to-feelings bands per `effective_from`.                                                  |
| `uk_emp_rag.q_a_cache` + `uk_emp_rag.q_a_cache_sources` | Idempotent answer cache with source links.                                                           |
| `uk_emp_rag.statutory_rate_calculation_history`      | Audit of statutory-rate calculations.                                                                |
| `uk_emp_rag.legal_answer_evidence`                   | Evidence trail per generated answer.                                                                  |

The domain-slice tables do NOT replace the runtime tables. Attempting
to project `uk_emp_rag.legal_document_chunks` as a compatibility view
named `public.legal_chunks` is **not safe**: the runtime adapter needs
columns (`domain_id`, `jurisdiction`, `source_type`, `authority_level`,
`applicable_to`, `search_vector`, `is_active`) that do not exist in the
domain-slice table and cannot be fabricated.

## Tables

The migration set in `apps/legal-orchestrator/db/` is the source of truth
for table definitions. Canonical extension points for the UK employment
domain:

- `uk_emp_rag.legal_documents` (with `superseded_by` link)
- `uk_emp_rag.legal_document_chunks`
- `uk_emp_rag.legal_chunk_embeddings`
- `uk_emp_rag.statutory_rate`

## Tables

The migration set in `apps/legal-orchestrator/db/` (existing) is the source
of truth for table definitions. The canonical set:

- `uk_emp_rag.legal_documents`
- `uk_emp_rag.legal_document_chunks`
- `uk_emp_rag.legal_chunk_embeddings`
- `uk_emp_rag.statutory_rate`

## Connection model

Only `legal-orchestrator` is allowed to open Postgres connections.

- The DSN lives in `iterlaw-db-secret` (SealedSecret in `iterlaw-ai`).
- The orchestrator references it as
  `DATABASE_URL_FROM_SECRET → secretKeyRef[iterlaw-db-secret/DATABASE_URL]`.
- `iterlaw-web` and `synthesis-worker` MUST NOT carry any database env
  variable. The verifier enforces this by grepping for `DATABASE_URL`,
  `iterlaw-postgres`, and `iterlaw-db-secret` under each workload's
  manifest directory.

## NetworkPolicy

Ingress to `iterlaw-postgres` on 5432 is permitted from:

1. Pods in `iterlaw-ai` labelled `app=legal-orchestrator`.
2. The in-namespace backup CronJob (`app.kubernetes.io/name=iterlaw-postgres-backup`).

All other traffic is denied. There is no public exposure — no `NodePort`,
no `LoadBalancer`.

## Credentials

| SealedSecret                                | Keys                                       |
| ------------------------------------------- | ------------------------------------------ |
| `iterlaw-postgres-credentials`              | `POSTGRES_USER`, `POSTGRES_PASSWORD`       |
| `iterlaw-postgres-replication-credentials`  | placeholder (no current consumer)          |

Plaintext credentials are forbidden anywhere in this repository, and the
repo verifier rejects `kind: Secret` manifests under either k8s tree.

## Backups

- Nightly `pg_dump` (schema `uk_emp_rag`) via the `iterlaw-postgres-backup`
  CronJob.
- Output is gzipped SQL written to a dedicated 20 Gi PVC.
- **Restore is manual.** See `k8s/iterlaw-data/backups/README.md`.
- Retention is manual. The CronJob does not delete old dumps.

## Migrations

Migrations live in `apps/legal-orchestrator/db/` and run from
`legal-orchestrator` startup hooks. There is no separate "migration
runner" workload. Destructive SQL is forbidden in CI; migrations must be
additive (new columns/tables, never drops without a documented review).
