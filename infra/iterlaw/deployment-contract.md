# IterLaw — Deployment Contract

## Scope

This document is the source of truth for which workloads run in the
`iterlaw-ai` namespace, how they are exposed, and how they are deployed. It
does not authorise any deployment. Deploys are gated on an explicit operator
action.

## Workloads

### Namespace `iterlaw-ai` (application)

| Workload                | Kind        | Exposure       | Image tag                          |
| ----------------------- | ----------- | -------------- | ---------------------------------- |
| `legal-orchestrator`    | Deployment  | ClusterIP only | `iterlaw/legal-orchestrator:local` |
| `synthesis-worker`      | Deployment  | None (internal)| `iterlaw/synthesis-worker:local`   |
| `synthesis-redis`       | StatefulSet | ClusterIP only | `redis:7-alpine`                   |
| `iterlaw-web`           | Deployment  | Ingress        | `iterlaw/web:local`                |

### Namespace `iterlaw-data` (database)

| Workload                       | Kind        | Exposure       | Image tag           |
| ------------------------------ | ----------- | -------------- | ------------------- |
| `iterlaw-postgres`             | StatefulSet | ClusterIP only | `postgres:16-alpine`|
| `iterlaw-postgres-backup`      | CronJob     | None           | `postgres:16-alpine`|

No other workload is allowed in either namespace.

## Apply order

1. `k8s/iterlaw-data/namespace.yaml`
2. `k8s/iterlaw-data/resourcequotas.yaml`
3. `k8s/iterlaw-data/limitranges.yaml`
4. `k8s/iterlaw-data/rbac.yaml`
5. `k8s/iterlaw-data/secrets/` (operator-supplied SealedSecrets)
6. `k8s/iterlaw-data/postgres/`
7. `k8s/iterlaw-data/backups/`
8. `k8s/iterlaw/namespace.yaml`
9. `k8s/iterlaw/serviceaccount.yaml`
10. `k8s/iterlaw/rbac.yaml`
11. `k8s/iterlaw/resourcequotas.yaml`
12. `k8s/iterlaw/limitranges.yaml`
13. `k8s/iterlaw/secrets/` (operator-supplied SealedSecrets)
14. `k8s/iterlaw/redis/`
15. `k8s/iterlaw/synthesis-worker/`
16. `k8s/iterlaw/legal-orchestrator/`
17. `k8s/iterlaw/wasm-rule-runner/` (ConfigMap assets consumed by `legal-orchestrator`)
18. `k8s/iterlaw/web/`

`scripts/infra/deploy-iterlaw-k3s.sh` applies these in order, but only when
invoked manually by an operator. CI must not run it.

## Build & load

1. `scripts/infra/build-iterlaw-images.sh` builds the three images locally.
   Nothing is pushed to a registry by default.
2. `scripts/infra/load-iterlaw-images-k3s.sh` loads the local images into
   the K3s containerd shim via `k3s ctr images import`.

## Rollback

`scripts/infra/rollback-iterlaw-k3s.sh` reverts each Deployment to its
previous ReplicaSet via `kubectl rollout undo`. It does not touch the
StatefulSet (Redis) — Redis rollbacks are manual.

## Verification

`scripts/infra/verify-iterlaw-cluster.sh` reports the live cluster state
without modifying anything. Output classes:

- `PASS` — the expected object exists and matches the contract.
- `FAIL` — the object exists but disagrees with the contract.
- `NOT DEPLOYED` — the object does not exist (acceptable pre-deploy).
- `NOT EXECUTED` — the check could not run (e.g. no `kubectl` context).
