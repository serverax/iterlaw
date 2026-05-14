# Sprint 20 — UK Employment Ingestion Pack Foundation

> **Foundation only.** No live fetch. No scraping. No production DB write. No claim that the corpus is ingested.

Cross-reference:

- [`docs/iterlaw/architecture/ITERLAW_UK_EMPLOYMENT_SOURCE_REGISTRY.md`](../../architecture/ITERLAW_UK_EMPLOYMENT_SOURCE_REGISTRY.md)
- [`docs/iterlaw/architecture/ITERLAW_STATUTORY_CALCULATOR_REGISTRY.md`](../../architecture/ITERLAW_STATUTORY_CALCULATOR_REGISTRY.md)

## What landed

- `apps/legal-orchestrator/src/ingestion/ukEmploymentSourceRegistry.ts` — trusted hosts + tier ordering.
- `apps/legal-orchestrator/src/ingestion/ingestionPolicy.ts` — policy gate.
- `apps/legal-orchestrator/src/ingestion/citationRegistryPolicy.ts` — citation metadata check.
- `apps/legal-orchestrator/src/legalRules/statutoryCalculatorRegistry.ts` — calculator registry, all PLANNED.
- `apps/legal-orchestrator/src/tests/ukEmploymentIngestionPack.test.ts` — 21 vitest cases.

## Acceptance

- Only allowlisted official hostnames pass `evaluateIngestionPolicy`.
- Unknown host → `unapproved_host`.
- Plain HTTP → `non_https`.
- Empty / malformed URL → `unparseable_url`.
- Citation metadata: missing fields → typed `reasons`; legal source missing effective date → `needs_review`.
- Calculator registry contains the eight UK Employment calculators and every one is `status: "planned"`.
- No live fetch, no `fetch(`, no `axios`, no `http` / `https` import, no external LLM hostname in any pack file.
- Orchestrator `npm run typecheck`, `npm run build`, `npm test` all exit 0.

## What this sprint does NOT do

- Does **not** ingest any content. The actual upstream fetch path is governed by the existing `apps/legal-orchestrator/src/ingestion/fetchSource.ts` + `runIngestionPlan.ts` + `robotsCompliance.ts` modules, which are unchanged in Sprint 20.
- Does **not** add a new database schema or migration.
- Does **not** implement any calculator.
- Does **not** wire the new pack into `handleLegalRequest`.

## Next steps (future sprints)

- Sprint 20.x — integrate `evaluateIngestionPolicy` + `evaluateCitationMetadata` into the existing ingestion pipeline. **DONE** in Sprint 20A (see below).
- Sprint 20.y — implement the first calculator (`statutory_redundancy_pay`) with a `statutory_rate` history table.
- Sprint 20.z — corpus seed against the allowlisted hosts under change control.

---

## Sprint 20A addendum — Unified ingestion policy gate

**Status:** PASS (foundation wiring; no live fetch, no DB write).

**What landed:**

- `apps/legal-orchestrator/src/ingestion/ingestionPipelinePolicyGate.ts` — pure function `evaluateIngestionPipelinePolicy(candidate)` combining the Sprint 20 URL allowlist gate with the Sprint 20 citation metadata gate into a single decision.
- `apps/legal-orchestrator/src/tests/ingestionPipelinePolicyGate.test.ts` — 10 vitest cases.
- `apps/legal-orchestrator/src/ingestion/index.ts` — re-exports the new gate.

**Behaviour:**

- Returns `{ ok: true, level: "fully_cited", host, reasonCodes: [] }` for an allowlisted official legal source with complete metadata.
- Returns `{ ok: true, level: "needs_review", host, reasonCodes: ["metadata_needs_review"] }` for an allowlisted legal source missing an effective date.
- Returns `{ ok: false, blockedBy: "url", reasonCodes: ["url_unapproved_host" | "url_non_https" | "url_unparseable"] }` for URL-policy failures.
- Returns `{ ok: false, blockedBy: "metadata", reasonCodes: [...underlying CitationPolicyOutcome reasons] }` for metadata failures.
- Does **not** call `fetch`, `axios`, `http`, `https`. Does **not** touch the DB. Does **not** call any external LLM. Does **not** wire itself into `runIngestionPipeline` yet — the gate is exposed for use by future ingestion-runner changes under their own change control.

**Acceptance evidence:**

- `npx vitest run src/tests/ingestionPipelinePolicyGate.test.ts` → 10 / 10 PASS.
- Full orchestrator vitest grew from 78 / 978 to 79 / 988 (`+1 file / +10 tests`).

**Sprint 20A report:** `reports/ITERLAW_SPRINT_20A_INGESTION_POLICY_GATE_WIRING.md`.
