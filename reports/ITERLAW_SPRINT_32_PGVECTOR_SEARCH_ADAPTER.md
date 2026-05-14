# Sprint 32 — Real pgvector vectorSearch adapter

## Verdict: PASS

Pgvector adapter delivered with a `PgvectorClient` dependency interface. Mock-safe. No production DB touched. No `DATABASE_URL` read. 11 vitest cases. The bench harness is **not** changed to enable the adapter by default — operator must supply both a client and an embedder when ready.

## Files

- `apps/legal-orchestrator/src/retrieval/pgvectorSearchAdapter.ts` — new adapter + bridge.
- `apps/legal-orchestrator/src/retrieval/index.ts` — public re-export.
- `apps/legal-orchestrator/src/tests/pgvectorSearchAdapter.test.ts` (11 cases, new).
- `docs/iterlaw/architecture/ITERLAW_MULTI_TIER_RETRIEVAL_ENGINE.md` — Sprint 32 addendum.
- `docs/iterlaw/project/09-retrieval/RETRIEVAL_BENCHMARK_HARNESS.md` — Sprint 32 paragraph.

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/pgvectorSearchAdapter.test.ts
 ✓ src/tests/pgvectorSearchAdapter.test.ts (11 tests) 29ms
TEST_EXIT=0
```

Behaviour verified:

- No client → `[]`.
- Empty embedding → `[]` (no client invocation).
- One legislation row → mapped to `statutory_source` candidate with `vector_rank: 1`.
- N rows → ascending `vector_rank`.
- `hardLimit` caps results.
- Client throw (including DSN-shaped error string) → swallowed; `[]` returned.
- `limit`, `jurisdiction`, `lawArea`, `effectiveAtIsoDate` forwarded to the client.
- Bridge: question + embedder + client → mapped candidates.
- Embedder throw → `[]`.
- No-embedder bridge → `[]`.

## Safety guarantees

- Adapter file imports zero `pg` / `node-fetch` / `axios` / `http` / `https` symbols. Connection management is owned by the upstream `PgvectorClient` instance.
- Adapter never accesses `process.env`. The string `DATABASE_URL` does not appear in the file's source.
- Client exceptions are caught and returned as `[]`; no thrown message reaches the caller.
- No production speed claim. The adapter is foundation only.

## Production gate impact

None. Architectural progress only. Not wired into `runMultiTierRetrievalGateway`.

## What this sprint does NOT do

- Does **not** wire the adapter into the planner / multi-tier gateway by default.
- Does **not** ship an embedder. The caller supplies one.
- Does **not** open a real Postgres connection in tests (all tests use mock clients).
- Does **not** print or log `DATABASE_URL`.
- Does **not** assert a production speed improvement.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
