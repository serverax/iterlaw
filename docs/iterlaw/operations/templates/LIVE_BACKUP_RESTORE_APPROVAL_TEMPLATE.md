# Live Backup / Restore Approval Template — DO NOT FILL IN THE REPO

> This file is a **template**. It is NOT a valid approval. To activate live backup or live restore, the operator copies this template to `~/.iterlaw/live-backup-restore-approval.json` on their own workstation and fills in operator-local fields. The repo never holds a real, completed approval file.

## Template fields (operator-local only)

```yaml
operator: "<named operator>"
reviewer: "<named reviewer; must differ from operator>"
authorisation_date: "YYYY-MM-DD"
authorisation_window_end: "YYYY-MM-DD"

# Backup scope
backup_target_identifier: "<friendly identifier; NEVER a DSN>"
backup_approved: true

# Restore-verify scope
restore_target_identifier: "<isolated drill target identifier; NEVER production>"
restore_verify_approved: true

# Acknowledged stop conditions
acknowledged_stop_conditions:
  - "dry-run must pass"
  - "no production target"
  - "reviewer available"
  - "no secret in evidence"

# Signature (operator-local; do not commit)
signed_off: "<operator-signature; NOT a real key, NOT a token>"
```

## Hard rules

- **Never commit a completed approval file to the repo.** This template is the only thing the repo ships.
- Do **not** include DSNs, passwords, API keys, or tokens.
- Do **not** point either `backup_target_identifier` or `restore_target_identifier` at production.
- The `signed_off` field is operator-local accountability text. It is **not** a cryptographic signature, and must not be a token.

## What happens at run-time

The script `scripts/operator/check-live-backup-restore-authorisation.ps1` reads the operator-local approval file (default path `~/.iterlaw/live-backup-restore-approval.json`) and checks:

- File exists.
- `backup_approved` is `true` (if backup is being attempted).
- `restore_verify_approved` is `true` (if restore-verify is being attempted).
- `operator` and `reviewer` are different non-empty strings.
- `authorisation_date` is today or yesterday and `authorisation_window_end` is in the future.

The script **never prints** field values. If any check fails, it exits non-zero with a precise reason.
