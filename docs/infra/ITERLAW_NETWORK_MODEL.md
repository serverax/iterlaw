# IterLaw — Network Model

## ⚠ CNI enforcement caveat

The NetworkPolicy manifests under `k8s/iterlaw/**` and `k8s/iterlaw-data/**`
are written for a policy-capable CNI. **They are not guaranteed to be
enforced on the current K3s cluster.**

Current observed cluster state (from `kubectl -n kube-system get ds`):

```
coredns
local-path-provisioner
metrics-server
traefik
svclb-traefik
```

No `cilium`, `calico`, or `kube-router` DaemonSet is present. K3s defaults
to a minimal CNI (Flannel-based) that does **not** enforce
`networking.k8s.io/v1` NetworkPolicy. Until a policy-capable CNI is
installed, every NetworkPolicy in this repo is best treated as
**advisory documentation** — Kubernetes will accept the manifest, but
pods will still be reachable across the namespaces unless an
out-of-cluster firewall blocks them.

### Required before relying on pod-level isolation

Install either:

- **Cilium** (recommended for IterLaw scale, supports L7 policies),
- **Calico** (mature, well-documented), or
- **kube-router**.

Installation is **out of scope** of this repository. After the chosen
CNI is in place, `scripts/infra/verify-iterlaw-cluster.sh` will report
`PASS policy-capable CNI detected`. Until then it reports `WARN
NetworkPolicy may not be enforced`.

### What still works without a policy CNI

- Service type enforcement (`ClusterIP`-only, no NodePort/LoadBalancer)
  — done by the kube-apiserver, independent of the CNI.
- Ingress-controller routing — Traefik on K3s already routes only what
  the Ingress object declares.
- Pod-Security baseline/restricted labels on namespaces — enforced by
  the kube-apiserver admission controller, independent of the CNI.
- Read-only root filesystem, dropped capabilities, non-root user —
  enforced by the kubelet, independent of the CNI.

### What does NOT work without a policy CNI

- The per-workload `NetworkPolicy` objects (e.g. "only legal-orchestrator
  may reach iterlaw-postgres on 5432").
- The `synthesis-worker → ordinox-ai/ollama:11434` egress restriction.
- The blanket "no public egress" pattern for any pod.

Treat the NetworkPolicy files as a contract that becomes load-bearing
once the CNI is installed. Do not delete them.

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
