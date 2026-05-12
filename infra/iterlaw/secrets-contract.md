# IterLaw — Secrets Contract

## Backend

All IterLaw secrets in the `iterlaw-ai` namespace are managed via
[SealedSecrets](https://github.com/bitnami-labs/sealed-secrets). Plaintext
`Secret` manifests are forbidden in this repository — verification scripts
reject them.

## Secret names

### Namespace `iterlaw-ai`

| SealedSecret name                  | Keys                          | Consumed by                              |
| ---------------------------------- | ----------------------------- | ---------------------------------------- |
| `iterlaw-db-secret`                | `DATABASE_URL`                | `legal-orchestrator` only                |
| `iterlaw-synthesis-redis`          | `SYNTHESIS_REDIS_URL`         | `legal-orchestrator`, `synthesis-worker` |
| `iterlaw-synthesis-internal-model` | `INTERNAL_MODEL_ENDPOINT`     | `synthesis-worker` only                  |

`iterlaw-db-secret` holds a Postgres DSN whose host is
`iterlaw-postgres.iterlaw-data.svc.cluster.local`. Neither `iterlaw-web`
nor `synthesis-worker` is permitted to reference this SealedSecret.

### Namespace `iterlaw-data`

| SealedSecret name                              | Keys                                         | Consumed by                                 |
| ---------------------------------------------- | -------------------------------------------- | ------------------------------------------- |
| `iterlaw-postgres-credentials`                 | `POSTGRES_USER`, `POSTGRES_PASSWORD`         | `iterlaw-postgres` StatefulSet, backup CronJob |
| `iterlaw-postgres-replication-credentials`     | `REPLICATION_USER`, `REPLICATION_PASSWORD`   | Placeholder for future streaming replica.   |

`iterlaw-synthesis-internal-model` is optional. When absent, the
synthesis-worker must run in `MODEL_MODE=disabled` and return
`synthesis_unavailable` on every request.

## Forbidden

The following secret values **must not exist** anywhere in this repository:

- Plaintext API keys (Anthropic, OpenAI, Ollama, etc.) in any file.
- `CLAUDE_API_KEY`, `OPENAI_API_KEY`, `OLLAMA_URL` as env vars in
  `legal-orchestrator`'s deployment or ConfigMap.
- Any provider credential consumed by `legal-orchestrator`.

`scripts/infra/verify-iterlaw-repo.sh` greps for the above patterns and fails
if it finds them.

## Sealing workflow

```bash
# Encrypt a literal secret value targeting iterlaw-ai:
kubeseal --controller-namespace kube-system \
  --controller-name sealed-secrets-controller \
  --format yaml \
  < raw-secret.yaml > k8s/iterlaw/secrets/iterlaw-<name>.yaml

# Encrypt a literal secret value targeting iterlaw-data:
kubeseal --controller-namespace kube-system \
  --controller-name sealed-secrets-controller \
  --format yaml \
  < raw-secret.yaml > k8s/iterlaw-data/secrets/iterlaw-<name>.yaml
```

The unencrypted `raw-secret.yaml` MUST NOT be committed. It should live only
on an operator's workstation or in an out-of-band secrets vault.

## Audit

- `synthesis-worker` emits `external_llm_used=false` in every audit record.
  When `MODEL_MODE=internal` it additionally emits
  `internal_model_used=true`, but `external_llm_used` stays `false` because
  the internal endpoint is reached over the in-cluster network only.
- `legal-orchestrator` emits `external_llm_used=false` unconditionally.
