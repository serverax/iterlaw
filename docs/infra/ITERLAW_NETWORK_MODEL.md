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
|   +-------------+        +-----------+------------+      |
|                                       |                   |
|                                       | Redis Streams     |
|                                       v                   |
|                          +------------------------+       |
|                          | synthesis-redis        |       |
|                          |   :6379, ClusterIP     |       |
|                          +------------+-----------+       |
|                                       ^                   |
|                                       | Redis Streams     |
|                                       |                   |
|                          +------------------------+       |
|                          | synthesis-worker       |       |
|                          |   (no inbound)         |       |
|                          +------------+-----------+       |
|                                       | optional egress   |
|                                       v                   |
|                          INTERNAL_MODEL_ENDPOINT          |
|                          (in-cluster only)                |
+----------------------------------------------------------+
```

## NetworkPolicy summary

| Workload              | Ingress allowed from                       | Egress allowed to                              |
| --------------------- | ------------------------------------------ | ---------------------------------------------- |
| `iterlaw-web`         | Any namespace (ingress controller)         | `legal-orchestrator:3012`, DNS                 |
| `legal-orchestrator`  | `iterlaw-web` only                         | `synthesis-redis:6379`, DNS                    |
| `synthesis-worker`    | label `iterlaw.metrics-scraper=true` only  | `synthesis-redis:6379`, DNS, optional model EP |
| `synthesis-redis`     | `legal-orchestrator`, `synthesis-worker`   | DNS only                                       |

## What is reachable from the public internet

- `iterlaw-web` via the Ingress only.

## What is NOT reachable from the public internet

- `legal-orchestrator` (ClusterIP).
- `synthesis-worker` (headless ClusterIP, no public ports).
- `synthesis-redis` (headless ClusterIP).
- The internal model endpoint, if configured.

## Egress to LLM providers

There is none. Neither the orchestrator nor the worker is permitted to
reach a public-internet LLM provider. The synthesis-worker's optional
model endpoint must resolve to a cluster-local Service.

## Verification

`scripts/infra/verify-iterlaw-cluster.sh` reports the Service type for
`synthesis-redis` and `synthesis-worker`, and refuses to pass if either is
exposed as `LoadBalancer` or `NodePort`.
