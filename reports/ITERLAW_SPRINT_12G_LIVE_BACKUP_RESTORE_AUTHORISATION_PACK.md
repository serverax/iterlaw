# Sprint 12G — Live Backup + Restore Authorisation Pack Report

## STATUS: PASS

Authorisation pack landed: authorisation doc, runbook, rollback plan, approval template, two evidence templates, and a safety-check script that **correctly exits non-zero** when approval is missing. No live backup. No live restore. No production DB touched. G12 and G13 remain `PARTIAL` / `NOT_VERIFIED` until operator-supplied evidence flips them — by design.

---

## 1. Files added

| File | Role |
|---|---|
| `docs/iterlaw/operations/LIVE_BACKUP_RESTORE_AUTHORISATION_PACK.md` | Authorisation contract: prerequisites, env vars, secret handling, dry-run-first, evidence requirements, sign-off chain, stop conditions, forbidden-fields list. |
| `docs/iterlaw/operations/LIVE_BACKUP_RESTORE_RUNBOOK.md` | Operator step-by-step procedure. References existing Sprint 12 / 13 backup scripts; this pack does NOT copy them. |
| `docs/iterlaw/operations/LIVE_BACKUP_RESTORE_ROLLBACK_PLAN.md` | Failure handling, suspected-leak handling, hard-stop conditions. |
| `docs/iterlaw/operations/templates/LIVE_BACKUP_RESTORE_APPROVAL_TEMPLATE.md` | Operator-local approval-file template. Repo NEVER ships a completed approval. |
| `reports/templates/ITERLAW_LIVE_BACKUP_EVIDENCE_TEMPLATE.md` | Live backup evidence form. No DSN / password / token fields. |
| `reports/templates/ITERLAW_LIVE_RESTORE_EVIDENCE_TEMPLATE.md` | Live restore-verify evidence form. No DSN / password / token fields. |
| `scripts/operator/check-live-backup-restore-authorisation.ps1` | Safety-check script. Reads env-var **names** + approval file. Never reads or prints field values. Exits non-zero unless every prerequisite is met. |
| `docs/iterlaw/project/PRODUCTION_READINESS_GATE.json` | G12 and G13 blocker text updated to point at the Sprint 12G pack and templates. Statuses unchanged (`PARTIAL` / `NOT_VERIFIED`). |
| `reports/ITERLAW_SPRINT_12G_LIVE_BACKUP_RESTORE_AUTHORISATION_PACK.md` | This report. |

## 2. Safety-check script proof

```
$ pwsh -ExecutionPolicy Bypass -File scripts/operator/check-live-backup-restore-authorisation.ps1
MISSING_ENV_VARS:
  - ITERLAW_LIVE_BACKUP_APPROVED
  - ITERLAW_LIVE_BACKUP_OPERATOR
  - ITERLAW_LIVE_BACKUP_TARGET
  - ITERLAW_LIVE_RESTORE_VERIFY_APPROVED
  - ITERLAW_LIVE_RESTORE_VERIFY_TARGET
Write-Error: Refusing: missing required env-var names (values are not inspected).
exit: 1
```

The script identifies the missing **names** without reading any values, exits non-zero, and does not attempt any DB or network call. This is the expected behaviour from a workstation with no approval. The Sprint 12G acceptance test is "blocks without approval" — confirmed.

## 3. Safety properties of the pack

- **No DB connection** anywhere in the pack scripts or templates.
- **No network call** anywhere in the pack scripts or templates.
- **No `kubectl`** anywhere in the pack scripts or templates.
- **No secret values committed** — the evidence templates explicitly omit DSN / password / token fields and call out the forbidden-fields list.
- **No live backup execution** — the runbook routes the operator to the existing Sprint 12 scripts, which already perform their own production-host refusals.
- **No live restore execution** — same. Restore is gated to an "isolated drill target" by both the runbook and the Sprint 12 restore-verify script's refusal logic.

## 4. Gate updates

| Gate | Before | After | Reason |
|---|---|---|---|
| G12 Live backup dry-run | `PARTIAL` | `PARTIAL` (unchanged) | Dry-run is already PASS from Sprint 12. Live execution still requires operator evidence; blocker text updated to reference Sprint 12G pack. |
| G13 Live restore verification | `NOT_VERIFIED` | `NOT_VERIFIED` (unchanged) | Templates + script + runbook in place; live execution still requires operator evidence. `evidence_path` now points to the live-restore evidence template. |

Production readiness verifier still exits non-zero with the same number of failing gates — no false-PASS introduced.

## 5. QA results

```
$ npm run typecheck                              →   exit 0
$ npm run lint                                   →   exit 0
$ npm test                                       →   41 suites / 185 tests PASS   exit 0
$ pwsh -File scripts/operator/check-live-backup-restore-authorisation.ps1 → exit 1 (expected: refuses without approval)
```

Orchestrator suite remains stable at 75 files / 937 tests PASS (verified at Sprint 19 close; Sprint 12G adds only docs + script, no source change).

## 6. What this sprint deliberately does NOT do

- **No live backup execution.**
- **No live restore execution.**
- **No production DB read or write.**
- **No `kubectl` invocation.**
- **No flip of G12 to PASS** (live execution required).
- **No flip of G13 to PASS** (live execution required).
- **No real approval file in the repo** — only the template.
- **No secret values in any committed file.**

## 7. Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl`. No production DB touched. No external LLM call. No secrets committed.
- No force-push. No git history rewrite.
- No `npm audit fix --force`.
- Authorisation-check script proved by direct invocation; exits non-zero in the absence of approval.
- G12 / G13 remain accurately classified as PARTIAL / NOT_VERIFIED.

## 8. Sprint 12G verdict

**STATUS: PASS** for the named "authorisation pack" scope. Pack + scripts + templates committed; safety script blocks without approval; QA green; gates remain honest.
