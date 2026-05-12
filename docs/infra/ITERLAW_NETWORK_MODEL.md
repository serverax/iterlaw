# IterLaw — Network Model

## Trust zones

```
+----------------------------+
|        Public internet     |
+-------------+--------------+
              |
              | Ingress (Traefik / nginx)
              v
+----------------------------+
| Cluster ingress namespace  |
+-------------+--------------+
              |
              v
+----------------------------------------------------------+
|                       iterlaw-ai                         |
|                                                          |
|   +-------------+        +------------------------+      |
|   | iterlaw-web | -----> | legal-orchestrator     |      |
|   |  (Deployment)        |   :3012, ClusterIP     |      |
|   +-------------+        +-----+------+-----------+      |
|                                |      |                   |
|                                |      | Redis Streams     |
|                                |      v                   |
|                                | +-----------------+      |
|                                | | synthesis-redis |      |
|                                | |   :6379, CIP    |      |
|                                | +--------+--------+      |
|                                |          ^                |
|                                |          | Redis Streams  |
|                                |          |                |
|                                | +-----------------+      |
|                                | | synthesis-worker|      |
|                                | |  (no inbound)   |      |
|                                | +--------+--------+      |
|                                |          | optional       |
|                                |          v                |
|                                | INTERNAL_MODEL_ENDPOINT   |
|                                | (in-cluster only)         |
+--------------------------------|--------------------------+
                                 |
            cross-NS NetworkPolicy| (Postgres on 5432)
                                 v
+----------------------------------------------------------+
|                      iterlaw-data                        |
|                                                          |
|                          +------------------------+      |
|                          | iterlaw-postgres       |      |
|                          |   :5432, ClusterIP     |      |
|                          +------------+-----------+      |
|                                       ^                   |
|                                       | nightly pg_dump   |
|                          +------------+-----------+       |
|                          | iterlaw-postgres-backup|       |
|                          |   (CronJob)            |       |
|                          +------------------------+       |
+----------------------------------------------------------+
```

## NetworkPolicy summary

| Workload              | Ingress allowed from                                                  | Egress allowed to                                                          |
| --------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `iterlaw-web`         | Any namespace (ingress controller)                                    | `legal-orchestrator:3012`, DNS                                             |
| `legal-orchestrator`  | `iterlaw-web` only                                                    | `synthesis-redis:6379`, `iterlaw-postgres:5432` (cross-NS), DNS            |
| `synthesis-worker`    | label `iterlaw.metrics-scraper=true` only                             | `synthesis-redis:6379`, DNS, optional model EP                             |
| `synthesis-redis`     | `legal-orchestrator`, `synthesis-worker`                              | DNS only                                                                   |
| `iterlaw-postgres`    | `legal-orchestrator` in `iterlaw-ai` only; backup CronJob in same NS  | DNS only                                                                   |

## What is reachable from the public internet

- `iterlaw-web` via the Ingress only.

## What is NOT reachable from the public internet

- `legal-orchestrator` (ClusterIP).
- `synthesis-worker` (headless ClusterIP, no public ports).
- `synthesis-redis` (headless ClusterIP).
- `iterlaw-postgres` (ClusterIP, in a separate namespace).
- The internal model endpoint, if configured.

## Database access policy

- Only `legal-orchestrator` may reach `iterlaw-postgres` on 5432.
  Enforced by the NetworkPolicy in `k8s/iterlaw-data/postgres/networkpolicy.yaml`,
  which selects ingress sources by `namespace=iterlaw-ai` AND
  `app=legal-orchestrator`.
- `iterlaw-web` MUST NOT carry database credentials.
- `synthesis-worker` MUST NOT carry database credentials and is not
  permitted by NetworkPolicy to reach `iterlaw-postgres`.

## Egress to LLM providers

There is none. Neither the orchestrator nor the worker is permitted to
reach a public-internet LLM provider. The synthesis-worker's optional
model endpoint must resolve to a cluster-local Service.

## Verification

`scripts/infra/verify-iterlaw-cluster.sh` reports the Service type for
`synthesis-redis` and `synthesis-worker`, and refuses to pass if either is
exposed as `LoadBalancer` or `NodePort`.
