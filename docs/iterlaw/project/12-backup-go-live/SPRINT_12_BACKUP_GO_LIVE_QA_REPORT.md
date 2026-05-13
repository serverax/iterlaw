# Sprint 12 — Backup Go-Live (Track B Dry-Run Foundation) — QA Report

Report date: 2026-05-13.
Report author: Claude (Opus 4.7) on operator workstation.

## 1. Starting + final HEAD

- Starting HEAD (Sprint 11 closeout, before Sprint 12 push): `00f03f9`.
- After Sprint 11 PASS push to `origin/master`: `00f03f9` (aligned).
- Final HEAD after Sprint 12 commits (pre-push): **`fdafca3`**.
- Origin alignment at report time: master ahead 5 of `origin/master`.

## 2. Files created

| Path | Purpose |
| --- | --- |
| `docs/iterlaw/project/12-backup-go-live/ADR_SPRINT_12_BACKUP_AND_RECOVERY_POLICY.md` | Sprint 12 ADR. Defines Track B scope, manifest + sha256 + production refusal policy. |
| `scripts/backup/iterlaw-db-backup.sh` | Dry-run-by-default operator-side backup. Refuses production hostnames. Emits manifest + sha256. |
| `scripts/backup/iterlaw-db-restore-verify.sh` | Dry-run-by-default restore verifier. Refuses identical source/target DSN and production targets. Emits redacted report. |
| `scripts/backup/verify-backup-manifest.mjs` | Node ESM CLI wrapper for the manifest validator. Exits non-zero on invalid manifests. |
| `scripts/backup/manifestValidator.mjs` | Pure ESM module: `validateManifest`, `REQUIRED_FIELDS`, `FORBIDDEN_VALUE_PATTERNS`. |
| `scripts/backup/restoreTargetValidator.mjs` | Pure ESM module: `validateRestoreTarget`, `isProductionHost`, `isProductionLabel`. |
| `apps/legal-orchestrator/src/tests/sprint12BackupScripts.test.ts` | 39 vitest tests covering validator positive + rejection, restore-target denylist, script static safety, end-to-end bash dry-runs. |
| `docs/iterlaw/project/12-backup-go-live/SPRINT_12_BACKUP_RESTORE_RUNBOOK.md` | Operator runbook for Track B. |
| `docs/iterlaw/project/12-backup-go-live/SPRINT_12_BACKUP_GO_LIVE_QA_REPORT.md` | This report. |

## 3. Files changed

The Sprint 12 commits do not modify any existing source under
`apps/legal-orchestrator/src/legal/**`, `apps/legal-orchestrator/src/pipeline/**`,
`apps/legal-orchestrator/src/types/**`, or any cluster-side manifest
in `k8s/iterlaw-data/backups/`. The new artefacts are additive.

Five status / index documents are updated in the final commit (Phase 11):
`PROJECT.md`, `ITERLAW_PROJECT_STATUS.md`, `docs/iterlaw/ITERLAW_PROJECT_STATUS.md`,
`docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md`,
`docs/iterlaw/project/07-sprints/SPRINT_INDEX.md`.

## 4. Commits

| # | Hash | Message |
| --- | --- | --- |
| 1 | `a750f88` | docs(iterlaw): define sprint 12 backup and recovery policy |
| 2 | `dad1906` | feat(backup): add safe iterlaw database backup script |
| 3 | `7683936` | feat(backup): add safe restore verification script |
| 4 | `4be05a6` | test(backup): add sprint 12 backup and restore safety tests |
| 5 | `fdafca3` | docs(iterlaw): add sprint 12 backup restore runbook |
| 6 | _pending_ | docs(iterlaw): record sprint 12 backup go-live QA |

(6 commits total this sprint; this report is one of them.)

## 5. Backup script evidence

### Dry-run end-to-end

```text
$ bash scripts/backup/iterlaw-db-backup.sh --dry-run \
    --output-dir ./tmp/sprint12-backup-test --label sprint12-dry-run
iterlaw-db-backup: dry-run manifest written:
  ./tmp/sprint12-backup-test/iterlaw-sprint12-dry-run-20260513T052304Z.manifest.json
```

### Manifest evidence

Captured manifest body (from the same dry-run; reviewed locally,
fields shown; no DSN / password / token present):

```json
{
  "backup_id": "iterlaw-sprint12-dry-run-20260513T052304Z-3215424674",
  "created_at_utc": "2026-05-13T05:23:04Z",
  "project": "iterlaw",
  "environment_label": "local-staging",
  "database_label": "local-docker",
  "backup_format": "custom",
  "compressed": true,
  "dump_file": "iterlaw-sprint12-dry-run-20260513T052304Z.pgcustom",
  "checksum_file": "iterlaw-sprint12-dry-run-20260513T052304Z.pgcustom.sha256",
  "sha256": null,
  "retention_days": 14,
  "tool_versions": { "pg_dump": "unknown", "bash": "5.3.9(1)-release", "node": "v24.15.0" },
  "git_commit": "a750f8825464",
  "command_mode": "dry-run",
  "secret_redaction": true
}
```

- `project` = `iterlaw` ✓
- `command_mode` = `dry-run` ✓
- `sha256` = null (correct for dry-run) ✓
- `secret_redaction` = `true` ✓
- No DSN literal, no `POSTGRES_PASSWORD`, no `PGPASSWORD`, no
  `BORG_PASSPHRASE`, no `sk-…`, no `ghp_…`, no `AKIA…` ✓

### Manifest verifier CLI evidence

```text
$ node scripts/backup/verify-backup-manifest.mjs \
    ./tmp/sprint12-backup-test/iterlaw-sprint12-dry-run-20260513T052304Z.manifest.json
manifest OK
$ echo $?
0
```

## 6. Restore verification evidence

### Dry-run end-to-end

```text
$ bash scripts/backup/iterlaw-db-restore-verify.sh --dry-run \
    --backup-manifest ./tmp/sprint12-backup-test/iterlaw-sprint12-dry-run-20260513T052304Z.manifest.json \
    --report-out ./tmp/sprint12-backup-test/restore-report.json
iterlaw-db-restore-verify: dry-run report written:
  ./tmp/sprint12-backup-test/restore-report.json
```

### Report body

```json
{
  "restore_id": "restore-iterlaw-sprint12-dry-run-20260513T052304Z-3215424674-20260513T052643Z",
  "started_at_utc": "2026-05-13T05:26:43Z",
  "completed_at_utc": "2026-05-13T05:26:44Z",
  "source_backup_id": "iterlaw-sprint12-dry-run-20260513T052304Z-3215424674",
  "manifest_path_basename": "iterlaw-sprint12-dry-run-20260513T052304Z.manifest.json",
  "manifest_command_mode": "dry-run",
  "checksum_verified": false,
  "checksum_verified_reason": "dry-run",
  "restore_target_label": "restore-drill",
  "restore_target_host": "[REDACTED]",
  "restore_mode": "dry-run",
  "allow_empty_target_only": false,
  "production_restore_attempted": false,
  "destructive_action_performed": false,
  "pg_restore_list_result": "not_attempted",
  "verification_status": "OK",
  "secret_redaction": true,
  "git_commit": "dad1906acb83"
}
```

- `production_restore_attempted` = `false` ✓
- `destructive_action_performed` = `false` ✓
- `restore_mode` = `dry-run` ✓
- `restore_target_host` = `[REDACTED]` ✓
- `secret_redaction` = `true` ✓

## 7. Tests run

### `apps/legal-orchestrator/src/tests/sprint12BackupScripts.test.ts`

```text
$ npx vitest run src/tests/sprint12BackupScripts.test.ts
 ✓ src/tests/sprint12BackupScripts.test.ts (39 tests)
   ✓ dry-run: backup script — Test 8: dry-run produces a manifest    19248ms
   ✓ dry-run: backup script — Test 9: no secret-like value            5053ms
   ✓ dry-run: restore-verify — Test 10: secret_redaction true        12520ms
   ✓ dry-run: restore-verify — Test 11: refuses empty target          5966ms
 Test Files  1 passed (1)
       Tests 39 passed (39)
   Duration  46.73s
```

- 39 / 39 PASS.

### Full orchestrator suite

```text
$ npx vitest run
 Test Files  59 passed (59)
       Tests 802 passed (802)
   Duration  39.81s
```

- 59 files / 802 tests PASS (was 58 / 763 at Sprint 11 close → **+1
  test file, +39 tests** this sprint).

### Typecheck + build

```text
$ npx tsc --noEmit         # exit 0
$ npm run build            # tsc → exit 0
```

## 8. Safety scans

### Active source — credential leakage

```text
$ rg -n 'DATABASE_URL|POSTGRES_PASSWORD|postgres://|postgresql://|password=|PGPASSWORD|API_KEY|TOKEN|SECRET' scripts/backup docs/iterlaw/project/12-backup-go-live
```

Hits classification (no unsafe usage):

| Hit | Classification |
| --- | --- |
| `ITERLAW_BACKUP_DATABASE_URL` / `ITERLAW_RESTORE_DATABASE_URL` env-var names | **safe env-var name** |
| `postgres://...` in script comments (example invocations) | **safe docs warning** |
| `sed -e 's#postgres://[^ ]*#postgres://[REDACTED]#g'` in backup script | **safe forbidden-policy text** (DSN redaction) |
| `POSTGRES_PASSWORD` / `PGPASSWORD` in `manifestValidator.mjs` denylist | **safe forbidden-policy text** (denylist constants) |
| `DATABASE_URL` in ADR + runbook | **safe docs warning** |
| `password` in runbook (`<password>` placeholder) | **safe docs warning** |

No active credential literal.

### kubectl mutating verbs

```text
$ rg -n 'kubectl apply|kubectl delete|kubectl patch|kubectl edit|kubectl scale|kubectl rollout' scripts/backup
(no matches)
```

### Forbidden completion claims

```text
$ rg -n 'production verified|production approved|ready for production|Sprint 12 PASS|Sprint 12 complete' docs/iterlaw/project/12-backup-go-live scripts/backup
(no matches)
```

### Legacy product / banned namespace

```text
$ rg -n 'RightsNow|rightsnow|iterlaw-prod' scripts/backup
scripts/backup/iterlaw-db-restore-verify.sh:142:PRODUCTION_LIKE='iterlaw-postgres\.iterlaw-data\.svc\.cluster\.local|iterlaw-prod|\bprod\b'
scripts/backup/restoreTargetValidator.mjs:11:  /\biterlaw-prod\b/i,
scripts/backup/iterlaw-db-backup.sh:88:production_like_host_pattern='iterlaw-postgres\.iterlaw-data\.svc\.cluster\.local|iterlaw-prod|\bprod\b'
```

All three hits are **denylist patterns** (forbidden-policy text). **No
legacy RightsNow usage. No `iterlaw-prod` namespace usage.**

### Architecture mentions

```text
$ rg -n 'Azure|AKS|Key Vault' docs/iterlaw/project/12-backup-go-live
docs/.../ADR_SPRINT_12_BACKUP_AND_RECOVERY_POLICY.md:26:That design depends on a working AKS / k3s cluster ...
```

One hit — context-only reference to existing Track A's AKS dependency.
Safe docs warning.

## 9. K3s read-only inspection

- **NOT EXECUTED.**
- Rationale: the operator workstation's `kubectl config current-context`
  is `aks-iterlaw-we-prod` (production). The Sprint 12 task explicitly
  forbids touching production; even read-only `kubectl get` against a
  production context would violate the operations rule.
- No `kubectl get` of any kind was issued against any cluster during
  this sprint.
- No secret value was decoded or printed.

## 10. Live backup status

- **NOT EXECUTED.** No `ITERLAW_BACKUP_DATABASE_URL` was set; no
  `pg_dump` was run; no DB connection was opened.
- Live backup of any reachable database is an explicit operator
  decision and is outside the scope of this sprint's automation.

## 11. Live restore status

- **NOT EXECUTED.** No `ITERLAW_RESTORE_DATABASE_URL` was set; no
  isolated restore target was provisioned; no `pg_restore` was run.
- Live restore is operator-driven and remains outside Track B
  automation by design.

## 12. Production-touching status

- No production DB touched: **YES**.
- No production restore attempted: **YES**.
- No destructive DB action performed: **YES**.
- No kubectl mutating command performed: **YES**.
- No `kubectl` command of any kind issued: **YES**.
- No secret values printed: **YES**.

## 13. Remaining risks

1. **Track A unchanged.** Sprint 12 does not advance the cluster-side
   Borg path. Items §8.2 1–7 of `docs/infra/BACKUP_AND_RESTORE_RUNBOOK.md`
   remain operator-driven.
2. **No live drill performed.** Track B's first live backup + isolated
   restore-verify cycle has not happened. Until it does, the scripts
   are guaranteed-safe-by-construction but not guaranteed-safe-by-
   operator-experience.
3. **No alerting wired.** The Sprint 12 scripts do not alert on
   failure; they exit non-zero only. An operator running them in cron
   would need to wrap them.
4. **Single-host operator dependency.** Track B dumps written to the
   operator workstation are single-copy. Off-site replication remains
   Track A's responsibility.
5. **`pg_dump` may not be installed.** Live mode will exit code 5 if
   `pg_dump` is missing. Dry-run mode handles this gracefully.
6. **`sha256sum` requirement.** Live mode requires `sha256sum`. Most
   git-bash installs on Windows ship it; the script reports cleanly if
   missing.
7. **Manifest hand-editing.** The validator catches structural and
   secret-pattern issues but cannot detect deliberate tampering by an
   attacker who already has write access to the operator's disk. Disk
   encryption (FileVault / BitLocker / LUKS) is the operator's
   responsibility.
8. **CronJob still drafted only.** `k8s/iterlaw-data/backups/upload-cronjob.yaml`
   and `verify-cronjob.yaml` remain `iterlaw.io/status: draft-not-applied`.
   Sprint 12 does not change that.

## 14. Sprint 12 status decision

**Sprint 12 — PASS FOR DRY-RUN FOUNDATION ONLY.**

The new Track B path is implemented, tested, scanned clean, and
exercised end-to-end in dry-run. Live backup and live restore-verify
remain operator-driven and have not been executed during this sprint.

No claim is made that:
- production backup is verified;
- production restore is verified;
- the system is deployed or ready for production.

To upgrade from PASS-for-dry-run-foundation to a full PASS, the
operator must perform §6 of the runbook (live backup against a
non-production reachable DB) and §9 (restore-verify into an isolated
target) end-to-end and record the outputs.

## 15. Production status

**BLOCKED.** This sprint does not unblock production. The remaining
pre-production work continues to be tracked in
`docs/infra/BACKUP_AND_RESTORE_RUNBOOK.md` §8.2.

## 16. Truth statement

- No deployment performed.
- No production DB touched.
- No production restore attempted.
- No destructive DB action performed.
- No kubectl mutating command performed.
- No kubectl read-only command performed (production context only).
- No secret values printed.
- No external LLM call performed.
- Backup dry-run completed: **YES**.
- Restore dry-run completed: **YES**.
- Live backup completed: **NO**.
- Live isolated restore completed: **NO**.
- Sprint 12 status: **PASS FOR DRY-RUN FOUNDATION ONLY**.
- Sprint 13 status: **PLANNED**.
- Production status: **BLOCKED**.
