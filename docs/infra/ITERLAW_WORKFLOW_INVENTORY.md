# IterLaw — GitHub Workflow Inventory

This file is the source of truth for which GitHub Actions workflows are
active in IterLaw and which have been intentionally disabled. Re-enabling
a disabled workflow requires editing this file in the same commit.

## Active workflows (`.github/workflows/`)

| File                                  | Trigger                                  | What it does                                                                                                | Deploys? |
| ------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| `iterlaw-k3s-verify.yml`              | `pull_request`, `workflow_dispatch`      | Runs `scripts/infra/verify-iterlaw-repo.sh`, lists `k8s/iterlaw{,-data}/`, greps for forbidden tokens.       | No       |
| `ci.yml`                              | `push: master\|main`, `workflow_dispatch`| Invokes `ci-reusable.yml` (lint, typecheck, unit tests, build). No cluster access, no Azure/Vercel/AKS.     | No       |
| `pull-request.yml`                    | `pull_request: master`                   | Same reusable CI job for PRs.                                                                               | No       |
| `test.yml`                            | `workflow_dispatch`, weekly cron         | Same reusable CI job on demand / schedule.                                                                  | No       |
| `build.yml`                           | `workflow_dispatch`                      | Same reusable CI job for ad-hoc operator runs.                                                              | No       |
| `ci-reusable.yml`                     | `workflow_call`                          | Shared job: ESLint, TypeScript, Jest+coverage, `next build`. Does not touch a cluster.                      | No       |
| `legal-orchestrator-ci.yml`           | `pull_request`, `push: master\|main`     | Runs `npm ci` + `npm run typecheck` against `apps/legal-orchestrator`. No artifacts, no registry push.      | No       |

## Disabled workflows (`.github/workflows-disabled/`)

GitHub Actions only auto-runs files under `.github/workflows/`. Files
moved into `.github/workflows-disabled/` are parked: they remain in git
history (and can be inspected) but cannot be triggered without an
explicit move back.

| File                              | Reason for disabling                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `deploy.yml`                      | Azure Static Web Apps + Azure Functions (RBAC). Targets the retired RightsNow direction. Not for K3s.             |
| `deploy-functions.yml`            | Azure Functions deploy (RBAC). Not for K3s.                                                                       |
| `deploy-staging.yml`              | Vercel staging auto-deploy on push. Not for K3s.                                                                  |
| `deploy-production.yml`           | Vercel production deploy via manual dispatch with `YES` gate. Not for K3s.                                        |
| `deploy-aks.yml`                  | Azure AKS `kubectl apply` pipeline for the old ai-orchestrator image in `iterlawacr3729.azurecr.io`. Not for K3s. |
| `backup.yml`                      | Old backup job that depends on Azure secrets. Replaced by `k8s/iterlaw-data/backups/cronjob.yaml`.                |
| `manual-deploy-functions.yml`     | Was committed under a duplicated nested path (`.github/workflows/.github/workflows/`). Manual Azure Functions deploy. Cannot run from `workflows-disabled/`. |
| `legal-orchestrator-image.yml`    | Auto-pushed images to GHCR on `push: master\|main`. Disabled until image policy + tag strategy is agreed for K3s. |

## Confirmations

- **K3s deployment is manual only.** No workflow under `.github/workflows/`
  runs `kubectl apply` or contacts the K3s cluster. Operators apply
  manifests by running `bash scripts/infra/deploy-iterlaw-k3s.sh --apply`
  on a workstation with a valid kubeconfig.
- **Production deployment is disabled.** No active workflow deploys to
  production. The legacy `deploy-production.yml` (Vercel) is parked under
  `workflows-disabled/` and is no longer reachable by GitHub Actions.
- **No GitHub secrets are required by active workflows.** `ci-reusable.yml`
  reads optional Supabase env vars from secrets but falls back to public
  example values when absent. `iterlaw-k3s-verify.yml` and
  `legal-orchestrator-ci.yml` take no secrets.

## Re-enabling a disabled workflow

1. `git mv .github/workflows-disabled/<name>.yml .github/workflows/<name>.yml`
2. In the same commit, edit this file: move the row from the disabled
   table to the active table and explain what was reviewed.
3. Ensure the workflow is consistent with
   `infra/iterlaw/naming-contract.md` (no forbidden tokens, no
   legacy-direction secrets).
