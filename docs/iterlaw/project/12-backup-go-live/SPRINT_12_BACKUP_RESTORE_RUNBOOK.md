# Sprint 12 — Backup & Restore Runbook (operator workstation)

> WARNING — Read first.
>
> - Never paste secrets into chat.
> - Never restore over production.
> - Never run destructive restore without a clean, isolated target.
> - Never `kubectl apply` / `delete` / `patch` / `edit` / `scale` /
>   `rollout` against production.
> - Never set `ITERLAW_BACKUP_DATABASE_URL` to a production DSN when
>   running Track B from a workstation.

## 1. Purpose

This runbook governs the **operator-workstation backup + restore-verify
path** (Track B) introduced in Sprint 12. It is complementary to — and
strictly separate from — the cluster-side Borg path (Track A) described
in [`../../../docs/infra/BACKUP_AND_RESTORE_RUNBOOK.md`](../../infra/BACKUP_AND_RESTORE_RUNBOOK.md).

Track B's job is to give a single operator the ability to:

- Produce a deterministic `pg_dump` of a local or staging database.
- Generate a manifest JSON + SHA-256 checksum describing that dump.
- Verify both the manifest and the dump before any restore is
  attempted.
- Restore-verify into an isolated target (never production), recording
  a JSON report.

Track B does not depend on the cluster, kubectl, Borg, Hetzner, GHCR,
SealedSecrets, or any provider SDK.

## 2. What this protects

| Data class | Track B coverage |
| --- | --- |
| `public` schema (canonical tables, `legal_cases`) | Captured by `pg_dump --schema=public` in live mode |
| `uk_emp_rag` schema (RAG corpus when present) | Captured by `pg_dump --schema=uk_emp_rag` in live mode |
| Manifest + checksum artefacts | Always produced (dry-run and live) |
| Encryption-at-rest of the dump | NOT covered by Track B — operator's responsibility to store the dump on encrypted disk |
| Off-site replication | NOT covered by Track B — Track A's Borg upload handles that |

## 3. What it does not protect yet

- WAL archiving / point-in-time recovery — **deferred** to a later sprint.
- Track B dumps left on the operator workstation are single-copy. They
  are not synchronised, not versioned, not pruned automatically.
- Track B does not perform a live restore by default — it verifies
  structural integrity. A real recovery still uses Track A or the
  manual procedure in `../../infra/BACKUP_AND_RESTORE_RUNBOOK.md` §6.
- File uploads, S3 buckets, third-party data — none in scope.

## 4. Prerequisites

| Requirement | Notes |
| --- | --- |
| `bash` ≥ 5.0 | git-bash on Windows is acceptable |
| `node` ≥ 20 | for manifest validation + restore-verify parsing |
| `pg_dump` ≥ 16 | live backup only; dry-run does not require it |
| `pg_restore` ≥ 16 | live restore verify only (preflight `--list`) |
| `sha256sum` | live backup only |
| `git` | recorded in manifest; not strictly required |

## 5. How to run a dry-run backup

Dry-run is the **default** mode. It produces a manifest but never opens
a connection to any database.

```bash
bash scripts/backup/iterlaw-db-backup.sh \
  --dry-run \
  --output-dir ./tmp/sprint12-backup-test \
  --label sprint12-dry-run
```

Expected output:

```
iterlaw-db-backup: dry-run manifest written: ./tmp/sprint12-backup-test/iterlaw-sprint12-dry-run-<ts>.manifest.json
```

Open the manifest. Confirm it contains `"project": "iterlaw"`,
`"command_mode": "dry-run"`, `"sha256": null`, and
`"secret_redaction": true`. Confirm it does NOT contain any DSN,
password, or `POSTGRES_PASSWORD` literal.

## 6. How to run a live backup safely

Live mode is the only path that performs `pg_dump`. The source DSN is
**read only from the env var** `ITERLAW_BACKUP_DATABASE_URL`. Never
pass it as an argument; never paste it into chat.

```bash
# 1. Pre-flight: confirm you are NOT pointing at production.
#    The script will refuse a host matching the production denylist,
#    but the operator is the first line of defence.

# 2. Set the env var in your shell only (do not export to your dotfiles).
export ITERLAW_BACKUP_DATABASE_URL='postgres://iterlaw_app:<password>@localhost:5432/iterlaw'

# 3. Run live.
bash scripts/backup/iterlaw-db-backup.sh \
  --no-dry-run \
  --output-dir /var/backups/iterlaw \
  --label local-staging \
  --environment-label local-staging

# 4. Unset the env var.
unset ITERLAW_BACKUP_DATABASE_URL
```

The script will refuse:

- Empty `ITERLAW_BACKUP_DATABASE_URL`.
- A DSN whose host matches `iterlaw-postgres.iterlaw-data.svc.cluster.local`,
  `iterlaw-prod`, or anything matching `\bprod\b`.
- An `--environment-label` equal to `production` or `prod`.
- An invalid `--format` (only `custom|plain|directory|tar` accepted).

## 7. How to verify the manifest

```bash
node scripts/backup/verify-backup-manifest.mjs ./path/to/iterlaw-<label>-<ts>.manifest.json
```

Exit 0 + `manifest OK` ⇒ the manifest passed all structural and
secret-redaction checks. Any non-zero exit ⇒ the manifest is unsafe to
trust; do not proceed to restore.

When verifying a **live** manifest, the CLI also checks that the
referenced `*.sha256` sidecar file exists in the same directory.

## 8. How to run a restore dry-run

```bash
bash scripts/backup/iterlaw-db-restore-verify.sh \
  --dry-run \
  --backup-manifest ./tmp/sprint12-backup-test/iterlaw-sprint12-dry-run-<ts>.manifest.json \
  --report-out ./tmp/sprint12-backup-test/restore-report.json
```

The report will record `restore_mode: dry-run`,
`checksum_verified: false` (reason: `dry-run`),
`production_restore_attempted: false`,
`destructive_action_performed: false`,
`restore_target_host: [REDACTED]`,
`secret_redaction: true`.

## 9. How to run a restore into an isolated target

Live restore-verify is permitted ONLY against an isolated target
supplied via `ITERLAW_RESTORE_DATABASE_URL`. The script refuses if the
target equals the source DSN or matches the production denylist.

```bash
# 1. Stand up a throwaway Postgres pod / docker container on a
#    different host from production. Confirm it is empty.

# 2. Provide both source and target DSNs as env vars.
export ITERLAW_BACKUP_DATABASE_URL='postgres://iterlaw_app:<src-pw>@src.local:5432/iterlaw'
export ITERLAW_RESTORE_DATABASE_URL='postgres://iterlaw_app:<dst-pw>@drill.local:5433/iterlaw_restore'

# 3. Run live restore-verify with a non-production label.
bash scripts/backup/iterlaw-db-restore-verify.sh \
  --no-dry-run \
  --backup-manifest /var/backups/iterlaw/<live-manifest>.json \
  --report-out /var/backups/iterlaw/restore-report.json \
  --restore-label drill-2026Q2 \
  --allow-empty-target-only

# 4. Inspect the report. Confirm checksum_verified: true,
#    pg_restore_list_result: "schemas_visible" or "schemas_not_found"
#    (the latter only acceptable for an empty test dump).

# 5. Tear down the throwaway pod / container.

# 6. Unset BOTH env vars.
unset ITERLAW_BACKUP_DATABASE_URL ITERLAW_RESTORE_DATABASE_URL
```

The script will refuse:

- Empty `ITERLAW_RESTORE_DATABASE_URL`.
- `ITERLAW_RESTORE_DATABASE_URL` equal to `ITERLAW_BACKUP_DATABASE_URL`.
- `--restore-label production` or `prod`.
- A target host matching the production denylist.

## 10. How to confirm restore success

After the live restore-verify completes:

1. Check the JSON report has `verification_status: OK`.
2. Confirm `checksum_verified: true`.
3. Confirm `pg_restore_list_result` is `schemas_visible` (live custom-format
   dump only).
4. Connect to the isolated target with a read-only role and run
   sentinel row-count queries against `public.legal_cases` and
   `uk_emp_rag.legal_documents` (when present). The numbers should
   be within an acceptable delta of the source's row counts at the
   dump moment.
5. Record the report path in operator notes.

## 11. How to rotate old backups

Track B is intentionally manual: the operator decides when to prune.
The manifest records `retention_days` (default 14). Use the operator's
preferred file manager / `find -mtime +14 -delete` against the
`--output-dir`. The script does not auto-delete; that keeps the
blast radius small.

Track A's Borg side handles retention automatically via
`--keep-daily 7 --keep-weekly 4 --keep-monthly 12`. The two policies
are intentionally independent.

## 12. How to store backups securely

- Encrypted disk only. macOS FileVault, BitLocker, LUKS, or
  equivalent — the dump is the entire RAG corpus.
- No cloud upload from Track B. If off-site is required, that is
  Track A's responsibility.
- Never commit the dump or the manifest to git. The `.gitignore`
  contains `tmp/`; outputs under `--output-dir ./tmp/...` are already
  ignored, but the operator must not bypass.
- Never share the dump over chat, paste, or unencrypted email.

## 13. What not to do

- Do not run live backup against an unverified DSN — confirm the host
  first.
- Do not run live restore-verify against a target that shares a host
  with the source.
- Do not pass `--restore-label production`.
- Do not edit `restoreTargetValidator.mjs` to relax the production
  denylist without an ADR amendment.
- Do not modify the manifest by hand. The validator should be the
  arbiter of validity.
- Do not run `kubectl apply / delete / patch / edit / scale / rollout`
  against any cluster as part of Track B. Track A handles cluster
  state.

## 14. Emergency recovery steps

If the cluster's Track A Postgres is corrupt and Track A's Borg path
has not yet been promoted to live:

1. Use the most recent Track A in-cluster dump under
   `/backups/iterlaw-*.dump` inside the `iterlaw-postgres-backup` PVC
   (if reachable).
2. If unreachable, fall back to the most recent Track B operator-side
   dump on a workstation.
3. Restore into a fresh isolated database following §9 of this runbook.
4. Promote the restored database by rotating the orchestrator's
   `DATABASE_URL` SealedSecret. The rotation procedure lives in
   `docs/infra/ITERLAW_SECRETS_RUNBOOK.md` (when present) or follows
   the kubeseal flow in `k8s/iterlaw-data/secrets/README.md`.
5. Mark the old (broken) PVC retain-only for at least 7 days for
   forensic inspection.

These steps remain operator-driven and outside Track B's automation.

## 15. RPO / RTO

| Target | Sprint 12 (initial) |
| --- | --- |
| RPO | 24 hours (driven by Track A's 02:15 UTC CronJob; Track B is an ad-hoc supplement) |
| RTO | 4 hours (manual restore + DSN rotation + `/ready` confirmation) |

Tighter targets (1-hour RPO, 1-hour RTO with WAL archiving and
automated PITR) are deferred to a later sprint.

## 16. Operator checklist (per run)

- [ ] Confirm working directory is a clean clone of `serverax/iterlaw`.
- [ ] Confirm `bash --version`, `node --version`, `pg_dump --version`,
      `sha256sum --version` are all available.
- [ ] Run dry-run backup first.
- [ ] Verify the dry-run manifest with the CLI.
- [ ] Set `ITERLAW_BACKUP_DATABASE_URL` in shell-only env.
- [ ] Confirm DSN is NOT a production host.
- [ ] Run live backup.
- [ ] Verify the live manifest + sha256 sidecar.
- [ ] Unset env vars.
- [ ] Move the dump to encrypted storage.
- [ ] Record the manifest path and report (if restored) in operator
      notes.

## 17. Evidence checklist (for sprint sign-off)

- [ ] `scripts/backup/iterlaw-db-backup.sh` runs end-to-end in dry-run
      mode locally.
- [ ] `scripts/backup/iterlaw-db-restore-verify.sh` runs end-to-end in
      dry-run mode locally.
- [ ] `node scripts/backup/verify-backup-manifest.mjs <path>` exits 0
      against a freshly produced dry-run manifest.
- [ ] `apps/legal-orchestrator/src/tests/sprint12BackupScripts.test.ts`
      is green under vitest.
- [ ] Full orchestrator vitest suite remains green.
- [ ] Safety scans show no DSN, password, or token leakage in any
      committed artefact.

## 18. Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| `--output-dir is required` | Missing CLI flag. | Pass `--output-dir <path>`. |
| `live mode requires ITERLAW_BACKUP_DATABASE_URL` | Env var unset or empty in live mode. | Set the env var in the same shell. |
| `REFUSED — source DSN matches production hostname denylist` | DSN contains `iterlaw-postgres.iterlaw-data.svc.cluster.local`, `iterlaw-prod`, or `prod`. | Operator pointed at production by mistake. Stop. Use a non-production DSN. |
| `pg_dump FAILED` | Missing `pg_dump`, wrong DSN, unreachable host. | Confirm `pg_dump` is installed and the host is reachable. The script redacts the DSN in stderr. |
| `sha256sum not available` | Coreutils missing. | Install coreutils (Linux/macOS) or install git-bash on Windows. |
| `manifest FAILED validation` | Manifest is malformed or contains a secret-like value. | Inspect the validator stderr; never paste the manifest body into chat. Regenerate from scratch. |
| `REFUSED — source and target DSNs are identical` | Operator set both env vars to the same value. | Provide two distinct, host-different DSNs. |
| `Test timed out` (in vitest) | The bash dry-run subprocess is slow on Windows. | Run vitest with `--testTimeout 60000` if needed. The Sprint 12 test file already raises the timeout on the four bash-running cases. |
