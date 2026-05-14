# Sprint 20A — Wire ingestion policy + citation metadata policy

## Verdict: PASS

Foundation wiring only. The Sprint 20 URL allowlist gate and citation metadata gate are now combined into a single `evaluateIngestionPipelinePolicy(candidate)` function exposed from `apps/legal-orchestrator/src/ingestion/index.ts`. No live fetch. No DB write. No external LLM. No claim that the UK Employment corpus is ingested.

## Files

- **New code:** `apps/legal-orchestrator/src/ingestion/ingestionPipelinePolicyGate.ts` (101 lines, pure function).
- **New tests:** `apps/legal-orchestrator/src/tests/ingestionPipelinePolicyGate.test.ts` (10 vitest cases, 129 lines).
- **Re-export:** `apps/legal-orchestrator/src/ingestion/index.ts` — `export * from "./ingestionPipelinePolicyGate";`.
- **Docs updated:** `docs/iterlaw/project/10-ingestion/UK_EMPLOYMENT_INGESTION_PACK_FOUNDATION.md`, `docs/iterlaw/architecture/ITERLAW_UK_EMPLOYMENT_SOURCE_REGISTRY.md`.

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/ingestionPipelinePolicyGate.test.ts
 ✓ src/tests/ingestionPipelinePolicyGate.test.ts (10 tests) 11ms
 Test Files  1 passed (1)
      Tests  10 passed (10)
INGESTION_GATE_TEST_EXIT=0
```

Test cases (all PASS):

1. Allowlisted official legal source with complete metadata → `{ ok: true, level: "fully_cited" }`.
2. Legal source missing effective date → `{ ok: true, level: "needs_review", reasonCodes: ["metadata_needs_review"] }`.
3. Non-legal source missing effective date → `{ ok: true, level: "fully_cited" }`.
4. Unknown hostname → `{ ok: false, blockedBy: "url", reasonCodes: ["url_unapproved_host"] }`.
5. Non-https on allowlisted host → `{ ok: false, blockedBy: "url", reasonCodes: ["url_non_https"] }`.
6. Unparseable URL → `{ ok: false, blockedBy: "url", reasonCodes: ["url_unparseable"] }`.
7. Missing `source_url` (falls back to `url`) → `{ ok: true }` — exercises fallback path.
8. Missing `source_title` → `{ ok: false, blockedBy: "metadata", reasonCodes: [..., "missing_source_title"] }`.
9. Both `retrieved_at` and `verified_at` null → `{ ok: false, blockedBy: "metadata", reasonCodes: [..., "missing_retrieved_or_verified_timestamp"] }`.
10. 50 consecutive synchronous invocations complete without timeout — no network IO.

## Safety verification (no network, no DB, no LLM)

The new file contains no imports of `fetch`, `axios`, `http`, `https`, or any LLM provider client. It imports only `ingestionPolicy` (pure) and `citationRegistryPolicy` (pure). Direct grep:

```text
$ grep -n "from \"\\(\\.\\./\\)*\\(rag\\|llm\\|fetch\\|axios\\|node-fetch\\|undici\\)" apps/legal-orchestrator/src/ingestion/ingestionPipelinePolicyGate.ts
(empty)
```

## Production gate impact

None. Architectural / foundation progress only. The new gate is exported for future ingestion-runner integration; `runIngestionPipeline` is **not** modified in this sprint.

## What this sprint does NOT do

- Does **not** modify `runIngestionPipeline`.
- Does **not** add a DB migration.
- Does **not** call out to any network host.
- Does **not** seed any corpus.
- Does **not** mutate any source on disk.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite.
- No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
