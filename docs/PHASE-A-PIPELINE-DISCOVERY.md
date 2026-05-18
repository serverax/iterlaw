# Phase A — Pipeline Discovery

**Date:** 2026-05-18  
**Branch:** `feature/github-automation`  
**Repo:** `serverax/iterlaw` (default branch: `master`)

## Existing CI/CD

| Asset | Status | Notes |
|-------|--------|-------|
| `.github/workflows/ci.yml` | Present | Push to `main`/`master`; calls `ci-reusable.yml` |
| `.github/workflows/ci-reusable.yml` | Present | lint → typecheck → jest+coverage → web build |
| `.github/workflows/pull-request.yml` | Present | PR validation |
| `.github/workflows/legal-orchestrator-ci.yml` | Present | Vitest + typecheck on orchestrator path |
| `.github/workflows/04-build-docker.yml` | Present | Docker image builds |
| `.github/workflows/iterlaw-k3s-verify.yml` | Present | K3s manifest checks |
| RAG scrape/chunk/validate workflows | Present | `01`–`03` |

## Missing / consolidated in Phase A

| Item | Action |
|------|--------|
| Unified `main-ci-cd.yml` (7 gates) | **Created** — single entry workflow |
| Root `type-check` script alias | **Added** (`typecheck` + workspaces) |
| `format:check` | **Added** |
| `security:scan` / `audit:fix-check` | **Added** |
| Root strict ESLint (type-aware) | **Deferred** — keep Next.js ESLint; strict root config breaks monorepo |
| Root `jest.config` replacement | **Deferred** — keep `next/jest` config (working, 227+ tests) |
| Root `Dockerfile` | **Missing** — per-app Dockerfiles under `apps/*` and `backend/` |
| Azure deploy in CI | **Gated** — requires secrets + `ENABLE_AZURE_DEPLOY` variable |

## Test coverage (local)

| Suite | Runner | Approx. count |
|-------|--------|----------------|
| Root Jest (`npm test`) | Jest | 227 tests (web-focused) |
| `npm run test:pipeline` | ts-node + `algorithm.ts` | 20 employment-law scenarios |
| `apps/legal-orchestrator` | Vitest | 3363 tests |

## Tooling on disk

- **ESLint:** `.eslintrc.json` (extends `next/core-web-vitals` + prettier)
- **Prettier:** `.prettierrc` + `.prettierrc.json`
- **TypeScript:** root `tsconfig.json` (strict, jest setup); per-app tsconfigs
- **Docker local:** `docker-compose.local.yml` (postgres:5433 host, ollama, backend, orchestrator)

## Phase A exit criteria

1. `main-ci-cd.yml` committed  
2. `package.json` scripts updated  
3. Config files aligned (Prettier JSON, ESLint note)  
4. `docs/GITHUB-PHASE-A-SETUP.md` for secrets + branch protection (manual UI)  
5. Push branch → Actions green on lint, types, test, security, build gates  
