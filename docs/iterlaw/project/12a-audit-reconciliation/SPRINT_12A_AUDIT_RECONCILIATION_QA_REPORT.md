# Sprint 12A — Audit Reconciliation + Windows Bash Test Fix — QA Report

Report date: 2026-05-13.

## 1. Starting state vs audit

The Cursor audit (`reports/CURSOR_AUDIT_CLAUDE_SPRINT_11_12_QA_REPORT.md`)
was taken at **HEAD `00f03f9`, ahead 3 of `origin/master`** — i.e.
**before** the Sprint 12, 13, 14, and 15 commits were made locally.
The current repo HEAD at the start of Sprint 12A was `ae661cf`,
ahead 19 of `origin/master`, with all of Sprint 12/13/14/15 already
committed locally (none pushed).

Sprint 12A therefore does not "do" Sprint 12 work — that has already
shipped locally. Sprint 12A reconciles the audit's three legitimate
concerns that have NOT been fully addressed by subsequent work:

1. `SPRINT_INDEX.md` internal contradictions (P0 in the audit).
2. Stale source headers in `handleLegalRequest.ts` and
   `runLocalDraftingStep.ts` (P1).
3. Windows-bash spawn fragility in `sprint12BackupScripts.test.ts`
   and (subsequently) `sprint13BackupToolchainCheck.test.ts` (P3).

The audit report is **retained** at `reports/CURSOR_AUDIT_CLAUDE_SPRINT_11_12_QA_REPORT.md`
as instructed.

## 2. Files created

| Path |
| --- |
| `apps/legal-orchestrator/src/tests/helpers/resolveBash.ts` |
| `apps/legal-orchestrator/src/tests/resolveBash.test.ts` (5 tests) |
| `docs/iterlaw/project/12a-audit-reconciliation/SPRINT_12A_AUDIT_RECONCILIATION_QA_REPORT.md` (this file) |

## 3. Files changed

| Path | Why |
| --- | --- |
| `apps/legal-orchestrator/src/pipeline/handleLegalRequest.ts` | Replaced the stale "Skeleton-only" header that the audit flagged. New header documents Phase 4 wiring + Sprint 15 feature-flagged Intelligence Layer hooks. **No runtime behaviour change.** |
| `apps/legal-orchestrator/src/legal/llm/runLocalDraftingStep.ts` | Replaced the stale "the pipeline does NOT call this yet" header. New header documents that the helper has been wired since Sprint 11 Phase 4 commit `120b9de`. **No runtime behaviour change.** |
| `apps/legal-orchestrator/src/tests/sprint12BackupScripts.test.ts` | Replaced `bashAvailable()` skip pattern with `resolveBashPath()` from the new helper. Tests fail loudly when bash is missing (operator must set `BASH_PATH` or install Git Bash) — they no longer silently skip. |
| `apps/legal-orchestrator/src/tests/sprint13BackupToolchainCheck.test.ts` | Same migration to the resolver. |
| `apps/legal-orchestrator/src/tests/intelligenceActiveModeGuard.test.ts` | **Test 4 strengthened.** Previously read a single hardcoded file. Now walks `src/intelligence/`, `src/pipeline/`, `src/config/` and asserts every `*.ts` runtime source file is free of `fetch(`, `axios(`, provider SDK imports, and `new OpenAI(` / `new Anthropic(`. Test files are excluded so the test never false-positives on its own forbidden-pattern literals. |
| `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` | Audit P0 fix — removed contradictions: Sprint 11 "UNBLOCKED / READY TO START" line (it is closed PASS); "Phase 2B + Phase 4 NOT STARTED" claim; mismatched sprint count (10 → 15) and current sprint (11 → 16). Sprint 10/11 row in the bottom table updated from PARTIAL to PASS. Duplicate `Planned` rows that used the now-taken numbers 13/14/15 renumbered to 16/17/18/19/20/21/22. Added explicit Sprint 12A row. |

## 4. Commands run

| Command (cwd `apps/legal-orchestrator`) | Exit | Result |
| --- | --- | --- |
| `npx tsc --noEmit` | 0 | PASS |
| `npm run build` (`tsc`) | 0 | PASS |
| `npx vitest run src/tests/resolveBash.test.ts` | 0 | **5 / 5 PASS** |
| `npx vitest run src/tests/sprint12BackupScripts.test.ts` | 0 | **39 / 39 PASS** (the four previously-failing bash-spawn tests are now green) |
| `npx vitest run src/tests/sprint13BackupToolchainCheck.test.ts` | 0 | **17 / 17 PASS** |
| `npx vitest run src/tests/intelligenceActiveModeGuard.test.ts` | 0 | **6 / 6 PASS** (Test 4 now scans runtime directories) |
| `npx vitest run src/tests/intelligenceFeatureFlags.test.ts src/tests/intelligenceDisabledPath.test.ts src/tests/intelligenceShadowMode.test.ts src/tests/intelligenceGateway.test.ts` | 0 | **27 / 27 PASS** |
| `npx vitest run` (full suite) | 0 | **73 files / 912 tests PASS** (Sprint 15 baseline 72 / 907 → +1 file / +5 tests) |

## 5. Sprint 12A dry-run re-runs (Task 4)

```text
$ bash scripts/backup/iterlaw-db-backup.sh --dry-run \
    --output-dir ./tmp/sprint12a-backup-test --label sprint12a-dry-run
iterlaw-db-backup: dry-run manifest written:
  ./tmp/sprint12a-backup-test/iterlaw-sprint12a-dry-run-20260513T062507Z.manifest.json

$ node scripts/backup/verify-backup-manifest.mjs <manifest>
manifest OK

$ bash scripts/backup/iterlaw-db-restore-verify.sh --dry-run \
    --backup-manifest <manifest> \
    --report-out ./tmp/sprint12a-backup-test/restore-verify-report.json
iterlaw-db-restore-verify: dry-run report written:
  ./tmp/sprint12a-backup-test/restore-verify-report.json
```

Manifest invariants in dry-run:
- `"sha256": null` (correct for dry-run; live mode would compute a 64-hex value).
- `"project": "iterlaw"`.
- `"command_mode": "dry-run"`.
- `"secret_redaction": true`.

Restore-verify report invariants:
- `"restore_target_host": "[REDACTED]"` — host never logged.
- `"restore_mode": "dry-run"`.
- `"production_restore_attempted": false`.
- `"destructive_action_performed": false`.
- `"secret_redaction": true`.
- No DSN / password / token leaked in either artefact.

## 6. Root cause of the failing test (Sprint 12A Task 1 deep-dive)

The audit's `sprint12BackupScripts.test.ts` failure (`execFileSync("bash") ENOENT`) had three root causes:

- (B) and (E) — `bashAvailable()` was used to decide whether to skip,
  but `spawnSync("bash", ...)` itself was not guarded by the resolver
  on every code path (and `execFileSync("bash", ...)` was called
  unconditionally in the test bodies). On a Windows host without
  bash on PATH, `execFileSync` raised ENOENT.
- A separate Sprint 15 failure surfaced during Sprint 12A
  (`intelligenceActiveModeGuard.test.ts > Test 4`) had root cause **(B)**:
  the test was scanning one hardcoded file and its own newly-added
  documentation comment contained the literal token `fetch(` inside
  a backticked phrase. The runtime had no actual `fetch(` call. Fix:
  replaced the single-file scan with a directory walk that excludes
  test files, and tightened the regex set. Runtime source is now
  scanned across `src/intelligence/`, `src/pipeline/`, `src/config/`.

| Question | Answer |
| --- | --- |
| Real `fetch(` / `axios(` in runtime source? | **NO** |
| Test scanning its own forbidden tokens? | YES (Sprint 15 Test 4); fixed via directory walk + test-file exclusion |
| Active provider SDK import? | **NO** |
| Network egress added? | **NO** |

## 7. Safety scan result

| Scan target | Hits | Classification | Unsafe? |
| --- | --- | --- | --- |
| `fetch(\|axios(\|from 'axios'\|openai\|anthropic\|gemini\|claude` in `apps/legal-orchestrator/src/intelligence` | 0 | — | NO |
| Same scan in `apps/legal-orchestrator/src/pipeline` | 0 | — | NO |
| Same scan in `apps/legal-orchestrator/src/config` | 0 | — | NO |
| `RightsNow / rightsnow` in Sprint 12A paths | 0 | — | NO |
| `production ready / verified / go-live approved / live backup complete / live restore complete` in updated status docs | 0 | — | NO |
| `kubectl apply / delete / patch / edit / scale / rollout` in Sprint 12A paths | 0 | — | NO |

## 8. Final git status (pre-commit)

```
## master...origin/master [ahead 19]
 M ITERLAW_PROJECT_STATUS.md  (status touch from Sprint 15, not yet flushed)
... (other modified files staged in Sprint 12A commit sequence below)
?? reports/CURSOR_AUDIT_CLAUDE_SPRINT_11_12_QA_REPORT.md  (audit report — retained, not committed by this sprint)
?? docs/iterlaw/project/12a-audit-reconciliation/  (this report's directory)
?? apps/legal-orchestrator/src/tests/helpers/  (resolveBash helper)
?? apps/legal-orchestrator/src/tests/resolveBash.test.ts
```

## 9. Sprint 12A final status

**Sprint 12A — PASS.**

Evidence:
- `SPRINT_INDEX.md` contradictions reconciled into a single consistent narrative.
- Source-file headers in `handleLegalRequest.ts` and `runLocalDraftingStep.ts` now match the wired behaviour (Phase 4 + Sprint 15 feature flag).
- `resolveBash.ts` helper + 5 dedicated tests added.
- Sprint 12 + Sprint 13 bash-using tests migrated to the resolver and now PASS on the audit host (no silent skip).
- Intelligence active-mode guard (Test 4) strengthened to scan directories rather than a single file, eliminating the self-scan false-positive risk.
- Sprint 12 dry-run backup + manifest validation + dry-run restore-verify all PASS end-to-end.
- Full vitest: **73 files / 912 tests PASS**.
- Safety scans clean.
- Cursor audit report retained at `reports/CURSOR_AUDIT_CLAUDE_SPRINT_11_12_QA_REPORT.md` (not deleted).

Not claimed:
- production ready — **NO**;
- production verified — **NO**;
- live backup complete — **NO**;
- live restore complete — **NO**;
- first live backup authorised — **NO**;
- production deployment — **NO**.

## 10. Truth statement

- Production touched: **NO**.
- kubectl run against any cluster: **NO**.
- Deployment performed: **NO**.
- External LLM called: **NO**.
- New `fetch(` / `axios(` in runtime source: **NO**.
- Secrets committed: **NO**.
- Live backup executed: **NO**.
- Live restore executed: **NO**.
- First live backup authorised: **NO**.
- Cursor audit report deleted: **NO** (retained).
- Sprint 11/12/13/14/15 closed states regressed: **NO**.
- Sprint 12A status: **PASS** (audit reconciliation + Windows bash test fix).
- Sprint 16 status: **PLANNED**.
- Production status: **BLOCKED**.
