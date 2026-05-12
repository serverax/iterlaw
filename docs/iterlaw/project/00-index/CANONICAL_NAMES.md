# Canonical Names + Namespaces

Authoritative list for the IterLaw project. Any deviation in active code, config, manifest, or documentation is a defect.

## Product names

| Name | Meaning |
| --- | --- |
| **IterLaw** | The legal AI platform / product. First beta: UK Employment Law. Used in runtime UI, config, package names, READMEs. |

Use **IterLaw** as the only active product / platform name. Any earlier branding (see "Forbidden / legacy" below) must not be reintroduced into active material.

## Forbidden / legacy

| Name | Status |
| --- | --- |
| **RightsNow** | **Forbidden** in active material. Legacy product name. Allowed only inside clearly marked legacy / disabled / archive material (`.github/workflows-disabled/`, `k8s/iterlaw-disabled-*`, `docs/CRUSER_*`, files that explicitly carry a "Legacy name: RightsNow" marker). Never re-introduce into active code. |
| Earlier platform-brand names | **Forbidden** in active material. Use **IterLaw** in active code / config / docs. Earlier names may remain only in legacy / disabled / archive material and in Kubernetes manifests whose namespace rename is tracked separately (the docs reflect manifest reality without endorsing the legacy naming). |

## Active Kubernetes namespaces

| Namespace | Purpose |
| --- | --- |
| `iterlaw-ai` | AI / orchestrator and user-facing AI workloads. |
| `iterlaw-rag` | RAG ingestion, retrieval, graph, reranking, source-processing workloads. |
| `iterlaw-api` | API gateway / backend APIs. |
| `iterlaw-monitoring` | Metrics, logs, dashboards, alerts. |
| `iterlaw-security` | Security scanners, policy controllers, secret controllers. |

Legacy `iterlaw-data` may remain in the data plane until safely retired.

## Forbidden namespaces

- `iterlaw-prod` — **do not create or reference.** Production-vs-non-production is signalled by cluster context, not namespace name.
- Bare `iterlaw` — **do not create.** Disabled standalone manifests live under `k8s/iterlaw-disabled-master-order/` and `k8s/iterlaw-disabled-standalone-legal-orchestrator/`.
- `rightsnow*` — forbidden alongside the product-name rule above.

## Where legacy references are allowed

Legacy `RightsNow` text is acceptable **only** inside:

- `.github/workflows-disabled/*` — historical CI files.
- `k8s/iterlaw-disabled-*/` — parked legacy manifests.
- `docs/CRUSER_*.md` — historical handoff documents.
- Any file carrying an explicit `Legacy name: RightsNow` marker.
- Policy / verifier files that list `rightsnow` as a forbidden token.
- Sprint changelog entries (e.g. "Sprint 9: rename RightsNow → IterLaw").

Active runtime code, active configs, active manifests, active READMEs, and the new project docs must use **IterLaw** only.

## Verification

Repository safety verifiers enforce this contract:

- `scripts/qa/verify-iterlaw-v3-safety.sh` — fails on `RightsNow` in active source.
- `scripts/infra/verify-iterlaw-repo.sh` — lists `rightsnow` as a forbidden token.
- `scripts/infra/verify-iterlaw-canonical-namespaces.sh` — asserts the five canonical namespaces and no bare `iterlaw`.

Run these before commits that touch naming-sensitive files.
