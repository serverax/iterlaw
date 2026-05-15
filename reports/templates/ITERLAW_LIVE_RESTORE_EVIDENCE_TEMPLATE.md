# IterLaw Live Restore-Verify Evidence — TEMPLATE

> Copy this file to `reports/ITERLAW_LIVE_RESTORE_EVIDENCE_<YYYY-MM-DD>.md` before filling. **Never commit DSNs, passwords, API keys, or tokens.** Target MUST be an isolated drill target — never production.

## Run metadata

- Operator: `<named operator>`
- Reviewer: `<named reviewer>`
- Start time (UTC): `<YYYY-MM-DDTHH:mm:ssZ>`
- End time (UTC): `<YYYY-MM-DDTHH:mm:ssZ>`
- Duration: `<seconds>`
- Script: `scripts/backup/iterlaw-db-restore-verify.ps1`
- Exit code: `<0 / non-zero>`

## Target metadata

- Target identifier: `<friendly identifier; NEVER production; NEVER a DSN>`
- Target isolated from production: `<YES / NO>` (must be YES)

## Restore output (counts only — no row content)

| Table | Restored count |
|---|---|
| `legal_sources` | `<int>` |
| `legal_documents` | `<int>` |
| `legal_chunks` | `<int>` |
| `users` | `<int>` |
| `workspaces` | `<int>` |
| `workspace_members` | `<int>` |
| `legal_cases` | `<int>` |
| `legal_case_*` | `<int>` |

## Safety checks (assert all)

- [ ] Dry-run passed in the same shell within the last hour.
- [ ] `ITERLAW_RESTORE_DATABASE_URL` was set in-shell only, never committed.
- [ ] Target host string contains no production identifier.
- [ ] RLS sessionless smoke: count = 0 on user-data tables.
- [ ] Policies confirmed present on RLS-enabled tables.
- [ ] No DSN / password / token in any captured output.

## Anomalies / warnings (if any)

`<short, redacted description; do not paste raw stderr if it contains a DSN>`

## Verdict

- Restore completed against isolated drill target: `<YES / NO>`
- RLS fail-closed verified: `<YES / NO>`
- Ready to flip G13 to PASS: `<YES / NO>`

## Reviewer sign-off

`<reviewer name>` — `<YYYY-MM-DD>` — `<short note>`

## Forbidden fields (must not appear in this report)

- Real DSNs.
- Real passwords / API keys / tokens.
- Production hostnames or IPs.
- Anything that resembles PEM private-key material (RSA or OpenSSH key block headers), GitHub PATs (`ghp_…`), OpenAI-style keys (`sk-…`), AWS access keys (`AKIA…`), or Google API keys (`AIza…`).
- Restored row content beyond counts.
