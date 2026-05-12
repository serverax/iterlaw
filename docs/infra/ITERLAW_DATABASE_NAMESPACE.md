# IterLaw — Database Namespace

`iterlaw-data` is the dedicated namespace for IterLaw's PostgreSQL database
and its operational sidecars. It is intentionally separate from
`iterlaw-ai` so that database lifecycle (backups, upgrades, replication)
is decoupled from application-tier rollouts.

## Workloads

| Workload                       | Kind        | Exposure       | Image                  |
| ------------------------------ | ----------- | -------------- | ---------------------- |
| `iterlaw-postgres`             | StatefulSet | ClusterIP only | `postgres:16-alpine`   |
| `iterlaw-postgres-backup`     | CronJob     | None           | `postgres:16-alpine`   |
| `iterlaw-postgres-backup` PVC  | PVC         | n/a            | 20 Gi                  |

Nothing else runs in `iterlaw-data`.

## What is NOT allowed in `iterlaw-data`

- Application workloads (`iterlaw-web`, `legal-orchestrator`,
  `synthesis-worker`, `synthesis-redis`).
- Ollama or any LLM workload.
- Any workload that opens an inbound port to the public internet.

## What is NOT allowed in `iterlaw-ai`

- PostgreSQL. The verifier rejects any `image: postgres:` reference
  under `k8s/iterlaw/`.
- Database SealedSecrets for `iterlaw-postgres`.

## Connection topology

```
iterlaw-ai                              iterlaw-data
+----------------------+                +------------------------+
| legal-orchestrator   |  cross-NS NP   | iterlaw-postgres       |
|   uses DATABASE_URL  | -------------> |   :5432, ClusterIP     |
|   from iterlaw-db-   |                +-----------+------------+
|   secret             |                            ^
+----------------------+                            |
                                                    | nightly backup
                                                    |
                                          +-----------------------+
                                          | iterlaw-postgres-     |
                                          | backup (CronJob)      |
                                          +-----------------------+
```

`iterlaw-web` and `synthesis-worker` have **no** ingress rule on
`iterlaw-postgres`. The cross-namespace NetworkPolicy
(`k8s/iterlaw-data/postgres/networkpolicy.yaml`) selects only pods
labelled `app=legal-orchestrator` in `iterlaw-ai`.

## SealedSecrets

| Name (namespace = iterlaw-data)              | Keys                                       |
| -------------------------------------------- | ------------------------------------------ |
| `iterlaw-postgres-credentials`               | `POSTGRES_USER`, `POSTGRES_PASSWORD`       |
| `iterlaw-postgres-replication-credentials`   | placeholder; no current consumer           |

The DSN consumed by `legal-orchestrator` lives in
`iterlaw-db-secret` (namespace `iterlaw-ai`). That SealedSecret points at
`iterlaw-postgres.iterlaw-data.svc.cluster.local:5432`.

## Day-2 operations

- **Schema migrations:** run from `legal-orchestrator` startup hooks
  using migrations under `apps/legal-orchestrator/db/`.
- **Vacuum / analyse:** rely on Postgres autovacuum; no scheduled jobs
  are defined.
- **Backups:** nightly logical dump (see
  `k8s/iterlaw-data/backups/README.md`). Restore is manual.
- **Upgrade:** treat as a major operation. Drain orchestrator traffic
  first; restore from a backup if anything goes wrong.

## Forbidden

- `NodePort` / `LoadBalancer` exposure of `iterlaw-postgres`.
- Plaintext credentials anywhere in the repository.
- A second Postgres instance in `iterlaw-ai`.
- Direct DB access from `iterlaw-web` or `synthesis-worker`.
