# IterLaw Live Backup + Live Restore Rollback Plan

> Operator-only. Do **not** retry blindly. Investigate, then decide.

## 1. Backup-step failure

| What happened | What to do |
|---|---|
| Script exit ≠ 0 with a transient error (e.g. disk full, network timeout) | Stop. Capture exit code and stderr. Do NOT retry until cause is identified. Free disk / restore connectivity. Re-run the **dry-run** before re-attempting the live run. |
| Script exit ≠ 0 with a configuration error (env var missing, target host check failed) | Stop. Fix the operator-shell env var or target host configuration. Do not commit the offending env var values. Re-run from §1 pre-flight. |
| Script exit = 0 but archive sha256 mismatch | Stop. Treat as a corrupt backup. Retain the archive for forensic inspection on the operator workstation. Do NOT promote. Escalate to reviewer. |
| Suspected credential exposure during run | Stop. Do NOT commit anything. Rotate the exposed credential through normal operator channels. Document the incident in the operator's secure tracker (not in this repo). |

## 2. Restore-verify-step failure

| What happened | What to do |
|---|---|
| Script exit ≠ 0 against the isolated drill target | Stop. Investigate. The restore evidence template captures the error. Do NOT consider the backup verified. G13 stays NOT_VERIFIED. |
| RLS smoke check returns non-zero rows for user-data tables | Stop. This means a policy regression. Do NOT promote. Capture exactly which table reported rows. Open a corrective sprint. |
| Restored DB count mismatch vs source | Stop. Treat as data-loss risk. Capture before/after counts. Do NOT promote. |

## 3. Suspected secret leak in any committed evidence

| What happened | What to do |
|---|---|
| Leak found before push | `git restore --staged <file>` to unstage; edit out the secret; re-stage; commit cleanly. |
| Leak found after push | **Do NOT force-push.** Add a `git revert` commit. Rotate the exposed credential. Inform reviewer + operator-team leadership. Update incident log. |

## 4. Promotion to production is OUT OF SCOPE for G12 / G13

G12 (live backup PASS) and G13 (live restore PASS) prove **the backup chain works**. They do **not** authorise restoring backup data into production. Any decision to restore production from a backup is a separate sprint with separate sign-off.

## 5. Hard stop conditions (immediately abandon the run)

- Any forbidden indicator on the operator host (`iterlaw-prod`, `aks-iterlaw-we-prod`, `PRODUCTION`, `prod-master`).
- Any forbidden value in `ITERLAW_RESTORE_DATABASE_URL` (the Sprint 12 / 13 scripts catch this and exit non-zero).
- Reviewer becomes unavailable mid-run.
- IterLaw safety gate regression observed in CI during the live run.

## 6. After rollback

- Update the evidence templates to record the failure cause and the rollback steps taken.
- Leave G12 / G13 as `PARTIAL` / `NOT_VERIFIED` in `PRODUCTION_READINESS_GATE.json`.
- Open a corrective sprint with a named scope.
