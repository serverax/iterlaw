# IterLaw — Database Contract

## Where the database runs

| Facet              | Value                                                   |
| ------------------ | ------------------------------------------------------- |
| Namespace          | `iterlaw-data` (NEVER `iterlaw-ai`)                     |
| Workload           | `iterlaw-postgres` (StatefulSet)                        |
| Service            | `iterlaw-postgres` (ClusterIP, headless)                |
| Internal DNS       | `iterlaw-postgres.iterlaw-data.svc.cluster.local:5432`  |
| Image              | `postgres:16-alpine`                                    |
| Database           | `iterlaw`                                               |
| Schema             | `uk_emp_rag`                                            |
| Storage            | `volumeClaimTemplates` PVC, default StorageClass        |

`postgres:16-alpine` is allowed **only** under `k8s/iterlaw-data/`. The
verifier rejects any `image: postgres:` reference under `k8s/iterlaw/`.

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
