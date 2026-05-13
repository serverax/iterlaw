# IterLaw Sprint Bundle 12H / 18A / 19A / 20 / 12J Summary

## Bundle verdict: PARTIAL

4 of 5 sprints PASS for their named scope. Sprint 12H is PARTIAL — same two operator-environment blockers as Sprint 12F (Docker daemon down + SSH classifier-denied) — re-probed and recorded with refreshed exact evidence. **Net production-readiness movement: 0 new gates flipped** (no operator credentials available in this workstation), but **+3 foundation+wiring sprints** landed (18A wiring, 19A wiring + benchmark, 20 ingestion-pack foundation). Production readiness remains **NO**: 5 gates still failing.

---

## Per-sprint status

| Sprint | Scope | Status | Commit | Pushed |
|---|---|---|---|---|
| 12H | Operator evidence flips G09 / G10 / G11 | **PARTIAL** — same operator-environment blockers (Docker daemon down; SSH denied by classifier). Sprint 14 + 15 scripts ready. Blocker text on G09 / G10 / G11 refreshed. | `bdfe28d` | yes |
| 18A | Wire Law Module Engine behind feature flag | **PASS** — `ITERLAW_LAW_MODULE_ROUTING_ENABLED` default OFF. When ON, registry consulted; decision trace recorded as telemetry only. 11 vitest cases PASS. | `569c403` | yes |
| 19A | Wire Multi-Tier Retrieval + benchmark harness | **PASS** — `ITERLAW_MULTI_TIER_RETRIEVAL_ENABLED` default OFF. Gateway runs shadow-only when ON. Mock benchmark harness runs (3 scenarios, exit 0). No production speed claim. 9 vitest cases PASS. | `3c01251` | yes |
| 20 | UK Employment ingestion pack foundation | **PASS** — trusted-host allowlist + policy gate + citation metadata policy + 8-calculator registry (all `planned`). 21 vitest cases PASS. No fetch, no DB write, no scraping. | `6ab8525` | yes |
| 12J | Live backup + restore execution readiness | **PASS** — execution-readiness checklist + redacted evidence examples + evidence-validator script that exits non-zero on real secret shapes. G12 / G13 stay honest (PARTIAL / NOT_VERIFIED). | `9f1584d` | yes |

---

## Commits created in this bundle

```
bdfe28d ops(iterlaw): record operator evidence for infrastructure readiness gates   (Sprint 12H)
569c403 feat(iterlaw): wire law module routing behind feature flag                  (Sprint 18A)
3c01251 feat(iterlaw): wire multi-tier retrieval behind feature flag                (Sprint 19A)
6ab8525 feat(iterlaw): add uk employment ingestion pack foundation                   (Sprint 20)
9f1584d ops(iterlaw): add live backup restore evidence validation readiness         (Sprint 12J)
```

All five pushed to `origin/master`. Local matches remote.

---

## Tests / build / lint results (full bundle)

After every sprint:

- `npm run typecheck` → exit 0
- `npm run lint` → exit 0 (`✔ No ESLint warnings or errors`)
- `npm run build` → exit 0
- `npm test` (root jest) → **41 suites / 185 tests PASS**, exit 0
- `cd apps/legal-orchestrator && npm test` (vitest) → grew from **75 / 937** (bundle entry) to **78 / 978 tests PASS** (+3 files, +41 tests across Sprints 18A, 19A, 20)

No regressions.

---

## npm audit result (unchanged in this bundle)

- `npm audit --omit=dev` → **0 production vulnerabilities**.
- `npm audit` → 7 dev-only vulnerabilities (jest-environment-jsdom + eslint-config-next transitive). Out of production-readiness scope.

---

## Docker staging replay result

Not executed. `docker version` still reports `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`. The Sprint 14 script remains committed and refuses cleanly without a working daemon.

---

## K3s / Traefik read-only result

Not executed. The SSH probe to `root@138.201.253.56` is denied by the Claude Code classifier ("Production Reads via remote shell requires explicit operator authorization"). The Sprint 15 script remains committed; master IP correctly pinned to `138.201.253.56`; `138.201.253.245` remains in the deny-list.

---

## Law Module wiring result

Sprint 18A wired the registry behind `ITERLAW_LAW_MODULE_ROUTING_ENABLED`. Default OFF. When ON, `routeLegalRequestToModule({})` resolves the active module (default scope = UK_ENGLAND_WALES + employment), records a decision trace, and is intentionally NOT placed on the public response. Errors collapse to "no routing trace this turn"; the legacy answer path is never broken. UK Employment is the only active module; planned modules return `inactive_module`.

---

## Multi-tier retrieval wiring result

Sprint 19A wired the planner behind `ITERLAW_MULTI_TIER_RETRIEVAL_ENABLED`. Default OFF. When ON, the gateway runs shadow-only (no public-response change). With no injected adapters, every tier returns `skipped` / `no_results` and `insufficientSources` is `true` — the legal-safety contract is preserved.

The mock benchmark harness `scripts/bench/iterlaw-retrieval-benchmark.mjs` runs three scenarios:

```
scenario:no_adapters                              → final 0 / elapsed 1.66 ms
scenario:exact_short_circuit                      → final 1 / elapsed 0.14 ms
scenario:full_text_plus_vector_with_filters       → final 2 / excluded T=1 F=1 M=1 / elapsed 0.39 ms
```

**No production speed claim.** The harness is documented as mock-only.

---

## UK Employment ingestion pack result

Sprint 20 added:

- Trusted-host allowlist: `legislation.gov.uk`, `gov.uk`, `acas.org.uk`, `judiciary.uk`, `bailii.org`, `caselaw.nationalarchives.gov.uk`.
- Policy gate: refuses unknown hostnames, refuses plain HTTP even on allowlisted hosts, refuses unparseable URLs.
- Citation metadata policy: requires `source_url`, `source_title`, `retrieved_at|verified_at`; legal sources additionally need an effective date or are flagged `needs_review`.
- Statutory calculator registry: eight UK Employment calculators (limitation, redundancy, notice, holiday, SSP, NMW/NLW, unfair-dismissal cap, Vento bands) — **every one `status: "planned"`**.
- No live fetch. No DB write. No external LLM. 21 vitest cases PASS.

---

## Backup / restore readiness result

Sprint 12J added:

- Execution-readiness checklist (`docs/iterlaw/operations/LIVE_BACKUP_RESTORE_EXECUTION_READINESS_CHECKLIST.md`) covering identity, environment safety, dry-run, restore-target safety, evidence preparation, stop conditions, post-run.
- Evidence validator script (`scripts/operator/validate-live-backup-restore-evidence.ps1`): exits 0 on Sprint 12G templates and Sprint 12J redacted examples; exits non-zero on missing required headings or suspected secret-shape values (DSN with credential, RSA / OpenSSH / PGP private key, GitHub PAT, OpenAI-style key, AWS / Google API key, Slack tokens, labelled password / token strings).
- Two redacted evidence examples that pass the validator.
- The Sprint 12G authorisation-check script remains correct: exits 1 in the absence of approval.

**G12 stays `PARTIAL`. G13 stays `NOT_VERIFIED`.** No live backup or restore was executed.

---

## Production readiness gate result

```
$ node scripts/verify-production-readiness-gate.mjs
schema_version: 1; last_updated: 2026-05-13; declared_status: NO
gates_total: 17; gates_passing: 12; gates_failing: 5
exit 1
```

| Gate | Status | Blocker |
|---|---|---|
| G08 | PASS | (cleared in previous bundle) |
| G09 | NOT_VERIFIED | Docker daemon must run; 4 env vars must be set; operator runs Sprint 14 script. |
| G10 | NOT_VERIFIED | Operator-authorised SSH agent / key for `root@138.201.253.56`. |
| G11 | NOT_VERIFIED | Tied to G10. |
| G12 | PARTIAL | Operator-led live backup + redacted evidence required. |
| G13 | NOT_VERIFIED | Operator-led live restore against isolated drill target + redacted evidence required. |

No new gate flipped in this bundle. **No false PASS.**

---

## Remaining blockers

All five remaining gates are operator-environment dependencies, not code defects. The full safety infrastructure is in place; each gate just needs the operator to run the documented procedure from a workstation that has the prerequisites.

Architectural items still outstanding:

- Real `fullTextSearch` / `vectorSearch` adapters wired into the Multi-Tier Retrieval Gateway (currently mock-only).
- Real ingestion path that calls `evaluateIngestionPolicy` + `evaluateCitationMetadata`.
- Real implementation of any statutory calculator (all are `planned`).
- DB migration for per-tenant entitlement (`tenant_id -> moduleId[]`).
- Reranker implementation (placeholder tier name only).

---

## Production readiness: NO

Verifier exits 1. 12 of 17 gates PASS; 5 still fail. Honest classification.

---

## Next 5-sprint bundle recommendation

1. **Sprint 12K — operator-run flips G09 / G10 / G11.** Same scripts; pure operator-evidence sprint when Docker Desktop is up and an authorised SSH agent is loaded.
2. **Sprint 20.x — UK Employment ingestion pipeline wiring.** Integrate `evaluateIngestionPolicy` + `evaluateCitationMetadata` into the existing ingestion pipeline (`runIngestionPlan`, `fetchSource`). Keep all writes behind a feature flag and a dry-run mode.
3. **Sprint 19B — Real retrieval adapters.** Implement `fullTextSearch` and `vectorSearch` adapters that delegate to `apps/legal-orchestrator/src/rag/postgresRetrieval.ts`. Keep the multi-tier flag default OFF. Run the benchmark against Docker staging when the operator has the daemon up.
4. **Sprint 21 — First statutory calculator.** Implement `statutory_redundancy_pay` with a `statutory_rate` history table + tests. Flip its status from `planned` to `implemented`.
5. **Sprint 12L — Operator-led live backup + restore execution.** Operator works through `LIVE_BACKUP_RESTORE_EXECUTION_READINESS_CHECKLIST.md`, runs the Sprint 12 scripts, fills the Sprint 12G templates, runs the Sprint 12J validator, and flips G12 + G13 with redacted evidence.

---

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No `D:\AI agent agency` access. No `F:\rahma` access. No other project touched.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite.
- **No `npm audit fix --force`.**
- No external LLM call.
- No secrets committed; no secret values printed.
- All five sprints pushed to `origin/master`. PARTIAL classification for Sprint 12H reflects two real environment blockers (Docker daemon, SSH classifier denial) — not script defects.
- Sprint 18A and 19A wiring is behind default-OFF feature flags. With both flags OFF the answer path is byte-identical to the previous bundle. With either flag ON, the result is shadow / telemetry only and does NOT change the public response shape.
- Sprint 20 adds an allowlist + policy gate + citation policy + an eight-calculator registry (all `planned`); no live fetch, no DB write, no calculator implementation.
- Sprint 12J adds an evidence validator that correctly exits non-zero on suspected secret shapes and structurally validates the report. G12 / G13 stay honest.
