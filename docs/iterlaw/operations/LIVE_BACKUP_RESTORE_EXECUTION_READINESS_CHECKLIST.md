# IterLaw Live Backup / Live Restore — Execution Readiness Checklist

> **Operator-only.** This checklist is what the operator works through *before* invoking the live backup or restore. It does **not** authorise execution by itself. The Sprint 12G [`LIVE_BACKUP_RESTORE_AUTHORISATION_PACK.md`](LIVE_BACKUP_RESTORE_AUTHORISATION_PACK.md) remains the binding authorisation contract.

## How to use

For each box below, the operator either ticks it after capturing real evidence, or **stops** until the gap is fixed. **No box can be ticked on a future intent.** Either the prerequisite exists right now, or the box stays unticked and the run is postponed.

---

## A. Identity + authorisation

- [ ] I am the **named operator** on duty for this run.
- [ ] A separate **named reviewer** is available for the full duration of the run.
- [ ] An approval file exists at the operator-local path (default `~/.iterlaw/live-backup-restore-approval.json`) and is **not** committed to the repo.
- [ ] The approval file's `authorisation_window_end` is today or in the future.
- [ ] The Sprint 12G safety-check script returns exit 0:
  ```
  pwsh -ExecutionPolicy Bypass -File scripts/operator/check-live-backup-restore-authorisation.ps1
  ```

## B. Environment safety

- [ ] My shell does **not** point at a production K3s context (`kubectl config current-context`).
- [ ] My env var `KUBECONTEXT` does **not** contain `iterlaw-prod`, `aks-iterlaw-we-prod`, `PRODUCTION`, or `prod-master`.
- [ ] My hostname does **not** match a production-host indicator.
- [ ] All required env-var **names** are exported in-shell (the values stay in my shell only — never written to the repo, never echoed):
  - `ITERLAW_LIVE_BACKUP_APPROVED`
  - `ITERLAW_LIVE_BACKUP_OPERATOR`
  - `ITERLAW_LIVE_BACKUP_TARGET`
  - `ITERLAW_LIVE_RESTORE_VERIFY_APPROVED` (if restore-verify is also planned this session)
  - `ITERLAW_LIVE_RESTORE_VERIFY_TARGET` (same)

## C. Pre-flight dry-run

- [ ] Sprint 12 / Sprint 13 backup dry-run script ran successfully **today**:
  ```
  pwsh -File scripts/backup/iterlaw-db-backup-dry-run.ps1   # or equivalent dry-run entry point
  ```
- [ ] Sprint 12 / Sprint 13 restore-verify dry-run script ran successfully **today**.
- [ ] Disk space on the operator workstation is **≥ 2× the expected backup archive size**.
- [ ] Network reachability to the operator-managed DB target is stable.

## D. Restore target safety

- [ ] The restore target identifier (`ITERLAW_LIVE_RESTORE_VERIFY_TARGET`) refers to an **isolated drill target**, not production.
- [ ] The restore target hostname / DSN does **not** contain `iterlaw-prod`, `aks-iterlaw-we-prod`, `prod-master`, or any other production identifier.
- [ ] The restore-verify script's built-in production-host refusal will trigger if the target is wrong.

## E. Evidence preparation

- [ ] I have a copy of `reports/templates/ITERLAW_LIVE_BACKUP_EVIDENCE_TEMPLATE.md` ready to fill in a timestamped report.
- [ ] I have a copy of `reports/templates/ITERLAW_LIVE_RESTORE_EVIDENCE_TEMPLATE.md` ready (if restore-verify is in scope).
- [ ] I will run `pwsh -File scripts/operator/validate-live-backup-restore-evidence.ps1 <my-report>` before commit to confirm the report contains no DSN / password / token / private-key shapes.

## F. Stop conditions (any single one stops the run)

- [ ] Authorisation safety-check exits non-zero.
- [ ] Dry-run exits non-zero.
- [ ] Disk space below threshold.
- [ ] Network instability.
- [ ] Restore target appears to be production.
- [ ] Reviewer unavailable.
- [ ] IterLaw safety gate (citation, no-external-LLM, RLS) has regressed in CI within the last 24 hours.
- [ ] Any secret value would have to be committed to evidence to make the report complete.

## G. Post-run

- [ ] Operator fills the timestamped evidence report.
- [ ] Operator runs `scripts/operator/validate-live-backup-restore-evidence.ps1 <report>` and gets exit 0.
- [ ] Reviewer reads the report, applies a redaction pass, and approves.
- [ ] Operator updates `docs/iterlaw/project/PRODUCTION_READINESS_GATE.json`: flips `G12` / `G13` to `PASS`, sets `evidence_path`, sets `last_verified_at`, clears `blocker`.
- [ ] Operator commits and pushes the **redacted** evidence + gate flip in a single commit.
- [ ] Reviewer confirms by inspecting `git log` on origin.

---

## What this checklist will never authorise

- Running live backup or live restore without the Sprint 12G approval file.
- Restore against production.
- Committing a real DSN, password, API key, token, or private key to any file in the repo.
- Force-push, history rewrite, or `kubectl` mutation against production.
- Marking G12 / G13 as PASS without redacted evidence captured under `reports/`.
