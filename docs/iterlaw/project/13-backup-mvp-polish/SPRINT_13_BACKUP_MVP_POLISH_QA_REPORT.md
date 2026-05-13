# Sprint 13 — Backup MVP Polish + Operator Readiness — QA Report

Report date: 2026-05-13.

## 1. Starting state

- Starting HEAD: `625bb75` (Sprint 12 closeout).
- Branch: `master`, ahead 6 of `origin/master`.
- Working tree: clean except for one pre-existing untracked file
  `reports/CURSOR_AUDIT_CLAUDE_SPRINT_11_12_QA_REPORT.md` (third-party
  Cursor audit produced before this sprint started; not touched).
- Sprint 11 commits already on `origin/master` (`3681fab`, `120b9de`,
  `00f03f9`).
- Sprint 12 commits (`a750f88` → `625bb75`) local-only, awaiting
  operator authorisation to push.

## 2. Files created

| Path | Purpose |
| --- | --- |
| `docs/iterlaw/project/13-backup-mvp-polish/ADR_SPRINT_13_BACKUP_MVP_POLISH_AND_OPERATOR_READINESS.md` | Sprint 13 ADR — operator-workstation readiness only; defines `--check` contract, smoke-test contract, forbidden actions |
| `docs/iterlaw/project/13-backup-mvp-polish/SPRINT_13_OPERATOR_TOOLCHAIN_CHECK.md` | Operator setup + troubleshooting (Windows / Linux / macOS) |
| `docs/iterlaw/project/13-backup-mvp-polish/FIRST_LIVE_BACKUP_AUTHORISATION_CHECKLIST.md` | One-page operator decision document (default APPROVE: NO) |
| `apps/legal-orchestrator/src/tests/sprint13BackupReadinessSmoke.test.ts` | 8 tests — `/ready` envelope shape + no backup env-var leak + `handleLegalRequest` mock-RAG refusal behaviour |
| `apps/legal-orchestrator/src/tests/sprint13BackupToolchainCheck.test.ts` | 17 tests — `--check` mode safety + Sprint 12 invariant carry-over |
| `docs/iterlaw/project/13-backup-mvp-polish/SPRINT_13_BACKUP_MVP_POLISH_QA_REPORT.md` | This report |

## 3. Files changed

| Path | Purpose |
| --- | --- |
| `scripts/backup/iterlaw-db-backup.sh` | Added `--check` toolchain probe branch (lines 33–77 region). Pre-existing live + dry-run paths unchanged. |
| `scripts/backup/iterlaw-db-restore-verify.sh` | Added `--check` toolchain probe branch. Pre-existing live + dry-run paths unchanged. |
| `PROJECT.md` | Sprint 13 PASS-for-operator-workstation-readiness; sprint count → 13 completed |
| `ITERLAW_PROJECT_STATUS.md` | Same |
| `docs/iterlaw/ITERLAW_PROJECT_STATUS.md` | Same |
| `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md` | Same |
| `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` | Sprint 13 row added; quick-state lines updated |

## 4. Commands run

### Build + tests

| Command (cwd `apps/legal-orchestrator`) | Exit | Result |
| --- | --- | --- |
| `npx tsc --noEmit` | 0 | PASS |
| `npm run build` (`tsc`) | 0 | PASS |
| `npx vitest run src/tests/sprint12BackupScripts.test.ts` | 0 | 39 / 39 PASS (Sprint 12 baseline, regression check) |
| `npx vitest run src/tests/sprint13BackupToolchainCheck.test.ts` | 0 | **17 / 17 PASS** |
| `npx vitest run src/tests/sprint13BackupReadinessSmoke.test.ts` | 0 | **8 / 8 PASS** |
| `npx vitest run` (full suite) | 0 | **61 files / 827 tests PASS** (Sprint 12 baseline was 59 / 802 → **+2 files / +25 tests**) |

### Backup + restore CLI exercises (from repo root)

```text
$ bash scripts/backup/iterlaw-db-backup.sh --check
{"project":"iterlaw","mode":"check","script":"iterlaw-db-backup","database_touched":false,"production_touched":false,"network_opened":false,"kubectl_called":false,"pg_dump_available":false,"sha256_available":true,"date_available":true,"mktemp_available":true,"ready_for_dry_run":true,"ready_for_live_backup":false,"reason_live_backup_not_ready":"operator authorisation and ITERLAW_BACKUP_DATABASE_URL required; --check mode never authorises live backup","secret_redaction":true}

$ bash scripts/backup/iterlaw-db-restore-verify.sh --check
{"project":"iterlaw","mode":"check","script":"iterlaw-db-restore-verify","database_touched":false,"production_touched":false,"network_opened":false,"kubectl_called":false,"pg_restore_available":false,"psql_available":false,"sha256_available":true,"date_available":true,"mktemp_available":true,"node_available":true,"ready_for_dry_run":true,"live_restore_authorised":false,"reason_live_restore_not_authorised":"first live restore requires explicit operator authorisation per FIRST_LIVE_BACKUP_AUTHORISATION_CHECKLIST.md; --check mode never authorises live restore","secret_redaction":true}

$ bash scripts/backup/iterlaw-db-backup.sh --dry-run --output-dir ./tmp/sprint13-backup-test --label sprint13-dry-run
iterlaw-db-backup: dry-run manifest written:
  ./tmp/sprint13-backup-test/iterlaw-sprint13-dry-run-20260513T054808Z.manifest.json

$ node scripts/backup/verify-backup-manifest.mjs ./tmp/sprint13-backup-test/iterlaw-sprint13-dry-run-20260513T054808Z.manifest.json
manifest OK

$ bash scripts/backup/iterlaw-db-restore-verify.sh --dry-run \
    --backup-manifest ./tmp/sprint13-backup-test/iterlaw-sprint13-dry-run-20260513T054808Z.manifest.json \
    --report-out ./tmp/sprint13-backup-test/restore-verify-report.json
iterlaw-db-restore-verify: dry-run report written:
  ./tmp/sprint13-backup-test/restore-verify-report.json
```

## 5. `--check` evidence

### Backup `--check`

- `database_touched`: `false` ✓
- `production_touched`: `false` ✓
- `network_opened`: `false` ✓
- `kubectl_called`: `false` ✓
- `ready_for_live_backup`: `false` ✓ (hard-coded; never self-authorises)
- `secret_redaction`: `true` ✓
- `pg_dump_available`: `false` on this workstation (expected — pg_dump is not installed locally; live mode would fail cleanly with exit 5)
- `sha256_available`, `date_available`, `mktemp_available`: all `true`

### Restore `--check`

- `database_touched`: `false` ✓
- `production_touched`: `false` ✓
- `network_opened`: `false` ✓
- `kubectl_called`: `false` ✓
- `live_restore_authorised`: `false` ✓ (hard-coded; never self-authorises)
- `secret_redaction`: `true` ✓
- `pg_restore_available`, `psql_available`: `false` (matches workstation toolchain state)
- `node_available`: `true`

## 6. Dry-run backup result

- Manifest produced: **YES** (`iterlaw-sprint13-dry-run-20260513T054808Z.manifest.json`)
- `command_mode`: `dry-run` ✓
- `secret_redaction`: `true` ✓
- `project`: `iterlaw` ✓
- `sha256`: `null` (correct for dry-run) ✓
- No DSN, no `POSTGRES_PASSWORD`, no `BORG_PASSPHRASE`, no `sk-…` in the manifest body.

## 7. Dry-run restore result

- Report produced: **YES** (`restore-verify-report.json`).
- `restore_mode`: `dry-run` ✓
- `production_restore_attempted`: `false` ✓
- `destructive_action_performed`: `false` ✓
- `restore_target_host`: `[REDACTED]` ✓
- `secret_redaction`: `true` ✓
- `verification_status`: `OK` ✓

## 8. Manifest validation result

- `node scripts/backup/verify-backup-manifest.mjs <manifest>` exit 0 with output `manifest OK`.

## 9. Safety scan result

| Scan | Hit count | Classification | Unsafe? |
| --- | --- | --- | --- |
| `DATABASE_URL/POSTGRES_PASSWORD/PGPASSWORD/postgres://...` in `docs/.../13-backup-mvp-polish` | 20 | All env-var names, denylist constants, placeholders (`<password>`), or forbidden-policy text | NO |
| `production ready / verified / live backup complete / live restore complete / Sprint 13 PASS / Sprint 13 complete` | 5 | All in ADR's forbidden-claim list or in a clearly-conditional context ("If the first live backup completes successfully" — describes a future state) | NO |
| `kubectl apply / delete / patch / edit / scale / rollout` in `scripts/backup` | 0 | — | NO |
| `RightsNow / rightsnow` in `docs/.../13-backup-mvp-polish` | 0 | — | NO |

No unsafe credential exposure, no production claim, no kubectl mutating verb, no legacy product name.

## 10. Production touch result

- Production touched: **NO**.
- Production DB: **NOT TOUCHED**.
- Production cluster: **NOT TOUCHED**.

## 11. Live backup result

- Live backup: **NOT EXECUTED**.
- `ITERLAW_BACKUP_DATABASE_URL`: **NOT SET** at any point.

## 12. Live restore result

- Live restore: **NOT EXECUTED**.
- `ITERLAW_RESTORE_DATABASE_URL`: **NOT SET** at any point.

## 13. kubectl production inspection

- **NOT RUN.** Only available context is `aks-iterlaw-we-prod`; operations rules prohibit any kind of production-context touch.

## 14. Final git status (pre-QA commit)

```
## master...origin/master [ahead 10]
?? reports/CURSOR_AUDIT_CLAUDE_SPRINT_11_12_QA_REPORT.md
```

The 10 ahead commits are Sprint 12 (`a750f88`–`625bb75`, six commits) + Sprint 13 (`45a10e3`–`ba3a586`, four commits) + this QA report commit. Sprint 12 + Sprint 13 commits remain unpushed.

## 15. Final sprint status

**Sprint 13 — PASS FOR OPERATOR-WORKSTATION READINESS ONLY.**

Evidence:
- ADR `45a10e3` defines scope, `--check` contract, smoke-test contract.
- `--check` modes `42bd355` exit 0 cleanly with the contracted JSON shape on both scripts.
- Operator toolchain doc + 25 new tests `0d01b5b`.
- First-live-backup authorisation checklist `ba3a586` (default NO).
- Full vitest: 61 / 827 PASS.
- Safety scans clean.

Not claimed:
- production verified — **NO**;
- production approved — **NO**;
- ready for production — **NO**;
- deployed — **NO**;
- first live backup authorised — **NO**;
- first live restore authorised — **NO**;
- IterLaw production-ready — **NO**.

## 16. Truth statement

- No deployment performed.
- No production DB touched.
- No production restore attempted.
- No destructive DB action performed.
- No kubectl mutating command performed.
- No kubectl read-only command performed against any cluster.
- No secret values printed.
- No external LLM call performed.
- Backup `--check` completed: **YES**.
- Restore `--check` completed: **YES**.
- Backup dry-run completed: **YES**.
- Restore dry-run completed: **YES**.
- Live backup completed: **NO**.
- Live restore completed: **NO**.
- First live backup authorised: **NO**.
- Sprint 13 status: **PASS FOR OPERATOR-WORKSTATION READINESS ONLY**.
- Sprint 14 status: **PLANNED**.
- Production status: **BLOCKED**.
