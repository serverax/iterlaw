# Cruser: DevOps — final accurate handoff

**Branch:** `phase0/step7-qa-pool`  
**Cite for PRs / audits:** doc tip **`0dc0f52`** (includes **`6083eaf`** commit-table alignment; or omit SHA and link the three paths below).  
**Accuracy baseline:** [`CRUSER_DEVOPS_ACCURACY_BASELINE.md`](./CRUSER_DEVOPS_ACCURACY_BASELINE.md)  

**Status:** Ready to push and merge; GitHub variables / secrets / branch protection are operator follow-ups  
**Date:** May 28, 2026  

## Three linked docs

Corrections and rationale: [`CRUSER_DEVOPS_ACCURACY_BASELINE.md`](./CRUSER_DEVOPS_ACCURACY_BASELINE.md).

Doc-only commits (newest first):

| Commit | What changed |
|--------|----------------|
| **`0dc0f52`** | PR cite synced to git tip; “corrections and rationale” link under **Three linked docs**; baseline **`6083eaf`** changelog section. |
| **`6083eaf`** | Commit table here (correct **baseline file → `7f6a926`**, not `84b29e4`); baseline header + `59a9609` changelog section. |
| **`59a9609`** | Baseline + handoff: cite `7f6a926` bundle, `test.yml` / `build.yml` **not** per-push/PR, “three linked docs” heading. |
| **`7f6a926`** | Added **`CRUSER_DEVOPS_ACCURACY_BASELINE.md`**; cross-links from this handoff + `.github/DEVOPS.md`. |
| **`84b29e4`** | Rewrote this handoff (8 workflows, double CI, backup path, `test:ci` vs `npm run ci`); DEVOPS two-run note. |

| File | Audience |
|------|----------|
| **This file** (`docs/CRUSER_DEVOPS_CICD_HANDOFF.md`) | Operators — what actually runs |
| **`CRUSER_DEVOPS_ACCURACY_BASELINE.md`** | Five corrections + commit changelog |
| **`.github/DEVOPS.md`** | Contributors — variables, secrets, quick setup |

---

## Eight workflows (all are `.yml` under `.github/workflows/`)

Documentation files are **not** workflows. The count **8** = eight YAML workflow files only:

| # | File | Purpose | Triggers | Gated? | Slack? |
|---|------|---------|----------|--------|--------|
| 1 | **`ci.yml`** | Full CI via reusable job | **Every push** (all branches) | No | No |
| 2 | **`pull-request.yml`** | Same CI for PRs | **Pull requests** → **`master`** only | No | No |
| 3 | **`ci-reusable.yml`** | Shared steps (lint, typecheck, `test:ci`, build, artifacts, Codecov) | **`workflow_call` only** | — | No |
| 4 | **`test.yml`** | Same reusable CI | **Weekly** Mon 12:00 UTC + **`workflow_dispatch`** | No | No |
| 5 | **`build.yml`** | Same reusable CI | **`workflow_dispatch`** only | No | No |
| 6 | **`deploy-staging.yml`** | Vercel non-prod | **Push** → **`master`** | **`VERCEL_DEPLOY_ENABLED`** | Optional (`SLACK_NOTIFY_ENABLED`) |
| 7 | **`deploy-production.yml`** | Vercel prod + smoke + Slack | **`workflow_dispatch`** + type **`YES`** | **`VERCEL_PROD_DEPLOY_ENABLED`** | Optional |
| 8 | **`backup.yml`** | `pg_dump` (custom) → S3 | **`workflow_dispatch`**; cron commented | **`DATABASE_BACKUP_ENABLED`** | Optional |

Legacy filename **`backup-database.yml`** is gone; use **`backup.yml`**.

---

## CI flow (what really happens)

### Every push (any branch)

`ci.yml` → calls `ci-reusable.yml` → one full job (`npm ci` → lint → typecheck → **`npm run test:ci`** → build → artifact → Codecov optional).

### Pull request to `master`

`pull-request.yml` → calls **`ci-reusable.yml` again** → another full job with its **own** `npm ci`.

**Important:** On the same repo, when you **push to a branch that already has an open PR** to `master`, GitHub will typically run **both** `ci.yml` (push) **and** `pull-request.yml` (pull_request synchronize). That is **two** workflow runs and **two** `npm ci` installs — same *definition* in `ci-reusable.yml`, not “shared minutes across events.” The win is **maintainability** (one YAML to edit), not halving Actions usage on every PR sync.

### Merge to `master`

1. Push to `master` triggers **`ci.yml`** again.  
2. If **`VERCEL_DEPLOY_ENABLED`** is `true`, **`deploy-staging.yml`** runs: `npm ci` → `npm run build` → Vercel (`--prod=false`). It does **not** run `npm run ci` before deploy (unlike production).

### Production (manual)

`deploy-production.yml`: `npm ci` → **`npm run ci`** (lint, typecheck, **jest without coverage**, build) → Vercel `--prod` → optional `curl` to **`${{ vars.PRODUCTION_URL }}/`** → optional Slack success/failure.

### Database backup (manual)

`backup.yml`: `pg_dump` **custom** format to `backup.dump`, upload to  
`s3://${{ secrets.AWS_BACKUP_BUCKET }}/$(date -u +%Y-%m-%d)/rightsnow.dump`  
(secret name **`AWS_BACKUP_BUCKET`**, not `AWS_BUCKET`). Optional Slack.

---

## `npm run ci` vs `npm run test:ci` (intentional)

| Command | What runs | Coverage / lcov |
|---------|-----------|-----------------|
| **`npm run ci`** | lint → typecheck → **`npm run test`** (plain Jest) → build | **No** — fast local gate |
| **`npm run test:ci`** | `jest --coverage --passWithNoTests` | **Yes** — what **`ci-reusable.yml`** uses |

Production deploy runs **`npm run ci`**, so production’s preflight matches “full suite” without generating lcov. GitHub PR/push CI uses **`test:ci`** for artifacts and Codecov.

---

## GitHub configuration

### Variables (`Settings` → `Secrets and variables` → `Actions` → **Variables**)

Examples: `VERCEL_DEPLOY_ENABLED`, `VERCEL_PROD_DEPLOY_ENABLED`, `SLACK_NOTIFY_ENABLED`, `DATABASE_BACKUP_ENABLED`, **`PRODUCTION_URL`** (use a **variable**, not a secret).

### Secrets

Vercel: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_SCOPE`, `VERCEL_PROJECT_ID_STAGING`, `VERCEL_PROJECT_ID_PRODUCTION`.  
Optional: `CODECOV_TOKEN`, `SLACK_WEBHOOK`, and for backups `SUPABASE_DATABASE_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, **`AWS_BACKUP_BUCKET`**.

### Branch protection (`master`)

Require checks named like **CI** and **PR Validation** (exact labels appear on the Checks tab — pick what GitHub lists). Optional: dismiss stale approvals, require up-to-date branches.

---

## Not implemented (do not expect it from YAML)

- **PR comments** with results — not in these workflows; use the **Checks** tab.  
- **`/api/health`** — smoke uses site **root** if `PRODUCTION_URL` is set.  
- **E2E on staging** — placeholder comment in `deploy-staging.yml` only.

---

## What to do today (operator)

```bash
git status                 # clean tree
npm run ci                 # local gate (no coverage)
npm run build              # optional extra confidence
git push -u origin phase0/step7-qa-pool
```

Open PR to **`master`**; after approval, merge. Then set variables/secrets so staging (and optional Slack/backups) behave as you want.

### Suggested PR description (short)

```markdown
## Phase 0 Step 7 — Q&A pool + CI/CD

**Application:** Q&A pool (exact hash), answer orchestrator, cost logging, DOCX, `/api/answer`, migration `007-qa-pool.sql`.

**DevOps:** Reusable CI (`ci-reusable.yml`), push CI (`ci.yml`), PR validation (`pull-request.yml`), optional scheduled/manual CI (`test.yml`, `build.yml`), gated Vercel deploys, gated `backup.yml`, Slack optional.

**Verify:** `npm test`, `npm run build`. **Docs:** `docs/CRUSER_DEVOPS_CICD_HANDOFF.md`, `.github/DEVOPS.md`.

**Post-merge:** Apply Supabase migration; set GitHub variables/secrets for Vercel (and optional Slack/backups).
```

---

## Summary

- **8** workflow files under `.github/workflows/`; **`.github/DEVOPS.md`** is separate documentation.  
- **Reusable** job = one place to edit CI; **PR + push** can still mean **two** full CI runs per sync.  
- **`test:ci`** in Actions vs **`npm run ci`** locally/production gate = **by design**.  
- **Slack** is in the deploy/backup YAML and **gated**, not missing.
