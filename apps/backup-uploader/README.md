# IterLaw backup uploader image

A minimal Alpine 3.20 image that runs Borg uploads + verify drills
against a Hetzner Storage Box. Consumed by the CronJobs
`iterlaw-postgres-backup-upload` and `iterlaw-postgres-backup-verify`
in `k8s/iterlaw-data/backups/`.

## What the image contains

| Tool | Purpose |
| --- | --- |
| `borgbackup` (`borg`) | Push dumps into the Storage Box, prune retention windows, run the weekly check. |
| `openssh-client` | Borg's SSH transport. |
| `postgresql16-client` (`pg_restore`) | Format check on the verify drill (`pg_restore --list`). |
| `bash`, `coreutils`, `gzip`, `tini`, `ca-certificates` | Standard runtime helpers. |
| `/usr/local/bin/iterlaw-backup-uploader` | The `entrypoint.sh` script — the only repo-owned content in the image. |

The image carries **no secrets, no source code, no repo data**. All
credentials arrive at runtime via the `iterlaw-backup-borg`
SealedSecret bound through `envFrom`.

## How to build locally

From the repo root:

```bash
bash scripts/infra/build-backup-uploader-image.sh
```

The script defaults to `--image ghcr.io/serverax/iterlaw-backup-uploader`
and `--tag local`. It does NOT push by default.

## How to tag

```bash
bash scripts/infra/build-backup-uploader-image.sh \
     --image ghcr.io/serverax/iterlaw-backup-uploader \
     --tag "$(git rev-parse --short HEAD)"
```

## How to push to GHCR (or the chosen registry)

```bash
# 1. Authenticate.
echo "$GHCR_TOKEN" | docker login ghcr.io -u <user> --password-stdin

# 2. Build + push.
bash scripts/infra/build-backup-uploader-image.sh \
     --image ghcr.io/serverax/iterlaw-backup-uploader \
     --tag "$(git rev-parse --short HEAD)" \
     --push
```

The build script prints the **digest** of the pushed image. Pin that
digest in the CronJobs before any cluster apply (see "Pin by digest"
below).

## How to pin by digest in the CronJobs

`k8s/iterlaw-data/backups/upload-cronjob.yaml` and `verify-cronjob.yaml`
ship with the placeholder

```
image: ghcr.io/serverax/iterlaw-backup-uploader:REPLACE_ME_DIGEST_OR_TAG
```

Replace with the digest after pushing:

```
image: ghcr.io/serverax/iterlaw-backup-uploader@sha256:<the-digest-you-just-pushed>
```

The repo verifier `verify-iterlaw-backup.sh` reports a `WARN` until
the digest pin is in place. It does NOT fail — but the CronJobs are
annotated `iterlaw.io/status: "draft-not-applied"` and operators MUST
NOT `kubectl apply` until the pin is real.

## Required env at runtime

| Env | Purpose |
| --- | --- |
| `BORG_REPO` | Borg repository URL on the Storage Box. |
| `BORG_PASSPHRASE` | Repokey passphrase. |
| `STORAGEBOX_HOST` | Hetzner Storage Box hostname. |
| `STORAGEBOX_USER` | Hetzner Storage Box username. |
| `SSH_PRIVATE_KEY_PATH` | Default `/home/borguser/.ssh/id_storagebox` — mounted by the CronJob from the SealedSecret. |

Optional alerting env vars: `BACKUP_ALERT_WEBHOOK_URL`,
`BACKUP_ALERT_TELEGRAM_BOT_TOKEN`, `BACKUP_ALERT_TELEGRAM_CHAT_ID`.
The entrypoint logs the *intent* to alert and exits 0 on the alert
path if these are unset.

## No real secrets in this repository

This README, the Dockerfile, and the entrypoint contain only env-var
names and placeholder values. The real credentials live exclusively
in the cluster's `iterlaw-backup-borg` SealedSecret. Sealing
procedure: see `docs/infra/BACKUP_AND_RESTORE_RUNBOOK.md` and
`k8s/iterlaw-data/secrets/README.md`.
