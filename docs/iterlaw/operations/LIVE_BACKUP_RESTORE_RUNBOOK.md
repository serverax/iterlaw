# IterLaw Live Backup + Live Restore Runbook

> Operator-only runbook. Do **not** read this as a plan an agent can execute. Every step assumes a named human operator with operator-workstation credentials.

## 0. Stop if any of these is true

- You are not the named operator on duty.
- You do not have a separate human reviewer available.
- A dry-run script has not passed today.
- An IterLaw safety gate has regressed in the last 24 hours.
- The production readiness verifier currently reports a NEW failing gate compared to its last green snapshot for non-G12 / non-G13 gates.

If any of the above is true, **stop**.

## 1. Pre-flight

1. Confirm Sprint 12 + Sprint 13 reports remain PASS.
2. Run `pwsh -File scripts/operator/check-live-backup-restore-authorisation.ps1`. Exit code must be `0`.
3. Confirm dry-runs:
   ```
   pwsh -File scripts/backup/iterlaw-db-backup-dry-run.ps1
   pwsh -File scripts/backup/iterlaw-db-restore-verify-dry-run.ps1
   ```
   Both must exit `0`.
4. Confirm disk space and target reachability.
5. Confirm reviewer is online and available.

## 2. Live backup

```
$env:ITERLAW_BACKUP_DATABASE_URL = "<set-locally; never echo>"
$env:ITERLAW_BACKUP_TARGET_PATH  = "<set-locally>"
pwsh -File scripts/backup/iterlaw-db-backup.ps1
```

Capture:

- Start time, end time, archive size, sha256, archive path (path may need redaction if it contains sensitive identifiers).
- Exit code.
- Any warning emitted by the backup script.

If exit ≠ 0, go to rollback (§4).

## 3. Live restore-verify (isolated drill target only)

```
$env:ITERLAW_RESTORE_DATABASE_URL = "<isolated-drill-target-only; never production>"
pwsh -File scripts/backup/iterlaw-db-restore-verify.ps1
```

The script refuses to run if `ITERLAW_RESTORE_DATABASE_URL` is empty or appears to point at production.

Capture:

- Start time, end time.
- Number of tables restored.
- RLS smoke check result (sessionless count = 0 on user-data tables).
- Exit code.
- Any warning emitted.

If exit ≠ 0, go to rollback (§4).

## 4. Rollback

Follow [`LIVE_BACKUP_RESTORE_ROLLBACK_PLAN.md`](LIVE_BACKUP_RESTORE_ROLLBACK_PLAN.md).

## 5. Evidence + gate flip

1. Operator fills `reports/templates/ITERLAW_LIVE_BACKUP_EVIDENCE_TEMPLATE.md` into a new timestamped file under `reports/`.
2. Operator fills `reports/templates/ITERLAW_LIVE_RESTORE_EVIDENCE_TEMPLATE.md` similarly.
3. Reviewer reads the timestamped reports, redacts anything that resembles a secret, and approves.
4. Operator updates `docs/iterlaw/project/PRODUCTION_READINESS_GATE.json` to flip `G12` and/or `G13` to `"PASS"`, points `evidence_path` at the new timestamped report, sets `last_verified_at`, clears `blocker`.
5. Operator commits with message:
   ```
   ops(iterlaw): record live backup evidence and flip G12 / G13
   ```
6. Operator pushes to origin/master.
7. Reviewer confirms by inspecting `git log` on origin.

## 6. Never

- Never run live backup or live restore from any context other than the named operator workstation.
- Never share env-var values with anyone, including the reviewer.
- Never commit raw script output without a redaction review.
- Never use `npm audit fix --force`.
- Never force-push.
- Never `kubectl apply` / `kubectl delete` / `kubectl patch` against production from within this procedure.
