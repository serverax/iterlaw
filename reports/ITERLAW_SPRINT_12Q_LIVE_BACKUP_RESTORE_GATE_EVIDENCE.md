# Sprint 12Q — Live backup + restore gate evidence

## Verdict: PARTIAL / NOT_VERIFIED

Readiness verification only. **No live backup or live restore executed.** No operator-supplied authorised evidence exists; the Sprint 12L apply-script correctly refuses without paths (exit 1). **G12 stays PARTIAL. G13 stays NOT_VERIFIED.** Per Option C (the operator's standing instruction this session), live execution is not authorised; this sprint records that fact and re-confirms the script's refusal contract.

## What I checked (non-mutating)

```text
$ ls reports/ITERLAW_LIVE_BACKUP_EVIDENCE_*
(no such file or directory)

$ ls reports/ITERLAW_LIVE_RESTORE_EVIDENCE_*
(no such file or directory)

$ ls reports/templates/
ITERLAW_LIVE_BACKUP_EVIDENCE_EXAMPLE_REDACTED.md   (Sprint 12J redacted example — illustrative only)
ITERLAW_LIVE_BACKUP_EVIDENCE_TEMPLATE.md           (Sprint 12G template)
ITERLAW_LIVE_RESTORE_EVIDENCE_EXAMPLE_REDACTED.md  (Sprint 12J redacted example — illustrative only)
ITERLAW_LIVE_RESTORE_EVIDENCE_TEMPLATE.md          (Sprint 12G template)
```

No operator-authored real evidence. Templates + redacted examples only. Cannot be used to flip the gates.

## Apply-script refusal re-confirmed

```text
$ pwsh -ExecutionPolicy Bypass -File scripts/operator/apply-live-backup-restore-evidence-gate.ps1 -DryRun
REFUSAL: BACKUP_EVIDENCE_PATH_REQUIRED
Provide -BackupEvidencePath pointing to a redacted backup evidence report.
EVIDENCE_GATE_DRYRUN_EXIT=1
```

Script correctly refuses with exit 1 when no evidence path is supplied. **This is the documented safe behaviour. G12 / G13 are not flipped.**

## What this sprint did NOT do

- Did **not** run any live backup.
- Did **not** run any live restore.
- Did **not** touch the production DB.
- Did **not** flip G12 or G13. They remain:
  - G12 PARTIAL — "Live backup execution NOT AUTHORISED."
  - G13 NOT_VERIFIED — "Live restore NOT AUTHORISED."
- Did **not** use the Sprint 12J redacted examples to flip the gate. Those files are illustrative and explicitly cannot stand in for operator evidence.
- Did **not** alter `scripts/infra/verify-iterlaw-live-readonly.ps1` (host-truth still unresolved — see Sprint 12P).

## Operator action required to flip G12 + G13

Same path as Sprint 12N:

1. Operator authorises the live backup drill per `docs/iterlaw/operations/LIVE_BACKUP_RESTORE_AUTHORISATION_PACK.md`.
2. Execute the live backup against the operator-managed DB. Capture redacted output as `reports/ITERLAW_LIVE_BACKUP_EVIDENCE_<timestamp>.md`.
3. Run the live restore against an isolated drill target. Capture redacted output as `reports/ITERLAW_LIVE_RESTORE_EVIDENCE_<timestamp>.md`.
4. Run the Sprint 12J validator on each file. Must exit 0.
5. DryRun the Sprint 12L apply-script with both evidence paths. Must exit 0 and print the planned delta.
6. Re-run without `-DryRun` to flip G12 + G13 atomically.
7. Commit the gate JSON change + the redacted evidence in a single commit.

## Production gate impact

None. G12 / G13 unchanged.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- **No live backup or restore executed.**
- No production DB touched. No `kubectl` mutating command.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
- Sprint 12L apply-script's refusal behaviour reconfirmed today on this workstation.
