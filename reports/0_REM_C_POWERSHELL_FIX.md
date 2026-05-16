# Sprint 0-Rem-C: PowerShell Smoke Script Fix

## Summary

- **Status:** PASS
- **Objective:** Repair the PowerShell smoke script syntax/runtime blocker
- **Branch:** `feature/0-rem-c-powershell-fix`

## File Repaired

- `scripts/smoke/iterlaw-mvp-smoke.ps1`

## Fixes

- Replaced the ambiguous production-ready negation regex character class with explicit `\u2014` / hyphen alternation.
- Replaced remaining non-ASCII em dashes in comments/output strings with ASCII hyphens so Windows PowerShell reads the file consistently.
- Updated `Run-And-Capture` to temporarily use `Continue` error action while capturing child-process stderr. This prevents benign stderr, such as `next lint` deprecation warnings, from terminating the smoke runner.

## Verification

| Check | Result |
|---|---|
| PowerShell parser syntax check | PASS |
| `powershell -ExecutionPolicy Bypass -File scripts/smoke/iterlaw-mvp-smoke.ps1` | PASS |
| Smoke checks passed | 14 |
| Smoke checks failed | 0 |
| Smoke checks not run | 2 live server checks, gated by `ITERLAW_MVP_SMOKE_RUN_SERVER=1` |

## Generated Evidence

- `reports/ITERLAW_SPRINT_16_MVP_SMOKE_TEST_READINESS_2026-05-16T19-28-58.md`

## Sign-Off

Complete.
