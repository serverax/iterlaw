# CI/CD — 30-minute setup (RightsNow)

This repo uses **one reusable CI definition** (lint → typecheck → tests with coverage → build) so you do not pay **3×** GitHub Actions minutes for the same `npm ci` on every push. The guide’s separate `test.yml` / `build.yml` ideas are represented as:

| Guide name | In this repo |
|------------|----------------|
| PR Validation | `workflows/pull-request.yml` → calls `ci-reusable.yml` (PRs → `master` only) |
| Push CI | `workflows/ci.yml` → calls `ci-reusable.yml` (every **push**) |
| Unit Tests (scheduled / manual) | `workflows/test.yml` → `workflow_dispatch` + weekly cron |
| Build & Lint (manual) | `workflows/build.yml` → `workflow_dispatch` |
| Deploy staging | `workflows/deploy-staging.yml` |
| Deploy production | `workflows/deploy-production.yml` |
| Daily backup | `workflows/backup.yml` |

---

## Step 1 — Files (already in repo)

```text
.github/workflows/
  ci-reusable.yml      # shared job (workflow_call)
  ci.yml               # every push
  pull-request.yml     # PRs targeting master
  test.yml             # optional schedule / manual
  build.yml            # optional manual
  deploy-staging.yml
  deploy-production.yml
  backup.yml
```

---

## Step 2 — Branch protection (≈5 min)

1. GitHub → **Settings** → **Branches** → **Add rule** (for `master`).
2. Require status checks: enable **“Require status checks to pass before merging”**.
3. Search and select: **PR Validation** and/or **CI** (both run the same checks; you can require one or both).

---

## Step 3 — Vercel (≈5 min)

1. Import the GitHub repo in [Vercel](https://vercel.com/dashboard).
2. Create **staging** and **production** projects (or one project with preview vs production — match your team’s convention).
3. Create a [Vercel token](https://vercel.com/account/tokens).

---

## Step 4 — GitHub secrets & variables (≈10 min)

**Settings → Secrets and variables → Actions**

### Variables (not secret)

| Name | Purpose |
|------|---------|
| `VERCEL_DEPLOY_ENABLED` | Set to `true` to run **staging** deploy on every push to `master`. |
| `VERCEL_PROD_DEPLOY_ENABLED` | Set to `true` to allow **manual** production deploy workflow. |
| `DATABASE_BACKUP_ENABLED` | Set to `true` to enable **backup.yml** job. |
| `SLACK_NOTIFY_ENABLED` | Set to `true` to send Slack messages from deploy/backup workflows. |
| `PRODUCTION_URL` | Optional; used for curl smoke step in production deploy. |

### Secrets

| Name | Purpose |
|------|---------|
| `VERCEL_TOKEN` | Vercel API token |
| `VERCEL_ORG_ID` | Vercel org |
| `VERCEL_PROJECT_ID_STAGING` | Staging project id |
| `VERCEL_PROJECT_ID_PRODUCTION` | Production project id |
| `VERCEL_SCOPE` | Team slug (if applicable) |
| `CODECOV_TOKEN` | Optional Codecov upload |
| `SLACK_WEBHOOK` | Incoming webhook (when `SLACK_NOTIFY_ENABLED=true`) |
| `SUPABASE_DATABASE_URL` | Postgres URL for backups |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_BACKUP_BUCKET` | For S3 backup upload |

**Defaults:** Staging deploy, production deploy, backups, and Slack are **off** until you set the variables above — forks and new repos stay green.

---

## Step 5 — `package.json` scripts (already set)

```bash
npm run lint        # next lint
npm run typecheck   # tsc --noEmit
npm run test        # jest (local / npm run ci)
npm run test:ci     # jest --coverage --passWithNoTests (used in ci-reusable.yml)
npm run ci          # lint + typecheck + test + build
```

---

## Step 6 — Verify locally (2 min)

```bash
npm run ci
```

---

## Step 7 — Verify on GitHub (5 min)

1. Push any branch → **Actions** → workflow **“CI”** should succeed.
2. Open a PR into `master` → **“PR Validation”** should succeed.

---

## Step 8 — Optional production smoke

There is no `/api/health` route in this app yet. Production workflow uses optional `PRODUCTION_URL` + `curl` with `continue-on-error`. Add a health route later and tighten that step.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| PR checks missing | Branch protection must reference the exact check name from Actions. |
| Staging never runs | `VERCEL_DEPLOY_ENABLED` must be `true`; secrets must be present. |
| Slack never fires | `SLACK_NOTIFY_ENABLED=true` **and** `SLACK_WEBHOOK` secret. |
| Codecov optional | Upload step is `continue-on-error`; add `CODECOV_TOKEN` for private repos if needed. |

---

## Daily developer flow

```bash
git checkout -b your/feature
# …
git push -u origin your/feature
# → CI runs on push
# Open PR to master → PR Validation runs
# Merge to master → staging deploy (if enabled)
```

Production: **Actions → Deploy production → Run workflow → type `YES`.**
