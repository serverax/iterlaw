# Sprint 17 — Next.js 14 → 15.5.18 Security Upgrade Report

## STATUS: PASS

Next.js was upgraded from `14.2.35` to `15.5.18` (latest stable in the Next 15 `backport` track). All Next.js production advisories are cleared. **`npm audit --omit=dev` now reports 0 vulnerabilities.** App typecheck PASS, lint PASS, build PASS, tests PASS. No `npm audit fix --force` used. No deploy. No production change.

---

## 1. Next.js before / after

```
Before: next root 14.2.35, next apps/web 14.2.35
After:  next root 15.5.18, next apps/web (hoisted to root) 15.5.18
```

Targets considered:
- `npm view next dist-tags` reported `next-14: 14.2.35`, `backport: 15.5.18`, `latest: 16.2.6`.
- Sprint 17 rule: prefer Next 15 over Next 16. The `backport` tag `15.5.18` is the latest stable Next 15. Peer dependencies on `15.5.18` allow `react ^18.2.0`, so the existing `react 18.3.1` continues to work without a React major upgrade.

## 2. npm audit before / after

```
$ npm audit --omit=dev   (before)
1 high severity vulnerability   (Next.js)
exit 0

$ npm audit              (before)
8 vulnerabilities (4 low, 4 high)
exit 0
```

```
$ npm audit --omit=dev   (after)
found 0 vulnerabilities
exit 0

$ npm audit              (after)
7 vulnerabilities (4 low, 3 high)
exit 0
```

The remaining 7 total vulnerabilities are **dev-only**:

- `@tootallnate/once` (transitive via `jest-environment-jsdom`) — moderate; only used in test environment.
- `glob 10.2.0 - 10.4.5` (transitive via `@next/eslint-plugin-next` → `eslint-config-next`) — high; only used in lint.

Neither appears in the production audit. Both require breaking-change upgrades to clear and are explicitly **out of scope** for this sprint (Sprint 17 targets the production gate only).

## 3. Files changed

| File | Change |
|---|---|
| `package.json` | Root `next` devDep bumped `^14.2.18` → `^15.5.18` (root hoist required for `eslint-config-next` to resolve `next/dist/compiled/babel/eslint-parser`, as documented in Sprint 12E). |
| `apps/web/package.json` | `next` dep bumped to `15.5.18` (via `npm install -w @iterlaw/web next@15.5.18`). |
| `package-lock.json` | Regenerated to reflect Next 15.5.18 across the dependency tree. |
| `apps/web/app/api/case/route.ts` | Next 15 made `cookies()` async; line 70 changed from `cookies().get(ANON_COOKIE)?.value` to `(await cookies()).get(ANON_COOKIE)?.value`. |
| `apps/web/app/api/orchestrator/legal/ask/route.ts` | Same `cookies()` change. `identitySlice` made async (`Promise<...>` return type), caller switched to `await identitySlice()`. |
| `apps/web/tsconfig.json` | `next lint` auto-bumped `target` to `ES2017` (toolchain-driven, not by my hand; required for top-level `await` support). |
| `docs/iterlaw/project/PRODUCTION_READINESS_GATE.json` | G08 flipped `PARTIAL` → `PASS`; blocker cleared; evidence path points to this report. |
| `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md` | Security-state bullet updated to reflect Next 15.5.18 + 0 production advisories. |
| `docs/iterlaw/project/ITERLAW_REAL_STATUS_AND_REMAINING_SPRINTS_REPORT.md` | GAP-002 row marked closed in Sprint 17. |
| `reports/ITERLAW_SPRINT_17_NEXT_SECURITY_UPGRADE.md` | This report. |

## 4. Compatibility fixes applied

- **`cookies()` is now async in Next 15.** Two API routes used `cookies().get(...)` synchronously. Both updated to `(await cookies()).get(...)`. The caller of the now-async `identitySlice` function in `apps/web/app/api/orchestrator/legal/ask/route.ts` was updated to `await identitySlice()`.
- **`tsconfig.json` `target`**: `next lint` reconfigured it to `ES2017` automatically; left as-is (consistent with Next 15 expectation).
- **No other breaking changes hit**. App Router routes, middleware, fast-refresh, and the `post-next-standalone.cjs` post-build step all worked without modification.

## 5. QA results (all post-upgrade)

```
$ npm run typecheck   →   exit 0
$ npm run lint        →   exit 0    ("✔ No ESLint warnings or errors")
$ rm -rf apps/web/.next && npm run build → exit 0    ("post-next-standalone: static + public copied")
$ npm test            →   41 suites / 185 tests PASS   exit 0
$ cd apps/legal-orchestrator && npm test → 73 files / 912 tests PASS   exit 0
```

No regressions.

## 6. Production readiness impact

`G08 — npm audit --omit=dev has zero unresolved applicable production advisories` is now **PASS**. The gate verifier now reports 12 of 17 gates passing (was 11).

```
$ node scripts/verify-production-readiness-gate.mjs > /dev/null
exit 1   (still non-zero; remaining 5 gates: G09 NOT_VERIFIED, G10 NOT_VERIFIED, G11 NOT_VERIFIED, G12 PARTIAL, G13 NOT_VERIFIED)
```

Production readiness remains **NO**. The remaining 5 gates are all operator-environment dependencies (Docker daemon, SSH credentials, live backup/restore authorisation) — not code defects.

## 7. Remaining advisories

| Severity | Package | Type | Notes |
|---|---|---|---|
| high (3) + low (4) | dev-only (jest-environment-jsdom transitive, eslint-config-next transitive) | dev | Out of scope for production readiness. Future sprint may bump jest-environment-jsdom (would touch jest matrix) and eslint-config-next (would touch lint pipeline). |

No applicable production advisory remains.

## 8. Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl`. No production DB touched. No external LLM call. No secrets committed.
- No force-push. No git history rewrite.
- **No `npm audit fix --force` used.**
- Upgrade was change-controlled to Next 15.5.18 (latest backport stable), preserving React 18 to minimise breaking-change surface.
- Two real code changes were required to satisfy Next 15's async-`cookies()` contract.
- Production audit verified at 0 vulnerabilities. Tests / build / typecheck / lint stable.

## 9. Sprint 17 verdict

**STATUS: PASS** — Next.js production advisory cleared via Next 14 → 15.5.18 upgrade; minimal compatibility fixes; full QA green; G08 flips to PASS.
