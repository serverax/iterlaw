# IterLaw — Secrets Runbook

## Principles

1. Plaintext `Secret` manifests are forbidden in this repository.
2. All cluster secrets are SealedSecrets, sealed with `kubeseal` using the
   in-cluster controller's public key.
3. `legal-orchestrator` never holds LLM provider credentials. Only the
   synthesis-worker is permitted a model endpoint, and only via the
   optional `iterlaw-synthesis-internal-model` SealedSecret.

## Sealing a value

```bash
# 1. Write the raw secret on the operator workstation (NEVER commit this file).
cat > /tmp/iterlaw-db-secret.raw.yaml <<'EOF'
apiVersion: v1
kind: Secret
metadata:
  name: iterlaw-db-secret
  namespace: iterlaw-ai
type: Opaque
stringData:
  DATABASE_URL: postgresql://USER:PASSWORD@iterlaw-postgres.iterlaw-data.svc.cluster.local:5432/iterlaw?sslmode=disable
EOF

# 2. Seal it against the controller's public key.
kubeseal --controller-namespace kube-system \
  --controller-name sealed-secrets-controller \
  --format yaml \
  < /tmp/iterlaw-db-secret.raw.yaml \
  > k8s/iterlaw/secrets/iterlaw-db-secret.yaml

# 3. Shred the raw file.
shred -u /tmp/iterlaw-db-secret.raw.yaml
```

Repeat for `iterlaw-synthesis-redis` and (only if needed)
`iterlaw-synthesis-internal-model`.

For `iterlaw-data`, seal `iterlaw-postgres-credentials` similarly,
substituting `namespace: iterlaw-data`, `stringData` keys
`POSTGRES_USER` and `POSTGRES_PASSWORD`, and writing the output to
`k8s/iterlaw-data/secrets/iterlaw-postgres-credentials.yaml`.

## Rotation

1. Re-issue the underlying credential at the source (Postgres, Redis, etc.).
2. Re-seal as above into the same file path.
3. Commit. The next `deploy-iterlaw-k3s.sh --apply` propagates the change.
4. Restart consumers if they cache credentials:
   `kubectl -n iterlaw-ai rollout restart deploy/<name>`.

## Loss / compromise

- A leaked plaintext value MUST be treated as compromised. Re-issue, re-seal,
  rotate any credentials derived from it, and review audit logs for misuse.
- A leaked SealedSecret YAML is not a credential disclosure on its own —
  SealedSecrets are scoped to a specific cluster + namespace + name and
  cannot be decrypted elsewhere.

## What is NOT a secret

- `INTERNAL_MODEL_NAME` (free-form identifier for audit logs) is a ConfigMap
  value, not a secret.
- `SYNTHESIS_REQUEST_STREAM` / `SYNTHESIS_RESPONSE_STREAM` (the Redis stream
  names) are public configuration, not secrets.
