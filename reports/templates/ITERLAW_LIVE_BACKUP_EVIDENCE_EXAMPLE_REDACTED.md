# IterLaw Live Backup Evidence — EXAMPLE (REDACTED)

> Example only. Demonstrates the shape of a clean, redacted live-backup evidence report. Every operator-specific identifier is replaced with `<redacted>`.

## Run metadata

- Operator: `<redacted-operator-handle>`
- Reviewer: `<redacted-reviewer-handle>`
- Start time (UTC): `2026-05-13T22:00:00Z`
- End time (UTC): `2026-05-13T22:06:42Z`
- Duration: `402`
- Script: `scripts/backup/iterlaw-db-backup.ps1`
- Exit code: `0`

## Archive metadata

- Archive identifier: `<redacted-archive-id>`
- Archive sha256: `<redacted-sha256>`
- Archive size (bytes): `12345678`
- Manifest sha256: `<redacted-sha256>`

## Safety checks

- Dry-run passed in the same shell within the last hour.
- `ITERLAW_BACKUP_DATABASE_URL` was set in-shell only, never committed.
- `ITERLAW_BACKUP_TARGET_PATH` was set in-shell only.
- Manifest contains no DSN substring.
- Manifest contains no password / token / API key substring.
- Disk space >= 2x archive size before run.
- Reviewer was online for the entire run.

## Anomalies / warnings

- None observed during this example run.

## Verdict

- Backup completed: `YES`
- Archive integrity check: `PASS`
- Ready to flip G12 to PASS: `YES`

## Reviewer sign-off

`<redacted-reviewer-handle>` — `2026-05-13` — `example redaction pass complete`
