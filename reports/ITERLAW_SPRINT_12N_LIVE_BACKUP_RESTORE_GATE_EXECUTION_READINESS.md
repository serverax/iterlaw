# Sprint 12N — Live backup + restore gate execution readiness

## Verdict: PASS (evidence gate correctly refuses without authorised evidence)

The Sprint 12L apply-script (`scripts/operator/apply-live-backup-restore-evidence-gate.ps1`) is verified to **refuse** correctly when no operator-supplied evidence files exist. No real backup or restore evidence is present in the repo; only Sprint 12J templates + redacted examples. **G12 and G13 are NOT flipped** by this sprint — that is the honest, correct outcome.

## Evidence discovery

```text
$ ls reports/ITERLAW_LIVE_BACKUP_EVIDENCE_*
(no such file or directory)

$ ls reports/ITERLAW_LIVE_RESTORE_EVIDENCE_*
(no such file or directory)

$ ls reports/templates/
ITERLAW_LIVE_BACKUP_EVIDENCE_EXAMPLE_REDACTED.md       (Sprint 12J redacted example — illustrative only)
ITERLAW_LIVE_BACKUP_EVIDENCE_TEMPLATE.md               (Sprint 12G template)
ITERLAW_LIVE_RESTORE_EVIDENCE_EXAMPLE_REDACTED.md      (Sprint 12J redacted example — illustrative only)
ITERLAW_LIVE_RESTORE_EVIDENCE_TEMPLATE.md              (Sprint 12G template)
```

No operator-run real evidence exists. The templates and redacted examples are documentation, not operator submissions.

## Dry-run refusal (no evidence paths)

```text
$ pwsh -ExecutionPolicy Bypass -File scripts/operator/apply-live-backup-restore-evidence-gate.ps1 -DryRun
REFUSAL: BACKUP_EVIDENCE_PATH_REQUIRED
Provide -BackupEvidencePath pointing to a redacted backup evidence report.
EVIDENCE_GATE_DRYRUN_EXIT=1
```

Script correctly refuses with exit 1 when no evidence path is supplied. **This is the documented safe behaviour.**

## What this sprint did NOT do

- Did **not** run any live backup.
- Did **not** run any live restore.
- Did **not** touch the production DB.
- Did **not** flip G12 / G13. They remain:
  - G12 PARTIAL — "Live backup execution NOT AUTHORISED."
  - G13 NOT_VERIFIED — "Live restore NOT AUTHORISED."
- Did **not** use the Sprint 12J redacted examples to flip the gate. Those files are illustrative and explicitly cannot stand in for operator evidence.

## Operator action required to flip G12 + G13

1. Authorise the live backup drill per `docs/iterlaw/operations/LIVE_BACKUP_RESTORE_AUTHORISATION_PACK.md`.
2. Execute the live backup against the operator-managed DB. Capture the redacted output to `reports/ITERLAW_LIVE_BACKUP_EVIDENCE_<timestamp>.md`.
3. Run the live restore against an isolated drill target. Capture redacted output to `reports/ITERLAW_LIVE_RESTORE_EVIDENCE_<timestamp>.md`.
4. Run the Sprint 12J evidence validator on each file (must exit 0).
5. Run the Sprint 12L apply-script in DryRun first:
   ```
   pwsh -ExecutionPolicy Bypass -File scripts/operator/apply-live-backup-restore-evidence-gate.ps1 `
     -BackupEvidencePath reports/ITERLAW_LIVE_BACKUP_EVIDENCE_<timestamp>.md `
     -RestoreEvidencePath reports/ITERLAW_LIVE_RESTORE_EVIDENCE_<timestamp>.md `
     -DryRun
   ```
6. Re-run without `-DryRun` to flip G12 + G13.
7. Commit the gate JSON change + the redacted evidence in a single commit.

## Production gate impact

None. G12 / G13 unchanged.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No live backup or restore executed.
- No production DB touched. No `kubectl` mutating command.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
- Sprint 12L apply-script's refusal behaviour reconfirmed on this workstation today.
