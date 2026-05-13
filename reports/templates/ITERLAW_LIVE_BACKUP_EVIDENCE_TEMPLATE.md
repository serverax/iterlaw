# IterLaw Live Backup Evidence — TEMPLATE

> Copy this file to `reports/ITERLAW_LIVE_BACKUP_EVIDENCE_<YYYY-MM-DD>.md` before filling. **Never commit DSNs, passwords, API keys, or tokens.**

## Run metadata

- Operator: `<named operator>`
- Reviewer: `<named reviewer>`
- Start time (UTC): `<YYYY-MM-DDTHH:mm:ssZ>`
- End time (UTC): `<YYYY-MM-DDTHH:mm:ssZ>`
- Duration: `<seconds>`
- Script: `scripts/backup/iterlaw-db-backup.ps1`
- Exit code: `<0 / non-zero>`

## Archive metadata

- Archive identifier: `<short identifier — NOT a DSN, NOT a real path with secrets>`
- Archive sha256: `<lowercase hex>`
- Archive size (bytes): `<integer>`
- Manifest sha256: `<lowercase hex>`

## Safety checks (assert all)

- [ ] Dry-run passed in the same shell within the last hour.
- [ ] `ITERLAW_BACKUP_DATABASE_URL` was set in-shell only, never committed.
- [ ] `ITERLAW_BACKUP_TARGET_PATH` was set in-shell only.
- [ ] Manifest contains **no** DSN substring.
- [ ] Manifest contains **no** password / token / API key substring.
- [ ] Disk space ≥ 2× archive size before run.
- [ ] Reviewer was online for the entire run.

## Anomalies / warnings (if any)

`<short, redacted description; do not paste raw stderr if it contains a DSN>`

## Verdict

- Backup completed: `<YES / NO>`
- Archive integrity check: `<PASS / FAIL>`
- Ready to flip G12 to PASS: `<YES / NO>`

## Reviewer sign-off

`<reviewer name>` — `<YYYY-MM-DD>` — `<short note>`

## Forbidden fields (must not appear in this report)

- Real DSNs.
- Real passwords / API keys / tokens.
- Real backup paths that embed credentials.
- Anything that resembles `BEGIN RSA PRIVATE KEY` / `BEGIN OPENSSH PRIVATE KEY` / `ghp_…` / `sk-…` / `AKIA…` / `AIza…`.
- Anything that would let a reader of the repo reconstruct a production target.
