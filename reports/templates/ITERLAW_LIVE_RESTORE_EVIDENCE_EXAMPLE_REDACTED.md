# IterLaw Live Restore-Verify Evidence — EXAMPLE (REDACTED)

> Example only. Demonstrates the shape of a clean, redacted live-restore-verify evidence report. Every operator-specific identifier is replaced with `<redacted>`. Target MUST be an isolated drill target — never production.

## Run metadata

- Operator: `<redacted-operator-handle>`
- Reviewer: `<redacted-reviewer-handle>`
- Start time (UTC): `2026-05-13T22:10:00Z`
- End time (UTC): `2026-05-13T22:18:54Z`
- Duration: `534`
- Script: `scripts/backup/iterlaw-db-restore-verify.ps1`
- Exit code: `0`

## Target metadata

- Target identifier: `<redacted-drill-target-id>`
- Target isolated from production: `YES`

## Restore output (counts only — no row content)

| Table | Restored count |
|---|---|
| `legal_sources` | `42` |
| `legal_documents` | `1281` |
| `legal_chunks` | `15743` |
| `users` | `0` |
| `workspaces` | `0` |
| `workspace_members` | `0` |
| `legal_cases` | `0` |

## Safety checks

- Dry-run passed in the same shell within the last hour.
- `ITERLAW_RESTORE_DATABASE_URL` was set in-shell only, never committed.
- Target host string contains no production identifier.
- RLS sessionless smoke: count = 0 on user-data tables.
- Policies confirmed present on RLS-enabled tables.
- No DSN / password / token in any captured output.

## Anomalies / warnings

- None observed during this example run.

## Verdict

- Restore completed against isolated drill target: `YES`
- RLS fail-closed verified: `YES`
- Ready to flip G13 to PASS: `YES`

## Reviewer sign-off

`<redacted-reviewer-handle>` — `2026-05-13` — `example redaction pass complete`
