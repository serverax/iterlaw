# IterLaw — Infrastructure Summary

K3s-based deployment with five canonical namespaces. Operator-managed. No agent ever runs `kubectl apply`. Full operations procedure: [`../09-operations/OPERATIONS_RULES.md`](../09-operations/OPERATIONS_RULES.md).

## Cluster shape

| Layer | Component |
| --- | --- |
| Cluster | K3s (Hetzner-hosted in current operator setup; AKS context observed in earlier reviews — operator chooses) |
| Ingress | Traefik (per `k8s/iterlaw/web/ingress.yaml` annotations) |
| TLS | cert-manager **NOT YET WIRED** on the active ingress. Acceptable for `iterlaw.local`; FAIL for any non-`.local` host. Tracked as a Sprint 19 prerequisite. |
| Local LLM | Ollama service in `ordinox-ai` namespace at `ollama.ordinox-ai.svc.cluster.local:11434` (reached cross-namespace by synthesis-worker). |
| Data plane | `iterlaw-data` namespace — Postgres + pgvector StatefulSet, backups CronJobs, NetworkPolicies. |

## Canonical namespaces

| Namespace | Purpose |
| --- | --- |
| `iterlaw-ai` | Orchestrator and user-facing AI workloads. |
| `iterlaw-rag` | RAG ingestion, retrieval, graph, reranking workloads. |
| `iterlaw-api` | API gateway / backend APIs. |
| `iterlaw-monitoring` | Metrics, logs, dashboards, alerts. |
| `iterlaw-security` | Security scanners, policy controllers, secret controllers. |

Legacy `iterlaw-data` may remain. **Forbidden:** `iterlaw-prod`, bare `iterlaw`, `rightsnow*`.

## Pod security baseline (active manifests)

Every workload under `k8s/iterlaw/**` and `k8s/iterlaw-data/**` carries:

- `runAsNonRoot: true`
- `allowPrivilegeEscalation: false`
- `readOnlyRootFilesystem: true` (except Postgres data dir)
- `capabilities.drop: ["ALL"]`
- `seccompProfile.type: RuntimeDefault`
- `automountServiceAccountToken: false`
- `resources.requests` + `resources.limits` defined

This is asserted by `scripts/qa/verify-iterlaw-v3-safety.sh` and `scripts/infra/verify-iterlaw-repo.sh`.

## RBAC

Only namespace-scoped `Role` + `RoleBinding`. **Zero** `ClusterRole` / `ClusterRoleBinding` in active manifests.

## Image rules

- **No `:latest`** in any active deployable manifest. The previous violation under `k8s/legal-orchestrator/deployment.yaml` was archived to `k8s/iterlaw-disabled-standalone-legal-orchestrator/`.
- Production images must be **digest-pinned** (`@sha256:…`). Local-dev tags (`iterlaw/X:local`) are acceptable only for dev workflows.
- The backup uploader image is `ghcr.io/serverax/iterlaw-backup-uploader:REPLACE_ME_DIGEST_OR_TAG` — deliberately a placeholder until built and pushed (Sprint 12). Both `upload-cronjob.yaml` and `verify-cronjob.yaml` carry `iterlaw.io/status: "draft-not-applied"`.

## Forbidden runtime operations

- `kubectl apply -f <URL>` from any unpinned remote URL.
- `kubectl apply` from any source not authored by the operator.
- `helm install` of charts pulled at apply time.
- Direct image pulls of `:latest` tags.
- Use of the default `ServiceAccount` token on app pods.
- Public ingress without a TLS plan in the manifest.

## Storage Box + backup egress

The backup uploader egresses to the Hetzner Storage Box on SFTP port 23. `k8s/iterlaw-data/backups/upload-networkpolicy.yaml` currently carries `cidr: 0.0.0.0/0` with `iterlaw.io/policy-todo: "pin Storage Box /32 CIDR before apply"`. **Must be pinned before any apply.**

## Staging before production

No active manifest is applied to production without first:

1. A successful dev / staging apply, including `kubectl apply --dry-run=server` review.
2. Backup verifier `summary: PASS` (or PARTIAL with only documented WARNs).
3. The active kubectl context confirmed by the operator.
4. A snapshot of the affected resources taken.

The operator close-out checklists for Sprint 10 and Sprint 12 document the full procedure.

## What is currently green vs partial

| Surface | Status |
| --- | --- |
| Active manifest pod-security flags | PASS |
| Active manifest namespace correctness | PASS (after `iterlaw-prod` removal) |
| No `:latest` in active manifests | PASS (after archival of `k8s/legal-orchestrator/`) |
| Backup verifier | PARTIAL (1 WARN: Storage Box CIDR not yet pinned) |
| Image digest pinning | PENDING for the uploader image (Sprint 12) |
| Ingress TLS plan | PENDING (Sprint 19) |
| Live-cluster checks | NOT EXECUTED (operator rule: no kubectl reads against prod without explicit confirmation) |
