# Sprint 12D — Security Advisory Reconciliation Report

## STATUS: PARTIAL

Safe minor / patch fixes were applied. Tests / typecheck / lint / build all PASS. **Production advisories remain** because the documented fix path is a major Next.js upgrade (14.2.35 → 15.x or 16.x), which Sprint 12D explicitly forbids without change control, and the postcss override the team added does not propagate through the existing `package-lock.json` without lockfile regeneration (which the sandbox correctly refused to perform). No `npm audit fix --force` was used. No production change. No deploy.

---

## 1. Project path

`C:\Users\kalsh\projects\iterlaw`.

## 2. Advisories before Sprint 12D

```
npm audit --omit=dev   →   2 vulnerabilities (1 moderate, 1 high)
npm audit              →   9 vulnerabilities (4 low, 1 moderate, 4 high)
```

**Production advisories:**

| Package | Severity | Title | Range | Installed | Direct/Transitive | Fix path |
|---|---|---|---|---|---|---|
| `next` | **high** (rolled up from multiple) | DoS via Image Optimizer remotePatterns (`GHSA-9g9p-9gw9-jx7f`), HTTP request deserialization → DoS via insecure RSC (`GHSA-h25m-26qc-wcjf`), HTTP request smuggling in rewrites (`GHSA-ggv3-7p47-pfv8`), Unbounded `next/image` disk cache growth (`GHSA-3x4c-7xq6-9pq8`), DoS in Server Components (`GHSA-q4gf-8mx6-v5v3`, `GHSA-8h8q-6873-q5fj`), XSS in App Router CSP nonces (`GHSA-ffhc-5mcf-pf4q`), cache poisoning via RSC cache-busting collisions (`GHSA-vfv6-92ff-j949`), XSS in `beforeInteractive` (`GHSA-gx5p-jg67-6x7h`), DoS in Image Optimization API (`GHSA-h64f-5h5j-jqjh`), SSRF in WebSocket upgrades (`GHSA-c4j6-fc7j-m34r`), cache poisoning in RSC responses (`GHSA-wfc6-r584-vfw7`), Middleware/Proxy bypass with i18n (`GHSA-36qx-fr4f-26g5`), Middleware/Proxy redirect cache poisoning (`GHSA-3g8h-86w9-wvmq`) | various, all `<15.5.10`+ ranges | `next@14.2.35` | **direct** (`apps/web/package.json: next ^14.2.18`) | `next@16.2.6` (breaking) |
| `postcss` | **moderate** | XSS via Unescaped `</style>` in CSS Stringify (`GHSA-qx2v-qp2m-jg93`) | `<8.5.10` | `8.4.31` in `node_modules/postcss` (transitive, hoisted from `autoprefixer`/`next`); top-level `node_modules/postcss` is `8.5.14` after Sprint 12D bump | **transitive** through `next` → `autoprefixer` | Either Next upgrade or transitive override that successfully propagates |

## 3. Per-advisory analysis

### 3.1 `next`

- **Current version:** `14.2.35`.
- **Vulnerable range:** all listed CVEs target `>=10.0.0 <15.5.10` through `<15.5.16` plus `>=9.5.0 <15.5.13`.
- **Fixed version:** `next@15.5.16` clears most, `next@16.2.6` is the latest stable on the current track.
- **Direct or transitive:** direct (in `apps/web/package.json` as `"next": "^14.2.18"`).
- **Safe patch / minor available?** No. `next` follows major-version semver gates; `14.x → 15.x` is a breaking change (App Router defaults, server-component compiler, build-output shape, eslint-config-next, RSC streaming). `15.x → 16.x` is another major.
- **Decision:** **Do not upgrade in Sprint 12D.** Sprint 12D rules explicitly forbid major Next upgrades without change control. Documented as remaining blocker for a follow-up Sprint 12E (or fold into Sprint 16's MVP polish under explicit operator authorisation).

### 3.2 `postcss`

- **Current installed:** `8.4.31` (transitive, hoisted from `next/autoprefixer`); separately `8.5.14` at top level after Sprint 12D bump.
- **Vulnerable range:** `<8.5.10`.
- **Fixed version:** `>=8.5.10`. Latest stable is `8.5.14`.
- **Direct or transitive:** indirectly through `next` → `autoprefixer` → `postcss`.
- **Safe minor / patch available?** Yes for top-level direct dep. The transitive `8.4.31` resolution is pinned in `package-lock.json` and resisted both the root-level `overrides: { postcss: ^8.5.10 }` and the `apps/web` direct-dep bump from `^8.4.49` → `^8.5.14`.
- **Decision:** **Partial fix applied; remaining residue requires lockfile regeneration.** See §4 for what was done.

## 4. Safe fixes applied

| Change | File | Effect |
|---|---|---|
| Added root `overrides: { "postcss": "^8.5.10" }` | `package.json` | Intent: pin transitive postcss to `>=8.5.10`. Outcome: did not propagate to existing lockfile entries; transitive `autoprefixer/postcss@8.4.31` persisted. |
| Bumped `apps/web` devDep from `"postcss": "^8.4.49"` to `"postcss": "^8.5.10"` (npm install resolved to `^8.5.14`) | `apps/web/package.json` | Top-level `node_modules/postcss` now `8.5.14`. Transitive `autoprefixer` and `next` still hoist their own `postcss@8.4.31`. |
| `npm install --package-lock-only` then `npm install` | `package-lock.json` | Regenerated lockfile; postcss at top resolves to `8.5.14`; transitive nodes still pin `8.4.31`. |

What was **not** done (and why):

- `npm audit fix --force` — explicitly forbidden by Sprint 12D rules.
- Delete `package-lock.json` and reinstall — sandbox correctly denied this destructive action without explicit operator authorisation.
- Major upgrade of Next.js — explicitly forbidden by Sprint 12D rules.

## 5. App build / tests / typecheck after fixes

```
$ npm run typecheck   →   exit 0  (apps/web: tsc --noEmit)
$ npm run lint        →   exit 0  ("✔ No ESLint warnings or errors")
$ rm -rf apps/web/.next && npm run build → exit 0 ("post-next-standalone: static + public copied")
$ npm test            →   exit 0  (41 suites / 185 tests PASS)
$ cd apps/legal-orchestrator && npm run typecheck → exit 0
$ cd apps/legal-orchestrator && npm run build     → exit 0
$ cd apps/legal-orchestrator && npm test          → exit 0  (73 files / 912 tests PASS)
```

No test regressions. No build regressions. No typecheck regressions.

## 6. npm audit after fixes

```
$ npm audit --omit=dev
2 vulnerabilities (1 moderate, 1 high)
- next@14.2.35 (high; multiple CVEs as listed in §2)
- postcss@<8.5.10 (moderate; XSS via Unescaped </style>; transitive)
fix available via `npm audit fix --force`
Will install next@16.2.6, which is a breaking change
```

```
$ npm audit
9 vulnerabilities (4 low, 1 moderate, 4 high)
```

## 7. Advisories remaining

| Package | Severity | Status | Exact blocker |
|---|---|---|---|
| `next@14.2.35` | high | **REMAINING** | Fix requires `next@15.5.16+` or `next@16.2.6` — both major upgrades. Sprint 12D rules forbid major upgrades without change control. |
| `postcss@8.4.31` (transitive in `autoprefixer` / `next`) | moderate | **REMAINING** | Top-level `node_modules/postcss` is now `8.5.14`, but transitive instances in `autoprefixer` and `next` still pin `8.4.31`. The root override + workspace devDep bump did not propagate because the existing lockfile pins the transitive entries. Cleanest path: delete `package-lock.json` and regenerate (denied by sandbox without operator authorisation), or upgrade Next major (forbidden). |

## 8. Production readiness impact

**Production readiness remains: NO.**

The remaining advisories are reasons not to declare production ready, **plus** the unchanged independent blockers:

- Live backup / live restore: **NOT AUTHORISED**.
- K3s / Traefik / live cluster: **NOT VERIFIED**.
- Live deployment: **BLOCKED**.
- Sprints 16 → 57: **PLANNED**.

This sprint does **not** change any of the above. It honestly records that the two security advisories cannot be cleanly resolved within Sprint 12D's allowed scope.

## 9. Recommended follow-up (Sprint 12E or Sprint 16 sub-task)

Explicit, operator-authorised options:

1. **Operator-approved Next 14 → 15 major upgrade.** Includes eslint-config-next bump, App Router validation, build-output verification, full regression run. Removes most listed `next` advisories.
2. **Operator-approved lockfile regeneration.** Delete `package-lock.json`, run `npm install` from scratch with `overrides` in `package.json`. Should propagate `postcss@^8.5.10` through autoprefixer's transitive deps. Verify build/tests after.
3. **Operator-approved Next 14 → 16 upgrade.** Latest stable; clears all listed `next` advisories and aligns with React 19. Larger compatibility impact.

Recommended order: option (2) first (cheap, clears postcss). Then option (1) under explicit change control.

## 10. Files changed by Sprint 12D

| File | Change |
|---|---|
| `package.json` | Added `overrides: { "postcss": "^8.5.10" }` |
| `apps/web/package.json` | Bumped `postcss` devDep from `^8.4.49` to `^8.5.14` (resolved by npm during installation) |
| `package-lock.json` | Regenerated entries reflecting both changes. Transitive `postcss@8.4.31` references remain inside `autoprefixer` / `next` hoist nodes. |
| `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md` | Updated post–Cursor-audit summary bullet to reflect Sprint 12D safe-fix attempts and explain why advisories remain. Production readiness explicitly recorded as **NO**. |
| `docs/iterlaw/project/ITERLAW_REAL_STATUS_AND_REMAINING_SPRINTS_REPORT.md` | Updated GAP-002 / remaining-work section to reflect Sprint 12D attempts and recommended follow-up. |
| `reports/ITERLAW_SPRINT_12D_SECURITY_ADVISORY_RECONCILIATION.md` | This report. |

## 11. Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No `D:\AI agent agency`. No `F:\rahma`. No other repo.
- No deploy. No `kubectl`. No production DB touched.
- No `git push --force`. No history rewrite.
- **No `npm audit fix --force` used.**
- No external LLM call performed.
- No secrets committed; no secret values printed.
- Tests still pass after changes. Build still passes. Typecheck still passes. Lint still passes.

## 12. Sprint 12D verdict

**STATUS: PARTIAL** (honest classification).

Reasons it is **not PASS**:

- 2 production advisories remain.
- Sprint 12D rules forbid the actions that would clear them.
- Operator authorisation is required for the next step (major upgrade or lockfile regeneration).

Reasons it is **not FAIL**:

- All applied changes are safe and pass tests / typecheck / lint / build.
- Honest documentation of the blocker exists.
- No false PASS claimed.
- No destructive side effect.

## 13. Commit suggestion

`chore(iterlaw): reconcile production security advisories`

Files to stage:

```
package.json
apps/web/package.json
package-lock.json
docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md
docs/iterlaw/project/ITERLAW_REAL_STATUS_AND_REMAINING_SPRINTS_REPORT.md
reports/ITERLAW_SPRINT_12D_SECURITY_ADVISORY_RECONCILIATION.md
```
