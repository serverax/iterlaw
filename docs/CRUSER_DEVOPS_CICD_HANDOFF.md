# Cruser: DevOps & CI/CD Handoff

**Branch:** `phase0/step7-qa-pool`  
**Status:** Ready to merge; GitHub **variables/secrets** and branch protection are still operator steps  
**Date:** May 28, 2026  

> **Commit:** Do not rely on a frozen SHA from an older doc (`ff32ac9`, etc.). After merge, use `git rev-parse HEAD` or the GitHub merge commit as the record of what shipped.

This document matches the **current** repository layout. If an older handoff only lists `ci.yml` and `backup-database.yml`, treat this file as **authoritative** — workflows were split into a **reusable** job plus thin callers, and backups live in **`backup.yml`**.

---

## What shipped: workflow inventory

| File | Purpose | When it runs | Gating / notes |
|------|---------|----------------|----------------|
| **`ci-reusable.yml`** | Single job: checkout → Node 20 → `npm ci` → lint → typecheck → `test:ci` + coverage → build → artifact → optional Codecov | `workflow_call` only | Invoked by other workflows |
| **`ci.yml`** | Push CI | **Every push** (all branches) | Concurrency: `ci-push-…` |
| **`pull-request.yml`** | PR validation | **Pull requests** targeting **`master`** only | Same reusable job; concurrency: `ci-pr-…` |
| **`test.yml`** | Scheduled / manual full CI | **Weekly** (Mon 12:00 UTC) + `workflow_dispatch` | Not on every push (avoids duplicate minutes) |
| **`build.yml`** | Manual full CI | `workflow_dispatch` only | Debugging / parity with Actions |
| **`deploy-staging.yml`** | Vercel deploy (non-prod args) | Push to **`master`** | `vars.VERCEL_DEPLOY_ENABLED == 'true'` |
| **`deploy-production.yml`** | Vercel production + optional smoke + Slack | `workflow_dispatch` + confirm `YES` | `vars.VERCEL_PROD_DEPLOY_ENABLED == 'true'` |
| **`backup.yml`** | `pg_dump` → S3 | Manual; cron **commented** until you enable | `vars.DATABASE_BACKUP_ENABLED == 'true'` |
| **`.github/DEVOPS.md`** | Variables, secrets, troubleshooting | Reference | Keep in sync with workflows |

Legacy name **`backup-database.yml`** is **removed**; use **`backup.yml`**.

---

## Pipeline behaviour (accurate)

### Shared CI job (`ci-reusable.yml`)

1. Checkout  
2. Node **20**, `cache: npm`  
3. `npm ci`  
4. `npm run lint` (Next.js ESLint)  
5. `npm run typecheck`  
6. `npm run test:ci` with `lcov` + `text-summary` reporters  
7. `npm run build`  
8. Upload `coverage/lcov.info` as artifact (14 days)  
9. Codecov upload **if** `coverage/lcov.info` exists — `continue-on-error: true`; optional `secrets.CODECOV_TOKEN`  

**Callers:** `ci.yml` (push), `pull-request.yml` (PRs → `master`), `test.yml`, `build.yml`.

### Staging deploy (`deploy-staging.yml`)

- **If** `VERCEL_DEPLOY_ENABLED=true`: `npm ci` → `npm run build` → `amondnet/vercel-action` with `vercel-args: '--prod=false'`.  
- **Does not** run `npm run ci` before deploy (unlike production workflow).  
- **Slack:** steps present; run only when `SLACK_NOTIFY_ENABLED=true` and `SLACK_WEBHOOK` is set.

### Production deploy (`deploy-production.yml`)

- Requires `confirmation == YES` **and** `VERCEL_PROD_DEPLOY_ENABLED=true`.  
- Runs **`npm run ci`** (lint, typecheck, test, build) **before** Vercel deploy.  
- **Smoke:** if repository variable `PRODUCTION_URL` is non-empty, curls **`${PRODUCTION_URL}/`** (root), **not** `/api/health` — with `continue-on-error: true`.  
- **Slack:** optional success/failure notifications when `SLACK_NOTIFY_ENABLED=true`.

### Backups (`backup.yml`)

- Custom-format `pg_dump` using secret `SUPABASE_DATABASE_URL` (not necessarily named like local `.env`).  
- AWS via `configure-aws-credentials` → upload to `s3://${{ secrets.AWS_BACKUP_BUCKET }}/…/rightsnow.dump`.  
- Optional Slack when enabled.

---

## `package.json` scripts (current)

| Script | Command | CI usage |
|--------|---------|----------|
| `lint` | `next lint` | Reusable workflow |
| `typecheck` | `tsc --noEmit` | Reusable workflow |
| `test` | `jest` | Local / `npm run ci` |
| `test:coverage` | `jest --coverage` | Local |
| `test:ci` | `jest --coverage --passWithNoTests` | **Reusable workflow** (coverage in CI) |
| `ci` | lint → typecheck → **test** (no coverage) → build | **Production deploy gate** |

**Note:** `npm run ci` uses plain `jest` (no `--coverage`). GitHub’s main CI path uses **`test:ci`** for coverage + lcov. If you want local parity with Actions, run `npm run test:ci` before push, or align `ci` script later (product choice).

---

## GitHub configuration checklist

### Variables (Settings → Secrets and variables → Actions → **Variables**)

| Variable | Typical value |
|----------|-----------------|
| `VERCEL_DEPLOY_ENABLED` | `true` when staging deploy from `master` is desired |
| `VERCEL_PROD_DEPLOY_ENABLED` | `true` to allow production workflow |
| `DATABASE_BACKUP_ENABLED` | `true` when backup secrets exist |
| `SLACK_NOTIFY_ENABLED` | `true` when `SLACK_WEBHOOK` is set |
| `PRODUCTION_URL` | e.g. `https://rightsnow.app` — **variable**, not a secret; used for optional curl |

### Secrets

| Secret | Used by |
|--------|---------|
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_SCOPE`, `VERCEL_PROJECT_ID_STAGING`, `VERCEL_PROJECT_ID_PRODUCTION` | Deploy workflows |
| `CODECOV_TOKEN` | Optional Codecov |
| `SLACK_WEBHOOK` | Staging / production / backup when Slack enabled |
| `SUPABASE_DATABASE_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BACKUP_BUCKET` | `backup.yml` |

**Do not** put `PRODUCTION_URL` in secrets unless you have a specific reason — the workflow reads **`vars.PRODUCTION_URL`**.

### Branch protection (`master`)

- Require PR before merge.  
- Require status checks: pick the names GitHub shows for **CI** and/or **PR Validation** (both exercise the same reusable job).  
- Prefer “up to date with base” if the team wants linear history.

---

## Day-to-day flow

1. **Branch + push** → **CI** workflow runs on push.  
2. **Open PR to `master`** → **PR Validation** runs.  
3. **Merge to `master`** → CI runs again on `master`; if `VERCEL_DEPLOY_ENABLED=true`, **Deploy staging** runs.  
4. **Production** → Actions → **Deploy production** → type `YES`.

There is **no** automatic PR comment step in these YAML files; failures are visible on the **Checks** tab.

---

## Intentional design vs “many parallel workflows on every event”

| Older idea | This repo | Why |
|------------|-----------|-----|
| Separate full pipelines on every push/PR | One **`ci-reusable.yml`** | One `npm ci` + one test/build path per event |
| `backup-database.yml` | **`backup.yml`** | Renamed; same role |
| Slack always on | **Gated** by `SLACK_NOTIFY_ENABLED` | Forks and empty secrets stay green |
| `/api/health` smoke | Root URL curl **if** `PRODUCTION_URL` set | No health route requirement yet |

---

## Gaps (not bugs)

| Item | Status |
|------|--------|
| E2E on staging | Commented placeholder in `deploy-staging.yml`; add when Playwright + `STAGING_URL` exist |
| PR bot comments | Not implemented; use GitHub Checks UI |
| Scheduled backups | Uncomment `schedule` in `backup.yml` after secrets + variable are stable |

---

## After merge

1. Set variables/secrets above.  
2. Confirm **CI** + **PR Validation** on a test PR.  
3. Merge to `master` and confirm staging deploy (if enabled).  
4. Keep **`.github/DEVOPS.md`** and **this file** updated when workflow names or secrets change.

---

## Summary

- **Reusable CI** + **push** + **PR to `master`** cover day-to-day quality.  
- **Deploys and backups are gated** so forks and new repos do not fail.  
- **Slack** is implemented but **off** until you flip the variable and add the webhook.  
- **Operator truth** for names and tables: **`.github/DEVOPS.md`** + this handoff.
