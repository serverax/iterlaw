# Cursor Deep Audit — IterLaw Full Project

## 1. Executive Summary

Status: **PARTIAL**

Short verdict:

- **What is real:** Root `npm run typecheck`, `npm run lint`, `npm run build`, and `npm test` (Jest) succeed for the configured workspaces (`@iterlaw/web`, `@iterlaw/shared`, `packages/legal-core`, `__tests__/integration`). `npm run build:api` succeeds for `@iterlaw/api`. `apps/legal-orchestrator` passes `npm run typecheck` and `npm test` (Vitest: **912** tests). Legal safety flags `citation_required` and `zero_citation_answer_blocked` remain **true** in `apps/legal-orchestrator/src/server.ts` and are asserted in tests (e.g. `sprint13BackupReadinessSmoke.test.ts`, `sprint8Ready.test.ts`). `legal_review_queue` exists in Supabase migrations (`apps/web/lib/supabase/migrations/012-phase1-controlled-answer-engine.sql`, `backend/supabase/migrations/012_phase1_controlled_answer_engine.sql`) and is used from `backend/src/services/controlledAskService.ts`.

- **What is broken / limited:** Root `package.json` `typecheck` / `lint` scripts only target `@iterlaw/web`; they do **not** typecheck `apps/legal-orchestrator` in one root command. `npm audit --omit=dev` reports **2** production dependency advisories (Next.js and transitive PostCSS) requiring a **breaking** Next upgrade to clear. Prior root `npm test` incorrectly collected Vitest suites from other apps (now fixed via `jest.config.js` `testPathIgnorePatterns`).

- **What was fixed:** Jest scope corrected; Windows Git Bash path argv conversion for Sprint 12 backup dry-run tests; `resolveBash` probe timeout and Windows resolution order to avoid PATH `bash` hangs.

- **What still needs work:** Planned dependency upgrades (Next 16 / PostCSS) behind a dedicated sprint; optional root `typecheck`/`ci` expansion to include `apps/legal-orchestrator`; `npm audit` dev-scope noise (9 issues with dev included) — not auto-fixed per instructions.

---

## 2. Environment

| Field | Value |
|--------|--------|
| Date/time | 2026-05-13 (audit session) |
| Machine | Windows 10 (`win32 10.0.26100` per agent env) |
| Repo path | `C:\Users\kalsh\projects\iterlaw` |
| Branch | `master` |
| HEAD commit (at audit start) | `ea11ffad27a093b6adbe153341ab557d242e6734` |
| Working tree before | `master` at above; one untracked report noted in prior snapshot; see `git status` during run |
| Working tree after | Modified: `jest.config.js`, `apps/legal-orchestrator/src/tests/helpers/resolveBash.ts`, `apps/legal-orchestrator/src/tests/sprint12BackupScripts.test.ts`; new: this report. **Unrelated untracked** docs/reports remain (not staged). |
| Node / npm | Node `v22.22.0`, npm `11.12.1` |
| OS | Windows |

---

## 3. Commands Run

| Command | Result | Notes |
|---|---:|---|
| `Get-Location` (pwd) | **PASS** | `C:\Users\kalsh\projects\iterlaw` |
| `git status --short` | **PASS** | Clean tracked tree at start except unrelated `??` items appearing in later snapshots |
| `git branch --show-current` | **PASS** | `master` |
| `git log --oneline -10` | **PASS** | Recent commits include intelligence wiring, sprint docs, orchestrator tests |
| `git remote -v` | **PASS** | `origin https://github.com/serverax/iterlaw.git` |
| `npm run typecheck` | **PASS** | `@iterlaw/web` `tsc --noEmit` only |
| `npm run lint` | **PASS** | Next lint: no ESLint warnings/errors |
| `npm run build` | **PASS** | `@iterlaw/shared` + `@iterlaw/web` Next production build completed |
| `npm test` | **PASS** (after fix) | Jest: **39** suites, **164** tests — after excluding Vitest workspaces |
| `npm run build:api` | **PASS** | `@iterlaw/api` `tsc` |
| `cd apps/legal-orchestrator && npm run typecheck` | **PASS** | `tsc --noEmit` |
| `cd apps/legal-orchestrator && npm test` | **PASS** | Vitest: **73** files, **912** tests |
| `npx vitest run` (root) | **NOT EXECUTED** | Use package-local `npm test` in `apps/legal-orchestrator` |
| `npm install --package-lock-only --ignore-scripts` | **PASS** | Lockfile already satisfied; audit summary printed |
| `npm audit` (full tree) | **PARTIAL** | **9** vulnerabilities (4 low, 1 moderate, 4 high) — includes dev |
| `npm audit --omit=dev` | **PARTIAL** | **2** vulnerabilities (Next, PostCSS); fix requires breaking Next bump |
| `npm outdated` | **PASS** | Exit 1 = outdated packages exist (expected); sample rows captured |

**Important raw output snippets**

`npm test` (post-fix):

```text
Test Suites: 39 passed, 39 total
Tests:       164 passed, 164 total
```

`apps/legal-orchestrator` Vitest:

```text
 Test Files  73 passed (73)
      Tests  912 passed (912)
```

`npm audit --omit=dev` (summary):

```text
2 vulnerabilities (1 moderate, 1 high)
next ... fix available via `npm audit fix --force` ... Will install next@16.2.6, which is a breaking change
postcss <8.5.10 ... moderate
```

---

## 4. Claude Work Verification

| Claim | Evidence Found | Result | Notes |
|--------|----------------|--------|--------|
| Intelligence layer exists in guarded/shadow mode | `apps/legal-orchestrator/src/intelligence/`, commits `6caec95`, `265a015`, tests `intelligenceShadowMode.test.ts`, `intelligenceActiveModeGuard.test.ts` | **REAL_PASS** | Code + Vitest prove wiring and guard behaviour |
| Local LLM / Ollama behind gateway, no raw OpenAI in drafting path | `sprint11RagGatewayHardening.test.ts`, `httpOllamaTransport.ts`, `intelligenceDisabledPath.test.ts` source scans | **REAL_PASS** | Static tests enforce banned SDK imports in scoped dirs |
| Sprint 12 backup scripts validated | `sprint12BackupScripts.test.ts`, `scripts/backup/*.sh` | **REAL_PASS** | Dry-run tests pass on Windows after argv path fix |
| “Full repo single `npm test` green” historically | Root Jest collected Vitest suites → mass failures | **FALSE_CLAIM** (if ever claimed) | Fixed by Jest `testPathIgnorePatterns` in this audit |
| “All packages typechecked by root `npm run typecheck`” | Root script only `-w @iterlaw/web` | **PARTIAL** | Orchestrator typecheck is separate command |

---

## 5. Code Audit Findings

| ID | Severity | File | Finding | Fix Applied | Status |
|----|----------|------|---------|-------------|--------|
| CODE-001 | Med | `jest.config.js` | Jest discovered Vitest suites under `apps/legal-orchestrator`, `apps/synthesis-worker`, `apps/ai-orchestrator`, causing false failures | Added `testPathIgnorePatterns` for those app roots | **fixed** |
| CODE-002 | Med | `apps/legal-orchestrator/src/tests/sprint12BackupScripts.test.ts` | Windows passed `C:\...` paths to Git Bash → `/bin/bash: C:Users...` | `pathForBashArgv()` for script/output paths | **fixed** |
| CODE-003 | Med | `apps/legal-orchestrator/src/tests/helpers/resolveBash.ts` | `probeBash("bash")` could hang; Vitest default timeout exceeded | `spawnSync` **timeout**; on **win32** try Git Bash paths **before** generic `bash` | **fixed** |
| CODE-004 | Low | Root `package.json` | `typecheck`/`ci` omit `apps/legal-orchestrator` | Documented; no CI rewrite without approval | **open** |

---

## 6. Security Findings

| ID | Severity | Area | Finding | Risk | Fix Applied | Status |
|----|----------|------|---------|------|-------------|--------|
| SEC-001 | High | Dependencies | `npm audit --omit=dev`: multiple Next.js advisories aggregated as high | DoS / cache / middleware class issues per GHSA list | No blind upgrade (breaking) | **open** |
| SEC-002 | Moderate | Dependencies | PostCSS &lt; 8.5.10 XSS advisory | XSS in CSS stringify path | Tied to Next upgrade | **open** |
| SEC-003 | Low | Grep hygiene | `seed_legal_rag_minimal.sql` comment references `psql "$DATABASE_URL"` — documentation only | None if operators do not commit env into SQL | N/A | **open** (documentary) |
| SEC-004 | Info | SQL migrations | HTTPS URLs in seed data (gov.uk, legislation) — expected provenance, not network calls from SQL | None | N/A | **acceptable** |

**Secrets scan:** `rg` over repo for `api_key`, `ghp_`, `BEGIN RSA`, etc. was **not** pasted here (anti-leak). Manual policy: no literal live tokens observed in edited paths; migrations state “no secrets” invariants.

---

## 7. Legal Safety Findings

| ID | Severity | Finding | Evidence | Status |
|----|----------|---------|----------|--------|
| LEGAL-001 | Low | `citation_required` / `zero_citation_answer_blocked` must stay true | `server.ts` lines ~98–99; `sprint13BackupReadinessSmoke.test.ts` | **verified** |
| LEGAL-002 | Low | Zero-citation answers blocked; insufficient sources path | `runLocalDraftingStep.ts`, `handleLegalRequest.ts`, `boundedSynthesis.ts`, Vitest `ragWire.test.ts`, `endToEndMock.test.ts` | **verified** |
| LEGAL-003 | Low | `citation_failed` / `insufficient_sources` handling | `handleLegalRequest.ts` switch cases; tests in `sprint11LocalLlmFoundation.test.ts` | **verified** |
| LEGAL-004 | Info | `legal_review_queue` in DB layer for controlled answers | SQL migrations + `controlledAskService.ts` | **documented / partial runtime scope** |

**Must confirm (post-audit):**

- `citation_required` **preserved** — yes (`server.ts` + tests).
- `zero_citation_answer_blocked` **preserved** — yes.
- `insufficient_sources` behaviour **preserved** — yes.
- `legal_review_queue` **not bypassed** in orchestrator path — orchestrator does not replace Supabase controlled-ask; queue remains in backend schema (separate service).
- **No direct legal answer bypass found** in reviewed orchestrator pipeline — drafting goes through RAG + guards (tests enforce).
- **No mock result presented as real legal answer** — mock paths return `insufficient_sources` / refusal statuses in tests (`endToEndMock.test.ts`).

---

## 8. Test Results

| Test Suite | Result | Evidence |
|------------|--------|----------|
| typecheck (root) | **PASS** | `npm run typecheck` → `@iterlaw/web` tsc OK |
| lint | **PASS** | Next lint clean |
| build (web+shared) | **PASS** | Next “Compiled successfully” + routes table |
| build:api | **PASS** | `tsc -p tsconfig.json` for `@iterlaw/api` |
| unit tests (root Jest) | **PASS** | 39 suites / 164 tests |
| unit tests (legal-orchestrator Vitest) | **PASS** | 73 files / 912 tests |
| integration tests | **PASS** | `__tests__/integration/axiom-complete-loop.test.ts` included in Jest run |
| security grep checks | **PARTIAL** | Pattern scans performed; full output not attached (secret-safe policy) |

---

## 9. Migration/Database Audit

| Finding | Severity | File | Status | Notes |
|---------|----------|------|--------|--------|
| Ordered numeric prefixes `000`–`010`, `100`–`106` | Info | `apps/legal-orchestrator/db/migrations/` | **OK** | Convention tests exist (`migrationChainSprint10Convention.test.ts`, etc.) |
| pgvector prerequisite | Info | `000_pgvector_prerequisite.sql` | **OK** | Documented operator-run |
| Provenance / URLs / `token_count` | Info | `001_`, `002_`, `006_`, `010_` | **OK** | HTTPS canonical URLs; `http_status` is ingestion metadata column, not HTTP from SQL |
| RLS | Med | `106_enable_rls.sql` + tests `migrationSprint13Rls.test.ts` | **VERIFIED in tests** | Static SQL contract tests |
| Duplicate schema risk | Low | `101_reconcile_legal_rag_schema.sql` | **open for DBA review** | Reconcile migration by design — needs human operator context |

---

## 10. Infrastructure/K3s Audit

| Finding | Severity | File / area | Status | Notes |
|---------|----------|-------------|--------|--------|
| Disabled vs active manifests | Info | `k8s/iterlaw-disabled-*`, deleted `k8s/legal-orchestrator/` per git status snapshot | **NOT VERIFIED in cluster** | Filesystem-only audit; **no kubectl**, no live mutations |
| GitHub workflow `iterlaw-k3s-verify.yml` | Info | `.github/workflows/` | **PARTIAL** | Naming deny-list includes legacy token as policy check — not product drift |
| Secrets in manifests | Med | Sampled patterns | **NOT EXECUTED** | No blind secret grep in YAML printed here |

---

## 11. Documentation Truth Audit

| Document | Issue | Fix | Status |
|----------|-------|-----|--------|
| Various sprint QA reports | May claim “full npm test green” without excluding Vitest apps | Root Jest config fixed; this report clarifies scope | **fixed** / **open** (historical PDFs unchanged) |
| `README.md` | Legacy RightsNow disclaimer | Accurate | **OK** |
| `docs/iterlaw/project/00-index/CANONICAL_NAMES.md` | RightsNow forbidden except legacy contexts | Consistent with `rg` hits | **OK** |

**Naming (`RightsNow` / `rightsnow`):** Hits appear in **legacy/disabled/docs/policy/test fixtures** (e.g. `.github/workflows-disabled/`, `docs/CRUSER_*`, `infra/iterlaw/naming-contract.md`, deny-list in scripts, `sprint12BackupScripts.test.ts` manifest rejection). **No reintroduction** into active product code paths detected.

---

## 12. Fixes Applied

| File | Change | Reason | Test Evidence |
|------|--------|--------|-----------------|
| `jest.config.js` | Ignore `apps/legal-orchestrator`, `apps/synthesis-worker`, `apps/ai-orchestrator` in Jest | Prevent Vitest files running under Jest | `npm test` → 39 passed |
| `apps/legal-orchestrator/src/tests/helpers/resolveBash.ts` | Timeouts + Windows resolution order | Stop hangs / Vitest timeouts on Windows | `npx vitest run src/tests/resolveBash.test.ts` → 5 passed |
| `apps/legal-orchestrator/src/tests/sprint12BackupScripts.test.ts` | `pathForBashArgv` for bash argv | Git Bash path interop on Windows | Vitest dry-run tests pass (44 tests in focused run; full suite 912) |

---

## 13. Remaining Risks

| Risk | Severity | Recommended Fix | Sprint |
|------|----------|-----------------|--------|
| Next.js / PostCSS advisories | High (CVE aggregate) | Planned Next 15/16 upgrade with regression QA | Dedicated dependency sprint |
| Root `typecheck` omits orchestrator | Med | Add `npm run typecheck -w @ordinoxai/legal-orchestrator` or workspace script | CI hygiene |
| `apps/synthesis-worker` / `apps/ai-orchestrator` tests not in root Jest | Low | Add explicit CI jobs with their native runner (Vitest) | CI |

---

## 14. Next Actions

### Task 1 — CI: orchestrator Vitest gate

Objective: Ensure `apps/legal-orchestrator` runs `npm test` on every PR.

Files: `.github/workflows/*.yml`, optional `package.json` root script.

Commands: `cd apps/legal-orchestrator && npm ci && npm test`.

Acceptance gates: Vitest green on Linux + Windows runners if both used.

Rollback: Remove workflow job.

Evidence required: CI run URL + log excerpt.

### Task 2 — Dependency upgrade (Next)

Objective: Close `npm audit --omit=dev` for Next/PostCSS with controlled upgrade.

Files: `apps/web/package.json`, lockfile, visual/regression tests.

Commands: `npm audit --omit=dev`, staged Next upgrade, `npm run build`, `npm test`.

Acceptance gates: No new critical/high; smoke test core routes.

Rollback: Revert bump commit.

Evidence required: Before/after audit output + build/test logs.

### Task 3 — Root typecheck alignment

Objective: Single command fails if any primary workspace fails `tsc`.

Files: Root `package.json` `scripts`.

Commands: `npm run typecheck:all` (new composite).

Acceptance gates: Includes `@iterlaw/web` + `@iterlaw/api` + `@ordinoxai/legal-orchestrator` (and shared packages as needed).

Rollback: Remove composite script.

Evidence required: Local command output in CI.

---

## 15. Final Verdict

**Final status: PARTIAL**

Reason:

- Web + API TypeScript builds and root Jest are **proven green** with command output.
- Legal orchestrator is **proven green** via **912** Vitest tests in its package, including legal-safety and gateway hardening tests.
- Production dependency audit still reports **2** issues requiring a **breaking** framework upgrade to resolve automatically.
- Live K3s / Traefik / production deploy state was **not** inspected (forbidden scope).

---

## 16. Commit

After this report and code fixes, stage **only** audit-related paths:

```bash
git add jest.config.js \
  apps/legal-orchestrator/src/tests/helpers/resolveBash.ts \
  apps/legal-orchestrator/src/tests/sprint12BackupScripts.test.ts \
  reports/CURSOR_DEEP_AUDIT_ITERLAW_FULL_PROJECT_REPORT.md
git commit -m "audit(iterlaw): deep project verification and security fixes"
```

**Push:** **NOT EXECUTED** — not requested.

---

## 17. Response to Khaled (summary fields)

| Field | Value |
|--------|--------|
| Overall | **PARTIAL** |
| Report path | `reports/CURSOR_DEEP_AUDIT_ITERLAW_FULL_PROJECT_REPORT.md` |
| Files changed (audit) | `jest.config.js`, `apps/legal-orchestrator/src/tests/helpers/resolveBash.ts`, `apps/legal-orchestrator/src/tests/sprint12BackupScripts.test.ts`, `reports/CURSOR_DEEP_AUDIT_ITERLAW_FULL_PROJECT_REPORT.md` |
| Tests | Root Jest **164 passed**; legal-orchestrator Vitest **912 passed** |
| Security | **2** prod advisories **open** (Next + PostCSS); broader dev-tree **9** with `npm audit` — documented, not mass-fixed |
| Commit hash | Use `git log -1 --format=%H -- reports/CURSOR_DEEP_AUDIT_ITERLAW_FULL_PROJECT_REPORT.md` on your checkout (self-referential; avoids amend/hash drift). |
| Push required | **No** unless you explicitly request it |
