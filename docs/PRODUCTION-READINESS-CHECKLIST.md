# Production Readiness Checklist

**Date:** 2026-05-18  
**Status:** NOT READY (see blockers)

## Code quality

| Check | Status |
|-------|--------|
| ESLint (web) | PASS |
| TypeScript (web) | PASS after dashboard restore |
| Jest CI | PASS (227 tests; coverage thresholds aligned) |
| Legal-orchestrator Vitest | PASS locally; verify on CI |
| `main-ci-cd.yml` | Pushed; re-run after lockfile fix |

## Performance

| Check | Status |
|-------|--------|
| DB queries &lt; 100 ms (smoke) | PASS (3/3) |
| k6 load 100–1000 users | NOT RUN (k6 missing) |
| Answer API stress | Health-only script added |

## Security

| Check | Status |
|-------|--------|
| npm audit critical | 0 critical |
| npm audit high | 3 (documented) |
| TLS / field encryption / RLS | Verify in target environment |

## Architecture (PRD)

See `docs/MISSING-FILES-INVENTORY.md` — **7** modules missing at PRD paths.

## Deployment

| Check | Status |
|-------|--------|
| GitHub Actions unified pipeline | Created |
| Branch protection | Manual — `docs/GITHUB-PHASE-A-SETUP.md` |
| Staging Azure deploy | Gated on secrets |
| Production environment approval | Gate 7 in workflow |

## Legal / launch gates

See `docs/go-nogo/` — Condition 1 (legal reviewer) still blocks Sprint 1 engineering.

## Sign-off

**GO / NO-GO:** NO-GO until CI green on `main-ci-cd`, high audit items triaged, and go/no-go Condition 1 met.
