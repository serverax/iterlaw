# IterLaw — K3s Deployment

## Cluster assumptions

- Single-node K3s (default Traefik ingress) or compatible.
- A SealedSecrets controller is installed in `kube-system`.
- A default StorageClass is available for the `synthesis-redis` PVC.

## Prepare images

```bash
bash scripts/infra/build-iterlaw-images.sh
bash scripts/infra/load-iterlaw-images-k3s.sh
```

The build script produces local-tagged images. The load script imports them
into K3s's containerd via `docker save | k3s ctr images import -`. Nothing
is pushed to a registry.

## Apply order

Manifests must be applied in the order defined by
`infra/iterlaw/deployment-contract.md`. The helper script enforces this:

```bash
bash scripts/infra/deploy-iterlaw-k3s.sh --apply
```

Without `--apply` the script is a pre-flight only.

## Secrets

Before applying workload manifests, the operator must seal at least:

- `iterlaw-postgres-credentials` in `iterlaw-data` (keys `POSTGRES_USER`,
  `POSTGRES_PASSWORD`)
- `iterlaw-db-secret` in `iterlaw-ai` (key `DATABASE_URL`, value pointing
  at `iterlaw-postgres.iterlaw-data.svc.cluster.local:5432`)
- `iterlaw-synthesis-redis` in `iterlaw-ai` (key `SYNTHESIS_REDIS_URL`)

`iterlaw-synthesis-internal-model` is optional — only required when running
the synthesis-worker in `MODEL_MODE=internal`.
`iterlaw-postgres-replication-credentials` is a placeholder for future
streaming-replica setup and is not consumed by current workloads.

See `ITERLAW_SECRETS_RUNBOOK.md` for the workflow.

## Post-apply verification

```bash
bash scripts/infra/verify-iterlaw-cluster.sh
```

Expect the following PASS lines on a healthy first deploy:

```
PASS namespace iterlaw-ai exists
PASS namespace iterlaw-data exists
PASS deployment legal-orchestrator
PASS deployment synthesis-worker
PASS statefulset synthesis-redis
PASS deployment iterlaw-web
PASS statefulset iterlaw-postgres
PASS service legal-orchestrator exposes port 3012
PASS service iterlaw-postgres exposes port 5432
PASS service iterlaw-postgres is ClusterIP
PASS service synthesis-redis is ClusterIP
PASS service synthesis-worker is ClusterIP
PASS synthesis-worker not public
PASS iterlaw-postgres not public
PASS no legacy workload in cluster
PASS no IterLaw workload in ordinox-ai
```

`NOT DEPLOYED` lines are acceptable before the first apply.

## Rolling forward

Standard pattern:

1. Rebuild image: `bash scripts/infra/build-iterlaw-images.sh`
2. Reload to K3s: `bash scripts/infra/load-iterlaw-images-k3s.sh`
3. Trigger a rollout: `kubectl -n iterlaw-ai rollout restart deploy/<name>`

## Rolling back

```bash
bash scripts/infra/rollback-iterlaw-k3s.sh
```
