# ADR — Sprint 12 — IterLaw Backup and Recovery Policy

## Status

**Accepted (Sprint 12 scope — DRY-RUN FOUNDATION ONLY).**

This ADR is accepted for the artefacts it produces. It does **NOT**
authorise any live backup against a production database, any restore
against a production database, any `kubectl apply` against a production
cluster, any creation of remote storage buckets, any seal of a real
Borg passphrase or storage credential, or any rotation of production
secrets. Those steps remain a separate operator decision in a later
sprint and are explicitly out of scope here.

## Context

IterLaw already carries a Borg-based, cluster-side backup design (see
[`../../../docs/infra/BACKUP_AND_RESTORE_RUNBOOK.md`](../../../infra/BACKUP_AND_RESTORE_RUNBOOK.md)):

- `k8s/iterlaw-data/backups/cronjob.yaml` — nightly `pg_dump --format=custom` to an in-cluster PVC.
- `k8s/iterlaw-data/backups/upload-cronjob.yaml` — drafted Borg upload to a Hetzner Storage Box (not yet applied; image placeholder).
- `k8s/iterlaw-data/backups/verify-cronjob.yaml` — drafted weekly verify (not yet applied).
- `apps/legal-orchestrator/scripts/restore-from-borg.sh` — manual restore helper with `FORCE_RESTORE` guard.
- `scripts/infra/verify-iterlaw-backup.sh` — repo-level static verifier.

That design depends on a working AKS / k3s cluster, an in-cluster
secret rotation, a built and pushed uploader image, and a Storage Box
account. None of those preconditions is satisfied at Sprint 12 start.
None is in scope for the operator's local workstation. The orchestrator
still cannot produce a backup that an operator can inspect on their own
machine without running cluster CronJobs.

Sprint 12 closes that gap by adding an **operator-side, local-machine,
dry-run-by-default** backup + restore-verification path that:

- Runs on a developer / operator workstation against any reachable
  Postgres (local Docker staging today; explicitly **not** production).
- Produces a deterministic **manifest JSON** describing the dump.
- Produces an SHA-256 checksum that can be verified before any
  restore attempt.
- Refuses to overwrite a target that looks like production.
- Refuses to print secrets.
- Has unit tests that prove the safety properties without touching a
  real database.

This ADR governs only the new local-workstation path. The cluster
CronJob path remains the production target and is not modified.

## Decision

Adopt a two-track backup model:

1. **Track A — Cluster CronJob (existing).** Borg-based upload from
   the in-cluster `pg_dump` to a Hetzner Storage Box, governed by
   `docs/infra/BACKUP_AND_RESTORE_RUNBOOK.md`. **No change in this
   sprint.** Promotion to live still requires the §8.2 steps in that
   runbook.
2. **Track B — Operator workstation (new in Sprint 12).** Bash scripts
   under `scripts/backup/` that run from a developer / operator
   workstation, default to `--dry-run`, never call `kubectl`, and
   never write to production. Used for:
   - One-off operator-driven dumps of local Docker staging
     (`pgvector/pgvector:pg16`).
   - Pre-flight verification of manifest format + secret-redaction
     before Track A is promoted.
   - Manual restore drill into an explicit isolated target.

Track B is the entire scope of this sprint.

## Scope

In scope:

- `scripts/backup/iterlaw-db-backup.sh` — operator-side backup script.
- `scripts/backup/iterlaw-db-restore-verify.sh` — operator-side
  restore verifier.
- `scripts/backup/verify-backup-manifest.mjs` — Node ESM manifest
  validator (also imported by tests).
- `scripts/backup/manifestValidator.mjs` — pure helper module used by
  both the CLI and the tests (no I/O at import time).
- `scripts/backup/restoreTargetValidator.mjs` — pure helper module
  used by both the restore script's JS preflight and the tests.
- Unit tests under `apps/legal-orchestrator/src/tests/sprint12BackupScripts.test.ts`.
- This ADR and the matching runbook
  `SPRINT_12_BACKUP_RESTORE_RUNBOOK.md`.

Out of scope:

- Building or pushing the uploader image.
- Pinning the Storage Box CIDR.
- Sealing any real Borg passphrase or SSH key.
- Applying any backup manifest to any cluster.
- Any live restore.
- Any live backup of any non-local database.
- Any change to `apps/legal-orchestrator/src/legal/**` or the answer
  path.
- Any change to canonical namespaces (`iterlaw-ai`, `iterlaw-rag`,
  `iterlaw-api`, `iterlaw-monitoring`, `iterlaw-security`).
- WAL archiving / PITR.

## Data assets covered

Track B targets exactly one logical database per invocation. The dump
is produced with `pg_dump --format=custom --no-owner --no-privileges`
and is intended to capture the same schema set as Track A — the
canonical `public` schema (including `legal_cases` from migration 102)
plus `uk_emp_rag` when present. The script does not enumerate
individual tables; coverage is the same as Track A's CronJob.

## Backup targets

- **Local file system only by default.** Output goes under
  `--output-dir`, which must be an explicit operator-supplied path.
- **No cloud upload.** Track B never calls `borg`, `aws`, `az`, `gcloud`,
  `rclone`, `mc`, or `kubectl`. Cloud upload is Track A's job.
- **No git commit of dump bytes.** Manifest JSON may be reviewed in a
  PR; the dump artefact itself must remain untracked.

## Retention policy

- Default: **14 days** for local Track B dumps.
- The script stamps `retention_days` in every manifest.
- Pruning is operator-driven (Track B does not auto-delete; that
  reduces blast radius). Track A's Borg side handles 7d / 4w / 12m
  in-cluster.

## Encryption + secrets policy

- The script accepts `DATABASE_URL` only via environment variable
  (`ITERLAW_BACKUP_DATABASE_URL`). It is never written to the manifest,
  the checksum, the report, the dry-run log, or any chat-visible
  output.
- The manifest validator rejects any field that matches
  `postgres://`, `postgresql://`, `POSTGRES_PASSWORD`, `PGPASSWORD`,
  `password=`, `sk-`, `AKIA`, `ghp_`, `github_pat_`, `BORG_PASSPHRASE`,
  or any `:@` URL fragment that looks like an embedded credential.
- The restore script accepts the target via
  `ITERLAW_RESTORE_DATABASE_URL` only, never logs it, and refuses if
  the target URL equals the backup-source URL or if either matches a
  hard-coded production hostname denylist.

## Checksum policy

- Every non-dry-run dump produces a sibling SHA-256 file.
- The manifest stores the same hash as `sha256`.
- The restore verifier re-computes SHA-256 against the dump file and
  refuses to proceed if it differs from the manifest.

## Restore verification policy

- Default mode: `--dry-run`. Verifies the manifest, verifies the
  SHA-256, lists the dump (`pg_restore --list`) when `pg_restore` is
  available, and exits without touching any database.
- Live mode: requires `ITERLAW_RESTORE_DATABASE_URL` to be supplied
  out-of-band and to differ from the source URL. The target must pass
  the safe-target check (`restoreTargetValidator.mjs`) which rejects:
  - any URL whose host equals the source URL host,
  - any URL whose host matches a hard-coded production denylist
    (`iterlaw-postgres.iterlaw-data.svc.cluster.local`,
    `prod.*iterlaw.*`, anything containing `iterlaw-prod`),
  - any URL whose label is `production`,
  - any URL that fails to parse as a real DSN.
- Restore verifier writes a JSON report (`restore-report.json`) that
  records `secret_redaction: true`, `restore_target_label`, and a
  table-row-count summary when the live mode was used. The report
  never contains the URL.

## RPO / RTO targets

- **Initial Sprint 12 targets (operator-driven, local + Track A
  cluster path):**
  - **RPO target: 24 hours.** Track A CronJob runs at 02:15 UTC; the
    most recent dump should never be older than 24 hours when Track A
    is live. Track B contributes ad-hoc operator dumps when needed.
  - **RTO target: 4 hours.** Operator manual restore of the latest
    dump into a fresh isolated Postgres pod, plus orchestrator
    `DATABASE_URL` rotation, plus `/ready` confirmation.
- These targets are operational ambitions, not contractual guarantees.
  Later sprints (graphRAG, WAL archiving, automated PITR, multi-region
  replica) will tighten them.

## Allowed commands

- `pg_dump`, `pg_restore`, `sha256sum`, `node`, `bash`.
- `kubectl get` (read-only) is permitted by Phase 7 of the sprint
  task; no mutating verb is permitted.

## Forbidden commands

- `kubectl apply`, `kubectl delete`, `kubectl patch`, `kubectl edit`,
  `kubectl scale`, `kubectl rollout`, `kubectl drain`,
  `kubectl exec ... psql ...` against production.
- `helm install`, `helm upgrade`.
- `psql` against any non-local target without explicit
  out-of-band operator confirmation.
- Any restore against a target whose host or label matches the
  production denylist.
- Any printing of `DATABASE_URL`, `POSTGRES_PASSWORD`, `PGPASSWORD`,
  `BORG_PASSPHRASE`, `BORG_REPO`, `SSH_PRIVATE_KEY`, or any token /
  webhook / bearer / API key value.

## Evidence required for PASS

For Sprint 12 to be marked PASS-for-dry-run-foundation, the QA report
must include:

1. `scripts/backup/iterlaw-db-backup.sh` exists with `set -euo pipefail`,
   refuses an empty `ITERLAW_BACKUP_DATABASE_URL` in live mode, and
   produces a manifest in dry-run mode.
2. `scripts/backup/iterlaw-db-restore-verify.sh` exists with
   `set -euo pipefail`, refuses same source-and-target, refuses
   production targets, supports dry-run, and produces a report.
3. `scripts/backup/verify-backup-manifest.mjs` exists, is invocable
   via `node`, and exits non-zero on invalid manifests.
4. The unit-test file proves the safety properties without a real
   database.
5. Full vitest suite remains green.
6. No production DB was touched.
7. No secret value was printed.
8. No `kubectl` mutating verb was run.

## Production status

**BLOCKED.** This ADR does not unblock production. The cluster-side
Track A still requires §8.2 of `docs/infra/BACKUP_AND_RESTORE_RUNBOOK.md`
to land before any production backup is real.

## Truth statement

- No deployment performed by this ADR.
- No live backup performed by this ADR.
- No production DB touched by this ADR.
- No secret values printed by this ADR.
- This ADR governs only the new operator-side workstation backup +
  restore-verify path and the four files listed under **Scope**.
