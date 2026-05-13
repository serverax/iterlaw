# Sprint 20 — UK Employment Ingestion Pack Foundation Report

## STATUS: PASS

Trusted-host allowlist, ingestion policy gate, citation registry policy, and an eight-calculator registry (all PLANNED) landed. 21 vitest cases PASS. Orchestrator suite grew 77/957 → **78 / 978 tests PASS**. No live fetch, no scraping, no DB write, no external LLM. No claim that the corpus is ingested.

---

## 1. Files added

- `apps/legal-orchestrator/src/ingestion/ukEmploymentSourceRegistry.ts` — six trusted hosts + nine source categories + deterministic tier order.
- `apps/legal-orchestrator/src/ingestion/ingestionPolicy.ts` — pure policy gate.
- `apps/legal-orchestrator/src/ingestion/citationRegistryPolicy.ts` — pure citation-metadata check.
- `apps/legal-orchestrator/src/legalRules/statutoryCalculatorRegistry.ts` — eight calculators, every one `status: "planned"`.
- `apps/legal-orchestrator/src/tests/ukEmploymentIngestionPack.test.ts` — 21 vitest cases.
- `docs/iterlaw/architecture/ITERLAW_UK_EMPLOYMENT_SOURCE_REGISTRY.md` — architecture doc.
- `docs/iterlaw/architecture/ITERLAW_STATUTORY_CALCULATOR_REGISTRY.md` — architecture doc.
- `docs/iterlaw/project/10-ingestion/UK_EMPLOYMENT_INGESTION_PACK_FOUNDATION.md` — sprint record.

## 2. Trusted hosts

| Host | Category | Tier |
|---|---|---|
| `www.legislation.gov.uk` | primary_legislation | 1 |
| `www.gov.uk` | gov_guidance | 4 |
| `www.acas.org.uk` | acas_guidance | 4 |
| `www.judiciary.uk` | judiciary_guidance | 3 |
| `www.bailii.org` | court_decision | 3 |
| `caselaw.nationalarchives.gov.uk` | court_decision | 3 |

## 3. Policy gate behaviour (proved by tests)

- `https://www.legislation.gov.uk/ukpga/1996/18/section/94` → `{ allowed: true, host: <legislation.gov.uk entry> }`.
- `https://www.gov.uk/holiday-entitlement-rights` → allowed.
- `https://www.acas.org.uk/discipline-and-grievance` → allowed.
- `https://www.judiciary.uk/some-guidance` → allowed.
- `https://www.bailii.org/uk/cases/UKEAT/...` → allowed.
- `https://random-blog.example.com/...` → `{ allowed: false, reason: "unapproved_host" }`.
- `http://www.gov.uk/...` (plain HTTP) → `{ allowed: false, reason: "non_https" }`.
- Empty / malformed URL → `unparseable_url`.

## 4. Citation registry policy (proved by tests)

- Missing `source_url` / `source_title` / `retrieved_at|verified_at` → typed `reasons`.
- Legal source missing `effective_from|effective_to` → `needs_review`.
- All-fields-present legal source → `fully_cited`.
- Non-legal source does not need effective date.

## 5. Statutory calculator registry (proved by tests)

- All eight calculators present (`limitation_dates`, `statutory_redundancy_pay`, `notice_period`, `holiday_pay`, `ssp`, `nmw_nlw`, `unfair_dismissal_cap`, `vento_bands`).
- Every calculator is `status: "planned"`.
- Every `officialSource` points at an official UK gov host (legislation / gov.uk / judiciary).

## 6. Static safety scan (proved by tests)

All four new pack files pass the static scan:

- No `import ... from "axios"` / `"node-fetch"` / `"http"` / `"https"`.
- No `fetch(` call.
- No external LLM hostname (`api.openai.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`).

## 7. QA

```
$ cd apps/legal-orchestrator && npm run typecheck → exit 0
$ cd apps/legal-orchestrator && npm run build    → exit 0
$ cd apps/legal-orchestrator && npm test         → 78 files / 978 tests PASS exit 0
$ cd .. && npm run typecheck                     → exit 0
$ npm run lint                                   → exit 0
$ npm run build                                  → exit 0
$ npm test                                       → 41 suites / 185 tests PASS exit 0
```

## 8. What this sprint does NOT do

- Does **not** ingest any corpus.
- Does **not** call any external host.
- Does **not** add a database migration.
- Does **not** implement any calculator.
- Does **not** wire the pack into `handleLegalRequest`.

## 9. Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl`. No production DB touched. No external LLM call. No secrets committed.
- No force-push. No git history rewrite.
- No claim that UK Employment corpus is ingested. All calculators remain `planned`.

## 10. Sprint 20 verdict

**STATUS: PASS** for the named "foundation" scope.
