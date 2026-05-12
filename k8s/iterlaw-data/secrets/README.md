# iterlaw-data secrets

Files in this directory are **manifest templates**, not real secrets.

## Naming convention

| Filename | Apply directly? | Contents |
| --- | --- | --- |
| `*.example.yaml` | **NO** — example only. Carries `REPLACE_ME_*` placeholders. Never `kubectl apply`. The repo verifier skips `*.example.yaml` files for the plaintext-Secret check. |
| `*-sealedsecret.yaml` (when present) | YES — the operator-produced `SealedSecret`. Encrypted at rest with the cluster's sealed-secrets public key. Safe to commit because the cluster is the only party that can decrypt. |
| any other `.yaml` | Treated as a plaintext manifest by the verifier — must not be a `kind: Secret`. |

## Workflow

1. Copy an `.example.yaml` to the operator workstation
   (`/tmp/...raw.yaml`).
2. Fill in the real values. **Do not commit this file.**
3. Run `kubeseal` against the cluster's controller:
   ```bash
   kubeseal \
     --controller-namespace kube-system \
     --controller-name sealed-secrets-controller \
     --format yaml \
     < /tmp/iterlaw-backup-borg.raw.yaml \
     > k8s/iterlaw-data/secrets/iterlaw-backup-borg-sealedsecret.yaml
   ```
4. `shred -u /tmp/iterlaw-backup-borg.raw.yaml`.
5. Commit only the sealed YAML.

For convenience, `scripts/infra/create-backup-borg-sealedsecret-template.sh`
generates the raw Secret YAML from environment variables and optionally
pipes it through `kubeseal`. It writes to `stdout` by default — only
to a file when `--output <path>` is passed — and refuses to run if
any required env var is `REPLACE_ME` or empty.

## Rules

- **No raw `Secret` with real values is ever committed.** The verifier
  rejects files named `*.yaml` (without `.example.`) that declare
  `kind: Secret`.
- The sealed YAML produced by `kubeseal` is `kind: SealedSecret`, not
  `kind: Secret` — the cluster controller materialises the real
  `Secret` at runtime.
- Re-sealing is required whenever the cluster's sealing key rotates.
- Re-sealing is also required whenever a credential rotates upstream
  (Hetzner SSH key, Borg passphrase). The procedure is identical.

## Currently present in this directory

| File | Kind |
| --- | --- |
| `sealedsecret-template.yaml` | SealedSecret templates for `iterlaw-postgres-credentials` + `iterlaw-postgres-replication-credentials`. Operator fills in `encryptedData` from `kubeseal` output. |
| `iterlaw-backup-borg.example.yaml` | **EXAMPLE ONLY** — `REPLACE_ME_*` placeholders for the Borg + Hetzner Storage Box credentials. Source for the template script. |
