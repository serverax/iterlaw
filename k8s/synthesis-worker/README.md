# k8s/synthesis-worker

Cluster manifests for the synthesis-queue Redis StatefulSet
described in [`docs/adr/004-internal-synthesis-worker.md`](../../docs/adr/004-internal-synthesis-worker.md)
§5 and §6.

## What's in this directory

| File | Purpose |
|---|---|
| `redis-configmap.yaml`     | Redis server config (AOF, MAXMEMORY, hardening) |
| `redis-service.yaml`       | ClusterIP service `synthesis-redis:6379` |
| `redis-statefulset.yaml`   | Single-replica StatefulSet + 5Gi PVC |
| `redis-networkpolicy.yaml` | Ingress: orchestrator + worker pods only. Egress: DNS only |
| `kustomization.yaml`       | Roll-up |

## What's deliberately **not** in this directory

- **The `synthesis-redis-credentials` Secret.** It is provided by a
  `SealedSecret` in the operator repo per ADR 004 §6. The single key
  consumed is `password`. Do not commit a placeholder Secret here.
- **The `iterlaw-ai` namespace.** Already declared by
  `k8s/legal-orchestrator/namespace.yaml`. Apply that base first.
- **The `synthesis-worker` Deployment.** ADR §10.3 follow-up ticket
  (not §10.3.b).
- **Orchestrator-side wiring (per-pod response-stream consumer,
  `/ready` extension).** ADR §10.3.c / §10.3.d, separate tickets.

## Namespace correction note

ADR 004 §6 refers to `iterlaw-prod` for the worker's SealedSecret
namespace. The shipped legal-orchestrator manifests run in
`iterlaw-ai` (`k8s/legal-orchestrator/namespace.yaml`). This Redis
StatefulSet runs in `iterlaw-ai` to be co-located with its only
clients (the orchestrator and the future synthesis-worker). The ADR
text should be reconciled in a follow-up doc revision.

## Apply order

The legal-orchestrator base must already be applied (so the
namespace + the labeled orchestrator pod exist). Then:

```
kubectl apply -k k8s/synthesis-worker/
```

The StatefulSet pod will refuse to become Ready until the
`synthesis-redis-credentials` Secret is present (the operator repo
provides it via SealedSecret). That is the intended sequencing —
applying the secret before the StatefulSet is fine; applying the
StatefulSet first leaves it pending until the secret lands.

## Verifying placement

```
kubectl -n iterlaw-ai get statefulset,svc,configmap,networkpolicy -l app=synthesis-redis
kubectl -n iterlaw-ai logs synthesis-redis-0 -c redis | head
```

## Tests

Static-text validation lives at
`apps/synthesis-worker/src/tests/redisManifest.test.ts` and runs
under the synthesis-worker package's `npm test` — see that test file
for the structural invariants enforced.
