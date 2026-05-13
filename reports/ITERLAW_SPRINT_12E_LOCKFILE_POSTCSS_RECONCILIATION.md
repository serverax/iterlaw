# Sprint 12E — Lockfile Regeneration + PostCSS Reconciliation Report

## STATUS: PASS (PostCSS production advisory resolved; Next.js advisory remains and is out of scope per sprint rules)

PostCSS production advisory **cleared** via operator-authorised `package-lock.json` regeneration combined with a versioned `overrides` clause and a root-level `next` devDep pin (needed to keep next hoisted so `eslint-config-next` can resolve it). All tests, typecheck, lint, and build PASS. No `npm audit fix --force` used. No major Next upgrade. No deploy.

---

## 1. Before audit result

```
$ npm audit --omit=dev   →   2 vulnerabilities (1 moderate postcss, 1 high next)   (exit 0)
$ npm audit              →   9 vulnerabilities (4 low, 1 moderate, 4 high)          (exit 0)
```

PostCSS advisory: `postcss <8.5.10` — XSS via Unescaped `</style>` (`GHSA-qx2v-qp2m-jg93`). Resolved by `>=8.5.10`. Vulnerable hoisted version was `8.4.31`, pinned by `next@14.2.35` declaring `"postcss": "8.4.31"` exact.

## 2. After audit result

```
$ npm audit --omit=dev   →   1 high severity vulnerability (Next.js only)            (exit 0)
$ npm audit              →   8 vulnerabilities (4 low, 4 high)                       (exit 0)
```

PostCSS advisory cleared from the production audit. Total advisory count down 9 → 8.

## 3. Package-lock regeneration evidence

```
$ copy package-lock.json package-lock.before-sprint12e.json   (made a comparison backup)
$ rm package-lock.json
$ npm install --package-lock-only --no-audit --no-fund        (regenerated lockfile with overrides applied)
$ rm -rf node_modules apps/web/node_modules apps/legal-orchestrator/node_modules
$ npm install --no-audit --no-fund                            (clean install)
   → added 747 packages in 1m, exit 0
$ rm package-lock.before-sprint12e.json                        (backup removed; lockfile regeneration evidence is the diff in `package-lock.json` itself)
```

## 4. PostCSS package tree before / after

### Before Sprint 12E (post-12D state, audit showed 2 prod advisories)

```
iterlaw@0.1.0
`-- @iterlaw/web@0.1.0
  +-- autoprefixer@10.5.0 → postcss@8.4.31
  +-- next@14.2.35       → postcss@8.4.31
  +-- postcss@8.5.14     (top-level apps/web declared dep, hoisted to top)
  └-- tailwindcss@3.4.19 → postcss@8.4.31 (deduped)
  
node_modules/postcss   (hoisted)   →   8.4.31
```

The hoisted top-level `postcss` was `8.4.31` because next pinned it exactly. The audit reported the moderate XSS advisory against that hoisted instance.

### After Sprint 12E

```
iterlaw@0.1.0
`-- @iterlaw/web@0.1.0
  +-- autoprefixer@10.5.0 → postcss@8.5.14 (deduped)
  +-- next@14.2.35        → postcss@8.5.14 (deduped; npm reports "invalid: 8.4.31 from next" — expected, the override beats next's exact pin)
  +-- postcss@8.5.14      (declared dep + override match)
  └-- tailwindcss@3.4.19  → postcss@8.5.14 (deduped)

node_modules/postcss   (hoisted)   →   8.5.14
```

Every postcss resolution in the dep tree is now `8.5.14`. The "invalid" markings from `npm ls` are expected by design — the override deliberately replaces next's exact pin.

## 5. Files changed

| File | Change |
|---|---|
| `package.json` | Set `"overrides": { "postcss@<8.5.10": "8.5.14" }` (versioned-range override syntax; only matches the vulnerable range, leaves untouched anything already safe). Added `next: ^14.2.18` to root `devDependencies` so npm hoists `next` to top-level `node_modules/`, which is required for `eslint-config-next/parser.js` to resolve `next/dist/compiled/babel/eslint-parser`. (Initial attempts using the simpler `overrides: { postcss: ^8.5.10 }` did not propagate; intermediate attempt using `$postcss` self-reference + root `dependencies.postcss` caused next to be installed only inside `apps/web/node_modules`, breaking `next lint`.) |
| `apps/web/package.json` | `postcss` devDep already at `^8.5.14` from Sprint 12D. No further change in 12E. |
| `package-lock.json` | Regenerated from scratch; all postcss entries now resolve to `8.5.14`. |
| `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md` | Updated security-state bullet to reflect Sprint 12E PostCSS resolution and 1 remaining advisory (Next.js). |
| `docs/iterlaw/project/ITERLAW_REAL_STATUS_AND_REMAINING_SPRINTS_REPORT.md` | Updated GAP-002 row to reflect Sprint 12E outcome. |
| `reports/ITERLAW_SPRINT_12E_LOCKFILE_POSTCSS_RECONCILIATION.md` | This report. |

## 6. QA results

```
$ npm run typecheck             →   exit 0
$ npm run lint                  →   "✔ No ESLint warnings or errors"     exit 0
$ rm -rf apps/web/.next && npm run build → exit 0 ("post-next-standalone: static + public copied")
$ npm test                      →   41 suites / 185 tests PASS           exit 0
$ cd apps/legal-orchestrator && npm install →  added 173 packages         exit 0
$ cd apps/legal-orchestrator && npm run typecheck → exit 0
$ cd apps/legal-orchestrator && npm run build     → exit 0
$ cd apps/legal-orchestrator && npm test          → 73 files / 912 tests PASS  exit 0
```

No regressions. All tests stable. `eslint-config-next` resolves `next/dist/compiled/babel/eslint-parser` cleanly because `next@14.2.35` is now hoisted to top-level `node_modules/next/` (verified with `ls node_modules/next/dist/compiled/babel/eslint-parser.js`).

## 7. Remaining advisories

| Package | Severity | Status | Blocker |
|---|---|---|---|
| `next@14.2.35` | high | **REMAINING** | All listed advisories require `next@15.5.16+` or `next@16.2.6`. Both are major upgrades. Sprint 12E explicitly forbids major Next upgrade. Move to a change-controlled upgrade sprint. |

## 8. Production readiness impact

PostCSS no longer blocks production readiness. **Next.js still blocks it**, plus the independent blockers (live backup/restore NOT AUTHORISED, K3s/Traefik/live cluster NOT VERIFIED, live deploy BLOCKED, Sprints 16–57 PLANNED).

**Production readiness: NO** (one production advisory remains; live-cluster gates unmet).

## 9. Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl`. No production DB touched.
- No `git push --force`. No git history rewrite.
- **No `npm audit fix --force` used.**
- No external LLM call.
- No secrets committed.
- Operator-authorised lockfile regeneration applied; backup file deleted after comparison.
- All tests / typecheck / lint / build PASS.

## 10. Sprint 12E verdict

**STATUS: PASS** for the named Sprint 12E scope. PostCSS production advisory cleared. QA green. The independent Next.js advisory is documented as out-of-scope work for a future change-controlled upgrade sprint.
