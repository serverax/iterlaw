# Phase C — Remediation & stress testing

**Date:** 2026-05-18

## Executed

| Test | Command | Result |
|------|---------|--------|
| DB performance | `npx tsx apps/legal-orchestrator/scripts/stress-test-db-performance.ts` | **3/3 passed** (3–9 ms queries) |
| Orchestrator health stress | `npx tsx apps/legal-orchestrator/scripts/stress-test-answer-pipeline.ts` | Health probes OK against `:8081` |
| k6 load test | `k6 run load-test.js` | **NOT EXECUTED** — k6 not installed on runner host |

## Fixes applied in this phase

1. Restored `apps/web/app/dashboard/page.tsx` from `master` (removed broken `AuthContext` / `CaseContext` imports).
2. Regenerated root `package-lock.json` for `npm ci` on GitHub Actions (linux optional deps).
3. Added `load-test.js`, orchestrator stress scripts, production readiness checklist.

## Open items (post-audit)

- Install k6 and run full staged load test against staging URL.
- Resolve 3 high npm audit findings (transitive via `eslint-config-next`).
- Implement missing PRD paths listed in `docs/MISSING-FILES-INVENTORY.md`.
- Enable Azure staging deploy (`ENABLE_AZURE_DEPLOY` + secrets).
