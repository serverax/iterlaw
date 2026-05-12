# IterLaw Postgres backups

## What this folder is

A nightly logical backup of the `iterlaw` Postgres database in
`iterlaw-data`. The CronJob `iterlaw-postgres-backup` runs `pg_dump`
against schema `uk_emp_rag` and writes a gzipped SQL dump to a dedicated
PVC mounted at `/backups`.

## What this folder is NOT

- **Not** an automatic-restore system. Restore is manual and supervised.
- **Not** a retention policy. The CronJob does not delete old dumps.
  An operator must prune `/backups` periodically.
- **Not** point-in-time recovery (PITR). PITR requires WAL archiving and
  a base backup, neither of which is configured here.

## Files

| File             | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `cronjob.yaml`   | The CronJob and its dedicated backup PVC.                  |
| `README.md`      | This file.                                                 |

## Credentials

Backups read the same SealedSecret (`iterlaw-postgres-credentials`) that
the StatefulSet uses. Passwords never appear in this manifest.

## Restore procedure (manual)

1. Identify the dump to restore:

   ```bash
   kubectl -n iterlaw-data exec -it deploy/iterlaw-postgres-restore-shell -- ls -lh /backups
   ```

   (`iterlaw-postgres-restore-shell` is a one-off pod you launch ad-hoc;
   it is not part of the standing manifests.)

2. Pause the orchestrator so it cannot write during the restore:

   ```bash
   kubectl -n iterlaw-ai scale deploy/legal-orchestrator --replicas=0
   ```

3. Restore into a freshly-created database, then swap. **Never** restore
   into the live database in-place without a fresh schema, or you will
   produce an inconsistent mix of pre- and post-restore rows.

4. Bring the orchestrator back:

   ```bash
   kubectl -n iterlaw-ai scale deploy/legal-orchestrator --replicas=1
   ```

## Forbidden in this folder

- Plaintext passwords or connection strings.
- Automatic destructive operations (drop database, truncate tables).
- Cron schedules tighter than daily without an operations review.
