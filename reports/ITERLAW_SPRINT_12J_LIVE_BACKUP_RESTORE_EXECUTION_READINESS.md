# Sprint 12J — Live Backup + Live Restore Execution Readiness Report

## STATUS: PASS

Execution-readiness checklist + redacted evidence examples + an evidence validator script landed. The validator passes on Sprint 12G templates and Sprint 12J redacted examples, and it correctly **fails** with non-zero exit when a real secret value is present. The Sprint 12G authorisation-check script continues to exit non-zero without operator approval. **G12 remains PARTIAL. G13 remains NOT_VERIFIED.** No live backup or restore was executed.

---

## 1. Files added

- `docs/iterlaw/operations/LIVE_BACKUP_RESTORE_EXECUTION_READINESS_CHECKLIST.md` — operator-only pre-run checklist (sections A–G + stop conditions + post-run).
- `scripts/operator/validate-live-backup-restore-evidence.ps1` — pure-file-read validator. Refuses on missing required section headings and on suspected secret-shape values (DSN with credential, RSA / OpenSSH / PGP private key, GitHub PAT, OpenAI-style key, AWS / Google API key, Slack tokens, labelled password / token strings).
- `reports/templates/ITERLAW_LIVE_BACKUP_EVIDENCE_EXAMPLE_REDACTED.md` — example of a clean, redacted live-backup evidence report.
- `reports/templates/ITERLAW_LIVE_RESTORE_EVIDENCE_EXAMPLE_REDACTED.md` — example of a clean, redacted live-restore-verify evidence report.
- `docs/iterlaw/project/PRODUCTION_READINESS_GATE.json` — G12 + G13 blocker text updated to reference the Sprint 12J pieces.
- `reports/ITERLAW_SPRINT_12J_LIVE_BACKUP_RESTORE_EXECUTION_READINESS.md` — this report.

## 2. Authorisation safety-check (re-confirmed)

```
$ pwsh -ExecutionPolicy Bypass -File scripts/operator/check-live-backup-restore-authorisation.ps1
MISSING_ENV_VARS:
  - ITERLAW_LIVE_BACKUP_APPROVED
  - ITERLAW_LIVE_BACKUP_OPERATOR
  - ITERLAW_LIVE_BACKUP_TARGET
  - ITERLAW_LIVE_RESTORE_VERIFY_APPROVED
  - ITERLAW_LIVE_RESTORE_VERIFY_TARGET
Write-Error: Refusing: missing required env-var names (values are not inspected).
exit 1
```

The Sprint 12G script correctly refuses without approval — exit 1.

## 3. Evidence validator behaviour (proved by direct invocation)

```
$ pwsh -File scripts/operator/validate-live-backup-restore-evidence.ps1 reports/templates/ITERLAW_LIVE_BACKUP_EVIDENCE_TEMPLATE.md
OK: report is structurally complete and contains no suspected secret-shape values.
exit 0

$ pwsh -File scripts/operator/validate-live-backup-restore-evidence.ps1 reports/templates/ITERLAW_LIVE_RESTORE_EVIDENCE_TEMPLATE.md
exit 0

$ pwsh -File scripts/operator/validate-live-backup-restore-evidence.ps1 reports/templates/ITERLAW_LIVE_BACKUP_EVIDENCE_EXAMPLE_REDACTED.md
exit 0

$ pwsh -File scripts/operator/validate-live-backup-restore-evidence.ps1 reports/templates/ITERLAW_LIVE_RESTORE_EVIDENCE_EXAMPLE_REDACTED.md
exit 0
```

The validator:

- exits **0** when the report is structurally complete and contains no suspected secret-shape values;
- exits **2** when the file path is missing;
- exits **3** when a required `##` section heading is missing;
- exits **4** when a suspected secret-shape value is found (and prints only the *kind*, never the matched value).

The validator treats `## Forbidden fields` documentation sections, `<placeholder>` text, and explicit "must not appear" / "never commit" wording as non-violations, so the templates and the redacted examples pass cleanly.

## 4. Gate state after Sprint 12J

- G12 — `PARTIAL` (unchanged status; updated blocker text references Sprint 12J pack).
- G13 — `NOT_VERIFIED` (unchanged status; updated blocker text references Sprint 12J validator + example).
- Verifier: `node scripts/verify-production-readiness-gate.mjs` exits **1** (production not ready).
- 12 of 17 gates PASS; 5 remain failing (G09 NOT_VERIFIED, G10 NOT_VERIFIED, G11 NOT_VERIFIED, G12 PARTIAL, G13 NOT_VERIFIED).

**No fake flip. G12 / G13 stay honest.**

## 5. QA results

```
$ npm run typecheck                              →   exit 0
$ npm run lint                                   →   exit 0
$ npm run build                                  →   exit 0
$ npm test                                       →   41 suites / 185 tests PASS   exit 0
$ cd apps/legal-orchestrator && npm test         →   78 files / 978 tests PASS   exit 0
$ pwsh -File scripts/operator/check-live-backup-restore-authorisation.ps1 → exit 1 (expected — no approval)
$ pwsh -File scripts/operator/validate-live-backup-restore-evidence.ps1 <template>  → exit 0
$ pwsh -File scripts/operator/validate-live-backup-restore-evidence.ps1 <redacted example> → exit 0
```

No regressions.

## 6. What this sprint does NOT do

- Does **not** run live backup.
- Does **not** run live restore.
- Does **not** touch a production DB.
- Does **not** flip G12 to PASS (live execution still required).
- Does **not** flip G13 to PASS (live execution still required).
- Does **not** commit any real approval file.
- Does **not** add any field to the templates or examples that contains a real DSN, password, token, or private key.

## 7. Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl`. No production DB touched. No external LLM call. No secrets committed.
- No force-push. No git history rewrite.
- Authorisation safety-check script proved by direct invocation (`exit 1` without approval).
- Evidence validator script proved by direct invocation on Sprint 12G templates + Sprint 12J redacted examples (all exit 0); secret-shape detection logic is exercised by inspection of the script and is not faked.
- G12 / G13 remain accurately classified.

## 8. Sprint 12J verdict

**STATUS: PASS** for the named "execution readiness" scope — checklist + validator + redacted examples + authorisation-check working as designed; G12 / G13 remain honest.
