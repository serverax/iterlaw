# IterLaw Live Backup + Live Restore Authorisation Pack

> **This pack is documentation + safety scaffolding only.** It does **not** execute a live backup. It does **not** execute a live restore. It does **not** touch any production DB. Gates G12 (live backup) and G13 (live restore) remain `PARTIAL` / `NOT_VERIFIED` until the operator follows the procedure in [`LIVE_BACKUP_RESTORE_RUNBOOK.md`](LIVE_BACKUP_RESTORE_RUNBOOK.md) and records evidence using the templates in [`/reports/templates/`](../../../reports/templates/).

## 1. Purpose

Provide a single, auditable place that defines:

- Who must authorise live backup / restore.
- The exact prerequisites and stop-conditions.
- The dry-run-first procedure.
- The runbook each step references.
- The rollback plan.
- The evidence templates the operator fills in.
- The fields that must never be committed to the repo (secret values).

## 2. Prerequisites (must all be true before live run)

1. Sprint 12 backup dry-run is **PASS** — see `docs/iterlaw/project/12-backup-go-live/SPRINT_12_BACKUP_GO_LIVE_QA_REPORT.md`.
2. Sprint 13 operator readiness is **PASS** — see `docs/iterlaw/project/13-backup-mvp-polish/SPRINT_13_BACKUP_MVP_POLISH_QA_REPORT.md` and the `FIRST_LIVE_BACKUP_AUTHORISATION_CHECKLIST.md` is signed.
3. **Named operator** is on duty and has accepted accountability.
4. Operator workstation has the required env vars exported in-shell (NEVER in repo):
   - `ITERLAW_LIVE_BACKUP_APPROVED=true`
   - `ITERLAW_LIVE_BACKUP_OPERATOR=<name>` (no secret content)
   - `ITERLAW_LIVE_BACKUP_TARGET=<dst path or named target identifier; no DSN string>`
   - `ITERLAW_LIVE_RESTORE_VERIFY_APPROVED=true` (only when restore-verify is also authorised)
   - `ITERLAW_LIVE_RESTORE_VERIFY_TARGET=<isolated drill target id; no DSN string>`
5. Approval file exists at the operator-local path `~/.iterlaw/live-backup-restore-approval.json` (NOT in this repo). The repo only ships a **template** at `templates/LIVE_BACKUP_RESTORE_APPROVAL_TEMPLATE.md`.
6. Safety check script passes: `scripts/operator/check-live-backup-restore-authorisation.ps1` exits 0.

## 3. Secret handling

- Postgres / Borg / cloud credentials NEVER appear in the repo, in commit messages, in reports, in the approval file, or in env-var **values** committed anywhere.
- The env vars listed above are **flags + identifiers**, never DSNs or passwords.
- Operator workstation handles DSNs only via the existing Sprint 12 / 13 backup scripts, which already redact DSN substrings from manifests and reports.
- If a secret value ever appears in evidence collected during the live run, the operator must redact it before the report is committed.

## 4. Dry-run-first procedure (re-validates each live run)

Before each live backup OR live restore-verify the operator runs the existing dry-run scripts and confirms they exit 0:

```
# Backup dry-run (already passes in Sprint 12)
pwsh -File scripts/backup/iterlaw-db-backup-dry-run.ps1

# Restore-verify dry-run (already passes in Sprint 12 / 13)
pwsh -File scripts/backup/iterlaw-db-restore-verify-dry-run.ps1
```

If either fails, **STOP**. Do not proceed with the live run.

## 5. Backup command template

Run from the operator workstation only. Variables are operator-shell only.

```
$env:ITERLAW_BACKUP_DATABASE_URL = "<set-locally-not-in-repo>"
$env:ITERLAW_BACKUP_TARGET_PATH  = "<set-locally>"
pwsh -File scripts/backup/iterlaw-db-backup.ps1   # actual live backup script
```

The exact script name + path is in `docs/iterlaw/project/12-backup-go-live/SPRINT_12_BACKUP_RESTORE_RUNBOOK.md`. This pack does **not** copy or fork that script. The operator MUST be the one to invoke it.

## 6. Restore-verify command template

Run from the operator workstation against an **isolated drill target only** (NEVER production).

```
$env:ITERLAW_RESTORE_DATABASE_URL = "<isolated-target-only>"
pwsh -File scripts/backup/iterlaw-db-restore-verify.ps1
```

The Sprint 12 restore-verify script already refuses any live mode when `ITERLAW_RESTORE_DATABASE_URL` is empty or points at a non-isolated host.

## 7. Rollback plan

See [`LIVE_BACKUP_RESTORE_ROLLBACK_PLAN.md`](LIVE_BACKUP_RESTORE_ROLLBACK_PLAN.md). Summary:

- Backup-step failure: stop, do not retry, retain partial archive on the operator workstation, capture the failure in the evidence template, escalate.
- Restore-verify-step failure: stop, do not promote any restored data into production, retain logs, escalate.
- Suspected secret leak in any report: revert the commit before push; if pushed, rotate the credential, force-push is forbidden — use a `git revert` commit and rotate.

## 8. Evidence required

Operator fills:

- `reports/templates/ITERLAW_LIVE_BACKUP_EVIDENCE_TEMPLATE.md` — copy to a timestamped file under `reports/` and commit only after redaction review.
- `reports/templates/ITERLAW_LIVE_RESTORE_EVIDENCE_TEMPLATE.md` — same.

These templates intentionally have **no fields for DSNs, passwords, or other secret values**.

## 9. Acceptance criteria for flipping G12 / G13 to PASS

| Gate | Acceptance |
|---|---|
| G12 Live backup dry-run | Sprint 12 / 13 reports already PASS the dry-run scope. **Live execution** of a real backup against the operator-managed DB and a written, redacted evidence report under `reports/` are required to flip from PARTIAL to PASS. |
| G13 Live restore verification | A real restore-verify against an **isolated** drill target (NEVER production), with redacted evidence report. |

After live execution, the operator updates `docs/iterlaw/project/PRODUCTION_READINESS_GATE.json` to flip the relevant gate's `status` to `"PASS"`, points `evidence_path` at the new timestamped report, and clears `blocker`.

## 10. Stop conditions (any one stops the run)

- Dry-run fails (any non-zero exit).
- Operator approval env var or approval file is missing.
- Operator suspects credential exposure.
- Target host check fails (e.g., restore target matches a forbidden production identifier).
- Disk space < 2× the expected backup archive size.
- Network access to the target is unstable.
- Any IterLaw safety gate (citation, no external LLM, etc.) shows a regression in CI within the last 24h.

## 11. Sign-off chain

- **Operator** runs the procedure.
- **Reviewer** (separate person) reads the redacted evidence report before commit.
- **Operator** commits the redacted evidence + gate flip in a single commit.
- **Reviewer** confirms the push by inspecting `git log` on origin.

If you are the operator AND the reviewer, the live run is **postponed** until a second pair of eyes is available. No exceptions.

## 12. What must never be committed

- Real DSNs (`postgres://user:password@host:port/db`).
- Real passwords / API keys / tokens.
- Real backup archive paths that contain a credential or a host identifier.
- Anything that would let a reader of the repo reconstruct the production target.
- Any field whose value resembles PEM private-key material (classic RSA or OpenSSH key block headers), GitHub PATs (`ghp_…`), OpenAI-style keys (`sk-…`), AWS access keys (`AKIA…`), or Google API keys (`AIza…`).

## 13. Companion files (in this commit)

- [`LIVE_BACKUP_RESTORE_RUNBOOK.md`](LIVE_BACKUP_RESTORE_RUNBOOK.md) — step-by-step operator runbook.
- [`LIVE_BACKUP_RESTORE_ROLLBACK_PLAN.md`](LIVE_BACKUP_RESTORE_ROLLBACK_PLAN.md) — rollback / failure handling.
- [`templates/LIVE_BACKUP_RESTORE_APPROVAL_TEMPLATE.md`](templates/LIVE_BACKUP_RESTORE_APPROVAL_TEMPLATE.md) — approval-file template (no real approval).
- [`/reports/templates/ITERLAW_LIVE_BACKUP_EVIDENCE_TEMPLATE.md`](../../../reports/templates/ITERLAW_LIVE_BACKUP_EVIDENCE_TEMPLATE.md) — backup evidence template.
- [`/reports/templates/ITERLAW_LIVE_RESTORE_EVIDENCE_TEMPLATE.md`](../../../reports/templates/ITERLAW_LIVE_RESTORE_EVIDENCE_TEMPLATE.md) — restore evidence template.
- [`/scripts/operator/check-live-backup-restore-authorisation.ps1`](../../../scripts/operator/check-live-backup-restore-authorisation.ps1) — safety check that exits non-zero when approval is missing.
