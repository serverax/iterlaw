# Sprint 19B — Postgres retrieval adapters + local benchmark readiness

## Verdict: PASS

Foundation only. `createPostgresFullTextSearch`, `createPostgresVectorSearch`, and `createPostgresRetrievalAdapters` are exported from the retrieval public surface and tested against a mock `RetrievalPort`. The benchmark harness gains an opt-in local-Postgres scenario behind `ITERLAW_BENCH_USE_LOCAL_POSTGRES=true`. No production DB. No external LLM. No speed claim.

## Files

- **New code:** `apps/legal-orchestrator/src/retrieval/postgresRetrievalAdapters.ts` (138 lines, pure adapter; mock-safe).
- **New tests:** `apps/legal-orchestrator/src/tests/postgresRetrievalAdapters.test.ts` (10 vitest cases).
- **Public re-export:** `apps/legal-orchestrator/src/retrieval/index.ts` — `createPostgresFullTextSearch`, `createPostgresVectorSearch`, `createPostgresRetrievalAdapters`, `PostgresAdapterOptions`.
- **Bench harness updated:** `scripts/bench/iterlaw-retrieval-benchmark.mjs` — optional local-Postgres scenario gated on `ITERLAW_BENCH_USE_LOCAL_POSTGRES=true`; never prints `DATABASE_URL`.
- **Docs:** `docs/iterlaw/architecture/ITERLAW_MULTI_TIER_RETRIEVAL_ENGINE.md`, `docs/iterlaw/project/09-retrieval/MULTI_TIER_RETRIEVAL_FOUNDATION.md`, `docs/iterlaw/project/09-retrieval/RETRIEVAL_BENCHMARK_HARNESS.md` — all updated.

## Behaviour contract

| Case | Result |
|---|---|
| `createPostgresFullTextSearch(undefined, opts)` → call | `[]` |
| Port returns `{ chunks: [] }` | `[]` |
| Port returns one legislation chunk | One `RetrievalCandidate` with `source_type: "statutory_source"`, `keyword_rank: 1`, `reason_codes: ["postgres_full_text_adapter"]` |
| Port returns N mixed chunks | N candidates with ascending `keyword_rank`; source-type mapping applied per chunk |
| Tier limit > port count | Returns ≤ port count |
| Hard limit set | Returns ≤ `hardLimit` even if tier limit is higher |
| Port throws (including DSN-shaped error string) | `[]` — error swallowed; no leak |
| `jurisdiction` + `topic` set in options | Forwarded to `RetrievalPort.search` |
| `createPostgresVectorSearch` | Always `[]` in this sprint (FTS-only port) |
| `createPostgresRetrievalAdapters` | Returns `{ fullTextSearch, vectorSearch }` wired to the same port |

## Test evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/postgresRetrievalAdapters.test.ts
 ✓ src/tests/postgresRetrievalAdapters.test.ts (10 tests) 13ms
 Test Files  1 passed (1)
      Tests  10 passed (10)
TEST_EXIT=0
```

Full orchestrator suite after Sprint 19B: 80 files / 998 tests PASS (was 79 / 988; +1 file / +10 tests).

## Bench evidence (mock mode)

```text
$ node scripts/bench/iterlaw-retrieval-benchmark.mjs
[BENCH] scenario:no_adapters                                                          final 0 / elapsed 1.83 ms
[BENCH] scenario:exact_short_circuit                                                  final 1 / elapsed 0.14 ms
[BENCH] scenario:full_text_plus_vector_with_trust_and_freshness_filters               final 2 / elapsed 0.34 ms
BENCH_MOCK_EXIT=0
```

When `ITERLAW_BENCH_USE_LOCAL_POSTGRES=true` is set, a fourth scenario is appended. Without `DATABASE_URL`, the underlying `PostgresRetrieval` returns `{ chunks: [], retrieval_notes: ["postgres_retrieval:db_url_missing"] }` and the planner records an empty final set. No connection string is ever printed.

## Safety verification

- New adapter file imports only types from `../rag/*` and `../intelligence/*`. It does **not** import `pg`, `node-fetch`, `axios`, `undici`, `http`, or `https`. The DB connection is owned by the upstream `RetrievalPort` instance, which itself is mock-safe.
- The thrown-error test exercises a DSN-shaped string (`"postgres://user:password@host:5432/db cannot connect"`) and asserts the adapter returns `[]`. No error message is propagated to the caller.
- The bench, when the local-Postgres scenario fails to initialise, logs only the literal string `"[BENCH] local-Postgres scenario init failed; continuing mock-only."` — no secrets.

## Production gate impact

None. Architectural / foundation progress only.

## What this sprint does NOT do

- Does **not** wire the adapters into `handleLegalRequest`. The `ITERLAW_MULTI_TIER_RETRIEVAL_ENABLED` flag still routes through `runMultiTierRetrievalGateway` in shadow-only mode without injected adapters.
- Does **not** implement a real `vectorSearch` (pgvector path). The vector adapter returns `[]` honestly.
- Does **not** assert any speed improvement.
- Does **not** call any production DB.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite.
- No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
