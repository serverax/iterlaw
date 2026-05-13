# IterLaw Sprint Bundle 12F / 17 / 18 / 19 / 12G Summary

## Bundle verdict: PARTIAL

4 of 5 sprints PASS for their named scope. Sprint 12F is PARTIAL because both operator-environment prerequisites (Docker daemon, SSH credentials to the master) are blocked in this workstation — exactly the blocker the prior bundle predicted. No fake PASS. No false claims. **Net production-readiness movement: G08 flipped to PASS (Next.js advisory cleared).** Production readiness remains **NO**: 5 gates still failing (G09/G10/G11/G13 NOT_VERIFIED, G12 PARTIAL).

---

## Per-sprint status

| Sprint | Scope | Status | Commit | Pushed |
|---|---|---|---|---|
| 12F | Operator evidence flips for G09 / G10 / G11 | **PARTIAL** — Docker daemon down + SSH classifier-blocked. Both Sprint 14 + Sprint 15 scripts remain ready for an operator-authorised run; gate blocker text updated. | `e1ff24f` | yes |
| 17 | Change-controlled Next.js 14 → 15 upgrade | **PASS** — upgraded `next@14.2.35 → 15.5.18`. `npm audit --omit=dev` now reports **0 production vulnerabilities**. Cookies-API breaking change fixed in two API routes. G08 flipped to PASS. | `9411a38` | yes |
| 18 | Law Module Engine foundation | **PASS** — registry + types + 8 planned UK modules + UK Employment active + 12 vitest cases PASS. Placed in `src/lawModuleEngine/` (separate from existing `src/modules/` per-request pipeline). | `7b34065` | yes |
| 19 | Multi-tier retrieval foundation | **PASS** — orchestration layer in `src/retrieval/` composes existing intelligence primitives; 13 vitest cases PASS. No live wiring, no speed claim. | `bceb7ec` | yes |
| 12G | Live backup + live restore authorisation pack | **PASS** — pack + runbook + rollback plan + approval template + 2 evidence templates + safety-check script that correctly exits non-zero without approval. Live backup/restore NOT executed (by design). | `3d6a4e7` | yes |

---

## Commits created in this bundle (chronological)

```
e1ff24f ops(iterlaw): record operator evidence for readiness gates                     (Sprint 12F)
9411a38 chore(iterlaw): upgrade next for production security gate                       (Sprint 17)
7b34065 feat(iterlaw): add law module engine foundation                                 (Sprint 18)
bceb7ec feat(iterlaw): add multi-tier retrieval foundation                              (Sprint 19)
3d6a4e7 ops(iterlaw): add live backup and restore authorisation pack                    (Sprint 12G)
```

All five pushed to `origin/master`. Local matches remote.

---

## Tests / build / lint results

After each sprint:

- `npm run typecheck` → exit 0
- `npm run lint` → exit 0 (`✔ No ESLint warnings or errors`)
- `npm run build` → exit 0 (`post-next-standalone: static + public copied`)
- `npm test` (root jest) → **41 suites / 185 tests PASS**, exit 0
- `cd apps/legal-orchestrator && npm test` (vitest) → grew from **73 / 912** before this bundle to **75 / 937** after Sprint 19 (+2 files / +25 tests across Sprint 18 + Sprint 19)

No regressions.

---

## npm audit result

```
$ npm audit --omit=dev   (after this bundle)
found 0 vulnerabilities
exit 0

$ npm audit              (after this bundle)
7 vulnerabilities (4 low, 3 high)   ← dev-only: jest-environment-jsdom + eslint-config-next transitive
exit 0
```

Sprint 17 cleared the Next.js advisory. PostCSS was already cleared in Sprint 12E. The 7 remaining vulnerabilities are dev-only and explicitly out of production-readiness scope.

---

## Docker staging replay result

**NOT EXECUTED** in this bundle. Sprint 14 script remains committed and safety-scanned. Sprint 12F probed: `docker version` reports `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`. Operator must start Docker Desktop and run the script with the four required throwaway env vars to flip G09.

---

## K3s / Traefik read-only result

**NOT EXECUTED** in this bundle. Sprint 15 script remains committed. Sprint 12F probed: `ssh root@138.201.253.56` blocked by the Claude Code permission classifier ("Production Reads via remote shell requires explicit operator authorization"). Master IP is correctly pinned to `138.201.253.56`; `138.201.253.245` remains in the script's deny-list. Operator runs from a workstation with an authorised SSH agent to flip G10 + G11.

---

## Next.js security result

`14.2.35 → 15.5.18`. Production audit: **0 vulnerabilities**. G08 flipped `PARTIAL → PASS`. Compatibility fixes: `cookies()` made async in two API routes (`apps/web/app/api/case/route.ts`, `apps/web/app/api/orchestrator/legal/ask/route.ts`). `next lint` auto-bumped `tsconfig.json` `target` to `ES2017`. All tests stable.

---

## Law Module Engine result

Registry at `apps/legal-orchestrator/src/lawModuleEngine/`:

- 1 active module: `uk_employment` (UK_ENGLAND_WALES, 5 source tiers, citation policy strict, temporal `excludeSuperseded: true`, effective-date min 1996-01-01).
- 8 planned UK modules: housing, immigration, benefits, debt, consumer, family, business_contract, tax. All `status: "planned"` and refused by `requireActiveModule(...)` with `error.kind === "inactive_module"`.
- `legalModuleRegistry` frozen; no mutation API.
- 12 vitest cases PASS.
- **Not** wired into `handleLegalRequest` (foundation only).

---

## Multi-tier retrieval result

Foundation at `apps/legal-orchestrator/src/retrieval/`:

- Tiers: `exact_approved_qa` → `rules_lookup` → `full_text` → `vector` → RRF fusion → metadata filter → trust filter → freshness filter → context pack.
- `planAndExecuteMultiTier(request, deps)` pure orchestrator. No DB / network / external LLM. Data sources are injected.
- Exact approved hit short-circuits the rest of the pipeline.
- Historical mode keeps superseded content with a warning reason code.
- Failed-QA candidates blocked at trust filter (score 0).
- Decision trace surfaced in every result.
- 13 vitest cases PASS.
- **No** speed claim. **No** wiring into `handleLegalRequest`. Built **on top of** existing intelligence primitives without modifying them.

---

## Backup / restore authorisation result

Pack at `docs/iterlaw/operations/LIVE_BACKUP_RESTORE_AUTHORISATION_PACK.md` + runbook + rollback plan + approval template + two evidence templates + safety-check script. The safety-check script (`scripts/operator/check-live-backup-restore-authorisation.ps1`) **correctly exits non-zero** when approval is missing. **No live backup or restore executed.** G12 stays `PARTIAL`. G13 stays `NOT_VERIFIED`. Blocker text on both gates now references the Sprint 12G pack.

---

## Production readiness gate result (after this bundle)

```
$ node scripts/verify-production-readiness-gate.mjs
schema_version: 1; last_updated: 2026-05-13; declared_status: NO
gates_total: 17; gates_passing: 12; gates_failing: 5

Failing gates:
  G09 NOT_VERIFIED   Docker staging migration replay     (operator: Docker daemon + 4 env vars)
  G10 NOT_VERIFIED   K3s read-only cluster verification  (operator: SSH agent for 138.201.253.56)
  G11 NOT_VERIFIED   Traefik / live ingress              (tied to G10)
  G12 PARTIAL        Live backup dry-run                 (operator: redacted evidence using template)
  G13 NOT_VERIFIED   Live restore verification           (operator: isolated drill target + evidence)

exit code: 1
```

Movement from previous bundle: **+1 gate passing** (G08 → PASS). 12 of 17 gates now pass.

---

## Remaining blockers

| Gate | Blocker (exact, unchanged) |
|---|---|
| G09 | Docker Desktop daemon must be running on operator workstation + 4 throwaway `ITERLAW_STAGING_PG_*` env vars. |
| G10 | Operator-issued SSH key for `root@138.201.253.56` loaded in SSH agent. |
| G11 | Tied to G10. |
| G12 | Operator runs the live backup against the operator-managed DB, produces redacted evidence using the template, flips JSON. |
| G13 | Operator runs the live restore-verify against an isolated drill target, produces redacted evidence, flips JSON. |

Architectural items still outstanding (independent of gates):

- Wire `legalModuleRegistry.requireActiveModule(...)` into `handleLegalRequest` (feature-flagged) — Sprint 18.x.
- Wire `planAndExecuteMultiTier` into `handleLegalRequest` (feature-flagged) — Sprint 19.x.
- Per-tenant module entitlement schema — Sprint 18.y.
- UK Employment ingestion pack — Sprint 18.z.
- Reranker implementation — placeholder in Sprint 19 only.

---

## Production readiness: NO

Five gates still fail. The verifier exits 1. No code path declares IterLaw production-ready. The bundle made meaningful progress (G08 PASS, two foundation layers in place, authorisation pack ready) without falsifying anything.

---

## Next 5-sprint bundle recommendation

1. **Sprint 12H — Operator-run flips for G09 / G10 / G11.** Same script set; pure operator-evidence sprint when Docker Desktop and SSH credentials are available.
2. **Sprint 18.x — Wire Law Module Engine into `handleLegalRequest`.** Feature flag `ITERLAW_LAW_MODULE_REGISTRY_ENABLED` default OFF. Add tests asserting that `uk_employment` flows through and every non-active module returns a refusal.
3. **Sprint 19.x — Wire Multi-Tier Retrieval into `handleLegalRequest`.** Feature flag `ITERLAW_MULTI_TIER_RETRIEVAL_ENABLED` default OFF. Provide real `fullTextSearch` and `vectorSearch` adapters that delegate to `apps/legal-orchestrator/src/rag/postgresRetrieval.ts`. Add benchmark harness; **no speed claim** until a controlled benchmark report exists.
4. **Sprint 20 — UK Employment ingestion pack.** Source-pinning, citation registry alignment, statutory rate calculators (redundancy, NMW/NLW, notice, unfair-dismissal cap, Vento bands) — under change control, no live DB write.
5. **Sprint 12J — Operator-run live backup + live restore.** Operator follows the Sprint 12G runbook; produces redacted evidence; flips G12 + G13.

This sequence keeps every step honest: foundation-only sprints become wiring sprints behind feature flags, and live-infra sprints stay operator-led.

---

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No `D:\AI agent agency` access. No `F:\rahma` access. No other project touched.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite.
- **No `npm audit fix --force`.**
- No external LLM call.
- No secrets committed; no secret values printed.
- All five sprints pushed to `origin/master`. PARTIAL classification for Sprint 12F reflects two real environment blockers (Docker daemon, SSH classifier denial); not script defects.
- Sprint 17 upgrade preserved React 18 to minimise breaking-change surface; two cookies-API fixes were the only application-code changes.
- Sprint 18 + Sprint 19 added new foundation code only; no existing layer was modified or deleted.
- Sprint 12G's safety-check script proved by direct invocation; exits non-zero in the absence of approval.
