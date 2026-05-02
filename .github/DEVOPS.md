# CI/CD (GitHub Actions)

## Workflows

| File | When it runs | Purpose |
|------|----------------|---------|
| `workflows/ci.yml` | Every `push` and every `pull_request` | `npm ci` → `lint` → `typecheck` → `test --coverage` → `build`. Uploads `lcov.info`; optional Codecov upload if `CODECOV_TOKEN` is set. |
| `workflows/deploy-staging.yml` | Push to `master` | Vercel deploy **only if** repo variable `VERCEL_DEPLOY_ENABLED` is `true`. |
| `workflows/deploy-production.yml` | Manual (`workflow_dispatch`) | Requires input `YES` **and** `VERCEL_PROD_DEPLOY_ENABLED=true`. Runs full `npm run ci` before deploy. |
| `workflows/backup-database.yml` | Manual (cron optional) | Runs when `DATABASE_BACKUP_ENABLED=true` and secrets are configured. |

## Repository variables (Settings → Secrets and variables → Actions → Variables)

| Variable | Values | Effect |
|----------|--------|--------|
| `VERCEL_DEPLOY_ENABLED` | `true` / unset | Enables auto staging deploy on push to `master`. |
| `VERCEL_PROD_DEPLOY_ENABLED` | `true` / unset | Allows manual production deploy workflow. |
| `DATABASE_BACKUP_ENABLED` | `true` / unset | Enables database backup workflow. |
| `STAGING_URL` / `PRODUCTION_URL` | HTTPS URLs | Optional; used in comments / future smoke steps. |

## Secrets (Actions → Secrets)

**Vercel (staging + production):** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_STAGING`, `VERCEL_PROJECT_ID_PRODUCTION`, `VERCEL_SCOPE` (optional).

**Codecov (optional):** `CODECOV_TOKEN`.

**Backups (optional):** `SUPABASE_DATABASE_URL` (Postgres connection string), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BACKUP_BUCKET`.

**Slack / E2E:** not wired in YAML yet—add steps when `SLACK_WEBHOOK` and Playwright tests exist.

## Local parity with CI

```bash
npm run ci
```

Same sequence as the production deploy gate.
