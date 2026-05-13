# IterLaw — Post–Cursor Audit Reconciliation

## 1. STATUS: **PARTIAL**

## 2. Starting HEAD (verification session)

`d49ffeb638a8d37e9113a94bc1906f944d7f2aaa` (`master`, aligned with `origin/master` at session open).

## 3. Current git status (after doc edits in this session)

```
## master...origin/master
 M PROJECT.md
 M apps/web/lib/ai/__tests__/claude.test.ts
 M apps/web/lib/ai/__tests__/gemini.test.ts
 M apps/web/lib/ai/__tests__/orchestrate.test.ts
 M apps/web/lib/ai/claude.ts
 M apps/web/lib/ai/gemini.ts
 M apps/web/lib/ai/orchestrate.ts
 M docs/iterlaw/project/07-sprints/ROADMAP_REMAINING_SPRINTS.md
 M docs/iterlaw/project/07-sprints/SPRINT_INDEX.md
 M docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md
?? apps/web/lib/ai/__tests__/featureFlag.test.ts
?? apps/web/lib/ai/__tests__/sprintTruthConsistency.test.ts
?? apps/web/lib/ai/featureFlag.ts
?? reports/CURSOR_AUDIT_CLAUDE_SPRINT_11_12_QA_REPORT.md
?? reports/ITERLAW_POST_CURSOR_AUDIT_RECONCILIATION.md
?? reports/ITERLAW_RECOVERY_AUDIT_AND_NEXT_SPRINT_READINESS.md
?? reports/ITERLAW_SPRINT_12B_TRUTH_AND_ANSWER_PATH_RECONCILIATION.md
```

`git diff --stat` at reconciliation write: **10 files changed**, 162 insertions, 59 deletions (includes pre-existing `apps/web/lib/ai/*` and `ROADMAP_REMAINING_SPRINTS.md` edits plus this session’s status/index/PROJECT updates).

## 4. Cursor audit commit reviewed

`b9084ee92044faae8711ac9f373094e6c67407f7` — `audit(iterlaw): deep project verification and security fixes`

Contents (from `git show --stat`):

- `apps/legal-orchestrator/src/tests/helpers/resolveBash.ts`
- `apps/legal-orchestrator/src/tests/sprint12BackupScripts.test.ts`
- `jest.config.js` (exclude Vitest workspaces from root Jest)
- `reports/CURSOR_DEEP_AUDIT_ITERLAW_FULL_PROJECT_REPORT.md`

## 5. Fresh root build result

| Step | Exit |
|------|------|
| `npm run build` (repo root) | **0** (`ROOT_BUILD_EXIT=0`) |

Evidence: Next.js **14.2.35** — `Compiled successfully`, static pages generated, `post-next-standalone` completed. **No** `apps/web/.next` clean required (no ENOENT on this run).

## 6. Fresh root test result

| Step | Exit |
|------|------|
| `npm test` (Jest, repo root) | **0** (`ROOT_TEST_EXIT=0`) |

Evidence: **41** test suites, **185** tests, all passed.

## 7. Fresh legal-orchestrator typecheck / build / test

| Step | Exit |
|------|------|
| `npm run typecheck` | **0** (`ORCH_TYPECHECK_EXIT=0`) |
| `npm run build` (`tsc`) | **0** (`ORCH_BUILD_EXIT=0`) |
| `npm test` (Vitest) | **0** (`ORCH_TEST_EXIT=0`) |

Evidence: **73** test files, **912** tests, all passed.

## 8. Security advisories

### Production (`npm audit --omit=dev`)

Exit code: **1** (vulnerabilities present). `AUDIT_PROD_EXIT=1`.

| Package | Severity | Affected | Fixed (per npm) | Safe non-breaking? | Files / scope | Recommended action |
|---------|----------|----------|-----------------|-------------------|---------------|---------------------|
| `next` | **high** (aggregate GHSA list) | `14.2.35` (per tree) | `16.2.6` via `audit fix --force` | **No** — major breaking upgrade | `apps/web/package.json`, lockfile | Dedicated sprint: upgrade Next + regression QA; **do not** `audit fix --force` in-place. |
| `postcss` | **moderate** (GHSA-qx2v-qp2m-jg93) | `<8.5.10` (transitive via Next) | tied to Next bump above | **No** isolated patch without Next change | transitive under `node_modules/next` | Same as Next upgrade. |

### Full tree (`npm audit`)

Exit code: **1**. `AUDIT_ALL_EXIT=1`.

**9** vulnerabilities (**4** low, **1** moderate, **4** high): includes dev-only chain (`jest-environment-jsdom` → `jsdom` → `http-proxy-agent` → `@tootallnate/once`) and `eslint-config-next` / `@next/eslint-plugin-next` → vulnerable `glob` range. **Not** auto-fixed (`npm audit fix --force` forbidden by mission).

## 9. Safe fixes applied (this reconciliation)

| Change | Reason |
|--------|--------|
| `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md` | Stale **55 / 708** vitest line conflated with current **73 / 912**; clarify external LLM vs web gated fallback; add post–audit transcript + **PARTIAL** security note. |
| `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` | Same stale vitest snapshot in Sprint 10 block. |
| `PROJECT.md` | Sprint 15 test counts + **PARTIAL** `npm audit --omit=dev` note. |

**No** `package.json` / lockfile version bumps in this pass (Next/PostCSS fixes are **not** safe patch-only).

## 10. Remaining advisories / blockers

- **P0:** Next 14 → 16 (or supported LTS path) + PostCSS alignment — **breaking**; needs sprint owner + CI matrix.
- **P1:** Dev-tree `glob` / `jsdom` advisories — address when upgrading Jest / eslint-config-next or isolating tooling versions.
- **P2:** Root `npm test` does not substitute for `apps/legal-orchestrator` Vitest — CI should call both (already separate commands).

## 11. Working tree classification

| Path | Classification |
|------|----------------|
| `jest.config.js`, orchestrator test helpers, `reports/CURSOR_DEEP_AUDIT_*` from commit `b9084ee` | **Belongs to audit/fix** — keep (already on `master` history). |
| `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md`, `SPRINT_INDEX.md`, `PROJECT.md` (this session) | **Reconciliation / truth** — keep; commit with this report. |
| `reports/ITERLAW_POST_CURSOR_AUDIT_RECONCILIATION.md` | **This deliverable** — keep; commit. |
| `apps/web/lib/ai/*.ts`, `__tests__/*`, `featureFlag.ts` (modified/untracked) | **Separate feature work** (web AI fallback gating + tests) — **not** part of audit commit `b9084ee`; leave on branch or commit separately after review. |
| `docs/iterlaw/project/07-sprints/ROADMAP_REMAINING_SPRINTS.md` (if modified) | **Pre-existing doc edits** — reconcile with owner; do not delete without review. |
| `reports/ITERLAW_SPRINT_12B_TRUTH_AND_ANSWER_PATH_RECONCILIATION.md` (untracked) | **Report** — keep; review before add. |

## 12. False PASS / unsafe claim scan

**Command:** `rg -n "PASS|DONE|COMPLETE|UNBLOCKED|DEPLOYED|PRODUCTION" docs reports PROJECT.md` (sample reviewed).

| Hit pattern | Verdict |
|-------------|---------|
| Sprint lines like “PASS FOR DRY-RUN FOUNDATION ONLY” | **Acceptable** — explicitly scoped, not production PASS. |
| `ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md` title “PASS” | **Acceptable** — Docker-only, stated in body. |
| Stale vitest counts (**55 / 708** presented as current) | **Stale** — **corrected** in `ITERLAW_PROJECT_STATUS.md`, `SPRINT_INDEX.md`; Sprint 15 line clarified vs **73 / 912**. |
| `reports/ITERLAW_DEEP_SPRINT_AUDIT_REPORT.md` **PARTIAL** | **Acceptable** — evidence-backed caution. |

## 13. External LLM path result

**Findings:**

- **`apps/legal-orchestrator`:** No production Anthropic/OpenAI/Gemini SDK; tests ban provider imports in drafting path; Ollama HTTP transport is policy-wrapped.
- **`POST /api/orchestrator/legal/ask`:** Proxies to orchestrator only (`apps/web/app/api/orchestrator/legal/ask/route.ts` — comment documents no external LLM in that hop).
- **`apps/web/lib/ai/orchestrate.ts`:** `callAIFallback` returns **`null`** unless `ITERLAW_WEB_AI_FALLBACK_ENABLED` is true — external calls **feature-gated off by default** (fresh Jest log: “Web AI fallback disabled by default”).
- **`apps/web/lib/ai/gate.ts`:** Uses Gemini for **classification** when `GOOGLE_AI_API_KEY` set; separate from legal-orchestrator citation path.

**Conclusion:** No evidence that **`/api/legal/ask`** or the web proxy **`/api/orchestrator/legal/ask`** bypasses orchestrator citation gates. Web-wide AI fallback remains **opt-in** via env.

## 14. Final recommendation

1. **Commit** reconciliation docs (`ITERLAW_PROJECT_STATUS.md`, `SPRINT_INDEX.md`, `PROJECT.md`, this report) on a small commit.  
2. **Isolate** `apps/web/lib/ai/*` edits into their own commit/PR after human review (feature-flag / sprint truth tests).  
3. **Schedule** Next/PostCSS upgrade sprint; until then keep **PARTIAL** security posture documented in status files.  
4. **CI:** add explicit job `cd apps/legal-orchestrator && npm test` if not already present.

## 15. Truth statement

- **No push** performed in this verification session.  
- **No deploy.**  
- **No kubectl.**  
- **No production DB** touched.  
- **No `npm audit fix --force`.**  
- **No external LLM API call** performed by the auditor (only repo `rg` + local npm scripts).  
- **No secrets** committed in this session’s doc edits.
