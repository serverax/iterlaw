# IterLaw UK Employment Source Registry

> Foundation only. No corpus has been ingested by this sprint. No production DB write.

Implementation:

- `apps/legal-orchestrator/src/ingestion/ukEmploymentSourceRegistry.ts` — trusted-host allowlist + source categories + tier ordering.
- `apps/legal-orchestrator/src/ingestion/ingestionPolicy.ts` — pure policy gate. Refuses any URL whose host is not on the allowlist or whose protocol is not HTTPS.
- `apps/legal-orchestrator/src/ingestion/citationRegistryPolicy.ts` — pure metadata check (source_url, source_title, retrieved/verified timestamp; effective date required for legal sources).

## Trusted hosts (UK Employment)

| Host | Category | Tier | Notes |
|---|---|---|---|
| `www.legislation.gov.uk` | primary_legislation | 1 | Acts + SIs |
| `www.gov.uk` | gov_guidance | 4 | Official UK government employment guidance |
| `www.acas.org.uk` | acas_guidance | 4 | ACAS guidance + Codes of Practice |
| `www.judiciary.uk` | judiciary_guidance | 3 | Presidential Guidance (e.g. Vento bands) |
| `www.bailii.org` | court_decision | 3 | Case law archive |
| `caselaw.nationalarchives.gov.uk` | court_decision | 3 | Find Case Law (official UK judgments) |

Categories in tier order:

1. `primary_legislation`
2. `secondary_legislation`
3. `court_decision`
4. `judiciary_guidance`
5. `eat_decision`
6. `et_decision`
7. `gov_guidance`
8. `acas_guidance`
9. `statutory_rate` (only when an official source exists)

## Policy gate

`evaluateIngestionPolicy(url)`:

- returns `{ allowed: true, host }` when the URL is HTTPS and the host is on the allowlist.
- returns `{ allowed: false, reason: "unparseable_url" }` for empty / malformed URLs.
- returns `{ allowed: false, reason: "non_https" }` for `http://` URLs even on trusted hosts.
- returns `{ allowed: false, reason: "unapproved_host" }` for everything else.

Pure function. No network. No DB. No external LLM.

## Citation metadata policy

`evaluateCitationMetadata(meta)`:

- requires `source_url`, `source_title`, and one of `retrieved_at` / `verified_at`.
- legal sources additionally require `effective_from` or `effective_to`; missing → `needs_review` (not blocked, but flagged).
- returns typed `{ ok: false, reasons: [...] }` or `{ ok: true, level: "fully_cited" | "needs_review" }`.

## Unified ingestion pipeline policy gate (Sprint 20A)

`evaluateIngestionPipelinePolicy(candidate)` combines the URL-allowlist gate and the citation-metadata gate into a single decision so an ingestion runner can refuse a candidate up-front with one call:

- success → `{ ok: true, level: "fully_cited" | "needs_review", host, reasonCodes }`.
- failure at URL step → `{ ok: false, blockedBy: "url", reasonCodes: ["url_unapproved_host" | "url_non_https" | "url_unparseable"] }`.
- failure at metadata step → `{ ok: false, blockedBy: "metadata", reasonCodes: [...] }`.

Pure function. No network. No DB. No external LLM. Exported from `apps/legal-orchestrator/src/ingestion/index.ts`. 10 vitest cases at `apps/legal-orchestrator/src/tests/ingestionPipelinePolicyGate.test.ts`.

## Out of scope (deliberately)

- **No scraping or fetch is performed by this pack.** The allowlist + policy gate exist so a future ingestion sprint can implement a fetch path that the policy gate guards.
- **No production DB write.** No migration is added in Sprint 20 or Sprint 20A.
- **No claim that the corpus is ingested.** This pack lists allowed hosts and validates citation metadata; it does not ingest content.
- **Sprint 20A does not modify `runIngestionPipeline`** — the gate is exposed for downstream use; integration into the runtime ingestion runner remains a future, change-controlled sprint.
