# @ordinoxai/synthesis-worker

Skeleton package for the internal synthesis worker described in
[`docs/adr/004-internal-synthesis-worker.md`](../../docs/adr/004-internal-synthesis-worker.md).

This delivery is **§10.3.a — repo skeleton** only.

## Scope of this package

What is in:

- Zod request/response schemas mirroring ADR 004 §4 (`src/types/synthesis.types.ts`)
- Pure handler that performs structural validation and a fail-closed
  stub dispatch (`src/handler.ts`)
- Queue-boundary constants and the `QueuePort` abstract interface
  (`src/queue/redisStreams.ts`)
- Vitest tests for schema parsing and handler behaviour
  (`src/tests/synthesisTypes.test.ts`, `src/tests/handler.test.ts`)

What is **not** in (separate tickets):

- Concrete model client integration → ADR §10.3 follow-up
- Concrete `QueuePort` implementation against ioredis / node-redis
  → ADR §10.3.c
- Redis StatefulSet manifest → ADR §10.3.b
- Orchestrator-side per-pod response-stream wiring → ADR §10.3.c
- `/ready` extension for `synthesis:` health → ADR §10.3.d
- Dockerfile / Kubernetes manifest / SealedSecret → operator repo

## Invariants this package enforces

1. **No model credentials at compile time or runtime.** This package has
   zero model SDK dependencies. Adding one is a separate, audited ticket.
2. **No outbound network.** No HTTP client is imported. No `fetch` call
   appears in `src/`.
3. **`.strict()` Zod parsing.** Forbidden fields (`user_id`, `ip`,
   `session`, `history`, `free_text` — ADR 004 §4.1) cause the request
   to be rejected as `malformed` before any handler logic runs.
4. **Fail-closed default.** Until the model client lands, every valid
   request is answered with `status: "model_error"`. This keeps the
   orchestrator's `citationVerifier` + `policyGate` behaviour honest
   per ADR §10.

## Running tests

```
cd apps/synthesis-worker
npm install
npm test
```

The test suite makes no network calls and does not require a Redis
instance.

## Wire contract

See ADR 004 §4 for the canonical schema. The Zod schemas in
`src/types/synthesis.types.ts` are the executable copy of that
contract; any change to either must update the other in the same
commit, and `SCHEMA_VERSION` must be bumped.
