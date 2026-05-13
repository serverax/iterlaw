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

- Sprint 20.x — integrate `evaluateIngestionPolicy` + `evaluateCitationMetadata` into the existing ingestion pipeline.
- Sprint 20.y — implement the first calculator (`statutory_redundancy_pay`) with a `statutory_rate` history table.
- Sprint 20.z — corpus seed against the allowlisted hosts under change control.
