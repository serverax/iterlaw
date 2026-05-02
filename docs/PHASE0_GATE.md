# Phase 0 — completion gate (IterLaw / RightsNow)

Phase 0 is **closed only when every item below is true**. This is not a “best effort” checklist: if any gate fails, **do not start Phase 1**.

---

## Definition of done

| # | Gate | How to verify |
|---|------|----------------|
| 1 | **Azure Functions** deploy workflow green on `master` | GitHub → Actions → **Deploy Azure Functions (IterLaw)** — latest run on `master` = success. |
| 2 | **Deploy IterLaw** workflow green on `master` | Actions → **Deploy IterLaw** — latest run on `master` = success. |
| 3 | **Static Web App** step succeeds inside that workflow | Same run: step **Deploy Static Web App** = success (Oryx uploads the pre-built Next standalone bundle). |
| 4 | **No failing required checks** on protected merges | Branch protection: required checks (e.g. **PR Validation**, **CI**) must be green before merge; no red required workflows on `master`. |
| 5 | **Local** `npm ci` and `npm run build` | From repo root, with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set (or use the same demo values as `.github/workflows/deploy.yml`), builds complete without error. |
| 6 | **Secrets documented** | Required vs optional secrets are listed in **`.github/workflows/deploy.yml`** (header) and in this file (below). |
| 7 | **No unexplained workarounds** | Every non-obvious CI/CD choice is documented under **Engineering decisions** below — these are **permanent** integration patterns, not “TODO later”. |

---

## Required GitHub secrets (deploy + Functions)

| Secret | Required | Purpose |
|--------|----------|---------|
| `AZURE_CREDENTIALS` | **Yes** | Service principal JSON (`az ad sp create-for-rbac ... --json-auth`) with permission to deploy **Azure Functions** (`iterlaw-api-001`). |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | **Yes** | Static Web App deployment token from Azure Portal → SWA → **Manage deployment token**. |

## Optional secrets (build correctness without them; production fidelity with them)

| Secret | Optional | Purpose |
|--------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Real Supabase project URL for **Next.js prerender** at build time. If unset, workflows use a **documented demo URL** so `next build` never fails for missing env. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Real anon key for prerender. If unset, workflows use a **documented demo JWT** (same pattern as Supabase client docs) so build-time code that reads these vars does not throw. |

## Other secrets (not Phase 0 gates)

Vercel, backups, Codecov, Slack, etc. are documented in **`.github/DEVOPS.md`**. Workflows that depend on them are **gated off** with `if: vars.*` until you opt in — they do not block Phase 0.

---

## Workflows that are Phase 0 gates on `master`

| Workflow | Trigger | Gate? |
|----------|---------|--------|
| **CI** | Push to `master` / `main`, `workflow_dispatch` | **Yes** — runs `ci-reusable.yml` (lint, typecheck, test, production build). |
| **Deploy Azure Functions (IterLaw)** | Push to `master` / `main` | **Yes** |
| **Deploy IterLaw** | Push to `master` / `main` | **Yes** |
| **PR Validation** | PRs to `master` | **Yes** (merge gate when branch protection requires it) |
| Deploy staging / production / backup / Build & Lint / Unit Tests | Variables / manual / schedule | **No** — optional until you enable variables or run manually |

---

## Engineering decisions (not temporary hacks)

These exist **by design** for **Azure Static Web Apps + Next.js 14 + npm workspaces**. They are explained here so nobody treats them as “20% to fix later”.

### 1. Next `output: 'standalone'` and `outputFileTracingRoot`

**File:** `apps/web/next.config.js`  

**Why:** SWA’s hybrid Next path must upload a **self-contained server directory**. Standalone output traces dependencies from the **monorepo root** so workspace packages are included in the traced graph.

### 2. `apps/web/scripts/post-next-standalone.cjs`

**Why:** Microsoft’s standalone hosting pattern requires copying **`.next/static`** and **`public`** into the standalone tree after `next build`. The script also **removes** the `@rightsnow/shared` entry from **`apps/web/.next/standalone/apps/web/package.json`**.

**Why remove the dependency:** In the repo, `@rightsnow/shared` is declared as `file:../../packages/shared`. The standalone folder deployed to SWA **does not include** `packages/` at that relative path. Azure’s follow-up `npm install` in the standalone directory would try to resolve that `file:` URL and **fail** (or leave a broken symlink). The shared library code is **already inside the traced server bundles** because of `outputFileTracingRoot`, so removing the **metadata-only** `package.json` line is correct and **not** a loss of runtime code.

### 3. `skip_app_build: true` and `app_location: apps/web/.next/standalone/apps/web`

**File:** `.github/workflows/deploy.yml`  

**Why:** Per Azure’s “skip building front-end app” documentation, `app_location` points at the **pre-built output** and `skip_app_build: true` avoids Oryx performing a second full monorepo build that cannot reproduce workspace layout reliably inside SWA’s isolated copy.

### 4. “Verify Static Web App build” materializes `@rightsnow/shared`

**File:** `.github/workflows/deploy.yml` (step **Verify Static Web App build**)  

**Why:** Before `next build`, `apps/web/node_modules/@rightsnow/shared` is replaced with a **real directory copy** of `packages/shared`. This matches how a robust install resolves the workspace package for the compiler and avoids relying on a symlink that differs between local OS and CI. The **same** pattern is used in the **CI** production build step (`ci-reusable.yml`) so PRs and pushes match deploy.

### 5. Demo Supabase `NEXT_PUBLIC_*` defaults in workflow `env`

**Files:** `.github/workflows/deploy.yml`, `.github/workflows/ci-reusable.yml`, `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy-production.yml`  

**Why:** `next build` executes modules that read `process.env.NEXT_PUBLIC_*`. Missing vars would fail prerender in CI. Defaults are **public-shaped** placeholders only for **build**; production apps should set **real** secrets in GitHub for correct prerender and runtime.

### 5b. `npm exec next` in `apps/web` scripts

**File:** `apps/web/package.json`  

**Why:** With npm workspaces, dependencies are often **hoisted** to the repo root. On Windows, lifecycle scripts run from `apps/web` with a `PATH` that does not always include the hoisted `node_modules/.bin`, so bare `next` can fail with “not recognized”. `npm exec next -- …` resolves the CLI from the dependency graph on all platforms and matches CI (Ubuntu) behavior.

### 5c. Jest: ignore Next standalone output; mock Supabase in API route tests

**Files:** `jest.config.js` (`modulePathIgnorePatterns` for `apps/web/.next/standalone/`), `apps/web/app/api/axiom/__tests__/routes.test.ts`, `apps/web/app/api/axiom/__tests__/process.test.ts`  

**Why:** After `next build`, standalone `package.json` files collide with the repo in Jest’s haste map. Route tests assert orchestration only: they **mock** `@/lib/supabase/client` (same pattern as `__tests__/integration/axiom-complete-loop.test.ts`) so a developer machine with `NEXT_PUBLIC_*` plus a service role key does not hit the network against a placeholder URL during `npm run ci`.

### 6. Pre-built Functions zip (`scm-do-build-during-deployment: false`)

**Files:** `.github/workflows/deploy.yml`, `.github/workflows/deploy-functions.yml`  

**Why:** The API package uses `file:../packages/*`. Those paths **do not exist** on Azure after zip upload. The workflow **vendors** `packages/shared` and `packages/legal-core` into `api/node_modules/@rightsnow/*` as **real directories** before deploy. This is the supported pattern for monorepo Functions on Consumption without remote Oryx.

---

## Revision history

| Date | Note |
|------|------|
| 2026-05-02 | Phase 0 gate doc: DoD, secrets, workflows, permanent SWA/Next/Functions decisions. |
| 2026-05-02 | CI: action pins (checkout/setup-node v5, azure/login v3); Vercel workflows align with Supabase build env + shared materialize; `npm exec next` for hoisted Windows; Jest standalone ignore + Supabase mocks in axiom route tests; `jest-dom` types reference. |
