# Sprint 12L — Live backup / restore evidence gate

## Verdict: PASS

Operator-side gate script added. **No live backup or restore executed by this sprint.** G12 and G13 are **unchanged** (G12 PARTIAL, G13 NOT_VERIFIED) because the example evidence files are illustrative; only operator-supplied validated redacted evidence can flip the gates. The script is proven against the Sprint 12J redacted examples in DryRun mode without touching the gate JSON.

## Files

- **New script:** `scripts/operator/apply-live-backup-restore-evidence-gate.ps1` (≈155 lines).
- **Gate JSON blocker text refreshed:** `docs/iterlaw/project/PRODUCTION_READINESS_GATE.json` — G12 + G13 blockers now reference the Sprint 12L apply-script.
- **Docs updated:** `docs/iterlaw/project/PRODUCTION_READINESS_GATE.md`, `docs/iterlaw/operations/LIVE_BACKUP_RESTORE_EXECUTION_READINESS_CHECKLIST.md`, `docs/iterlaw/operations/LIVE_BACKUP_RESTORE_RUNBOOK.md`.

## Script contract

| Behaviour | Result |
|---|---|
| Missing `-BackupEvidencePath` | exit 1 + `REFUSAL: BACKUP_EVIDENCE_PATH_REQUIRED` |
| Missing `-RestoreEvidencePath` | exit 1 + `REFUSAL: RESTORE_EVIDENCE_PATH_REQUIRED` |
| Backup evidence file does not exist | exit 1 + `REFUSAL: BACKUP_EVIDENCE_NOT_FOUND` |
| Restore evidence file does not exist | exit 1 + `REFUSAL: RESTORE_EVIDENCE_NOT_FOUND` |
| Validator refuses backup evidence | exit 1 + `REFUSAL: BACKUP_EVIDENCE_VALIDATION_FAILED` |
| Validator refuses restore evidence | exit 1 + `REFUSAL: RESTORE_EVIDENCE_VALIDATION_FAILED` |
| Backup verdict ≠ PASS | exit 1 + `REFUSAL: BACKUP_VERDICT_NOT_PASS` |
| Restore verdict ≠ PASS | exit 1 + `REFUSAL: RESTORE_VERDICT_NOT_PASS` |
| `-DryRun` + valid inputs | prints planned G12 + G13 deltas; **does NOT write** |
| Valid inputs, no `-DryRun` | atomically updates G12 + G13 (and `last_updated`) in the gate JSON |

The script touches **only** G12 and G13. All other gate entries are preserved byte-for-byte by the JSON parse / re-serialise loop, which only re-assigns `status`, `last_verified_at`, `blocker`, and `evidence_path` on the two target gates.

## Evidence

```text
$ pwsh -ExecutionPolicy Bypass -File scripts/operator/apply-live-backup-restore-evidence-gate.ps1 -DryRun
REFUSAL: BACKUP_EVIDENCE_PATH_REQUIRED
EVIDENCE_GATE_DRYRUN_EXIT=1

$ pwsh -ExecutionPolicy Bypass -File scripts/operator/apply-live-backup-restore-evidence-gate.ps1 `
    -BackupEvidencePath  reports/templates/MISSING-FILE-DOES-NOT-EXIST.md `
    -RestoreEvidencePath reports/templates/ITERLAW_LIVE_RESTORE_EVIDENCE_EXAMPLE_REDACTED.md `
    -DryRun
REFUSAL: BACKUP_EVIDENCE_NOT_FOUND
EVIDENCE_GATE_DRYRUN_EXIT=1

$ pwsh -ExecutionPolicy Bypass -File scripts/operator/apply-live-backup-restore-evidence-gate.ps1 `
    -BackupEvidencePath  reports/templates/ITERLAW_LIVE_BACKUP_EVIDENCE_EXAMPLE_REDACTED.md `
    -RestoreEvidencePath reports/templates/ITERLAW_LIVE_RESTORE_EVIDENCE_EXAMPLE_REDACTED.md `
    -DryRun
Validating backup evidence...
Validating restore evidence...
Backup evidence verdict:  PASS
Restore evidence verdict: PASS
PLANNED_CHANGES:
  - G12: PARTIAL -> PASS
  - G13: NOT_VERIFIED -> PASS
DRY_RUN: no file written.
EVIDENCE_GATE_DRYRUN_EXIT=0
```

Gate JSON status before and after the DryRun: **unchanged** (`git status -sb docs/iterlaw/project/PRODUCTION_READINESS_GATE.json` shows only the Sprint 12L blocker-text edit; G12 still PARTIAL, G13 still NOT_VERIFIED).

## Verdict-line detection

The script accepts two PASS shapes:

- Canonical: `Verdict: PASS` or `Status: PASS` (case-insensitive).
- Sprint 12J redacted-example shape: `Ready to flip G12 to PASS: YES` (backup) / `Ready to flip G13 to PASS: YES` (restore).

Anything else is treated as not-PASS and refused.

## Safety verification

- The script does **not** open any network socket. The validator it invokes is the Sprint 12J validator, which is itself pure file-read + string-scan.
- The script does **not** read `DATABASE_URL` or any other env var. It never prints anything from the evidence content beyond the detected verdict word.
- The script does **not** execute a backup or a restore.
- The script does **not** modify any gate other than G12 and G13.

## Production gate impact

None today. The script is a tool. **G12 stays PARTIAL. G13 stays NOT_VERIFIED.** The blocker text on both gates now references the Sprint 12L apply-script.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No live backup or restore executed.
- No `git push --force`. No git history rewrite.
- No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
- The example evidence files used to exercise the DryRun path are the existing Sprint 12J redacted examples; no new evidence was authored by this sprint.
