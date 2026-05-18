# GitHub setup — Phase A (secrets & branch protection)

## Required secrets (Settings → Secrets and variables → Actions)

| Secret | Required for |
|--------|----------------|
| `CODECOV_TOKEN` | Optional — coverage upload |
| `AZURE_CLIENT_ID` | Gate 6 staging deploy |
| `AZURE_CLIENT_SECRET` | Use OIDC with `azure/login` preferred |
| `AZURE_TENANT_ID` | Staging deploy |
| `AZURE_SUBSCRIPTION_ID` | Staging deploy |
| `SNYK_TOKEN` | Optional — `npm run security:scan` Snyk step |

## Repository variable

| Variable | Value | Purpose |
|----------|-------|---------|
| `ENABLE_AZURE_DEPLOY` | `true` | Enables Gate 6; leave unset/false until Azure is ready |

## Branch protection (`master` / `main`)

Settings → Branches → Add rule:

- Require pull request before merging  
- Require status checks:
  - `Gate 1 — Lint`
  - `Gate 2 — Type check`
  - `Gate 3 — Tests`
  - `Gate 3b — Legal orchestrator (Vitest)`
  - `Gate 4 — Security`
  - `Gate 5 — Build`
- Require branches up to date  
- Restrict pushes (admins only)  

Gate 7 (`production` environment) uses GitHub Environment protection rules for manual approval on `main`/`master` pushes.

## Environments

Create **staging** and **production** under Settings → Environments.  
Add required reviewers on **production** for Gate 7.
