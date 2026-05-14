# Sprint 41 — Real local embedder for vectorSearch bridge

## Verdict: PASS

`computeLocalEmbedding` + `createLocalEmbedderForVectorSearch` implemented. The embedder refuses non-local endpoints up-front (no external API call possible), enforces an explicit timeout via `AbortController`, validates dimensionality, and surfaces structured telemetry. Bridges directly into the Sprint 32 vectorSearch adapter without modifying it. 13 vitest cases.

## Files

- `apps/legal-orchestrator/src/retrieval/localEmbedder.ts` (new — pure module, no `process.env` access, no `fetch` import).
- `apps/legal-orchestrator/src/retrieval/index.ts` — public re-exports.
- `apps/legal-orchestrator/src/tests/localEmbedder.test.ts` (13 cases, new).

## Public surface

```ts
computeLocalEmbedding(text, {
  endpoint: "http://localhost:11434/api/embeddings",
  model: "nomic-embed-text",
  timeoutMs?: 5000,
  expectedDimensions?: 768,
  allowLocalHosts?: ["ollama-host"],
  transport?: LocalEmbedderTransport,
}): Promise<LocalEmbedderOutcome>
```

`LocalEmbedderTransport` is the dependency-injected fetch-like function — operator chooses their preferred transport (typically the Sprint 11 local-only transport policy). The module **imports zero HTTP libraries**.

## Refusal contract

| Condition | Outcome |
|---|---|
| `transport` not supplied | `no_transport_configured` |
| `endpoint` hostname not in `{localhost, 127.0.0.1, ::1, ...allowLocalHosts}` | `embedder_endpoint_not_local` — **transport is NOT invoked** |
| Empty / whitespace `text` | `embedder_empty_input` |
| Empty / undefined `embedding` returned | `embedder_failed` |
| `expectedDimensions` set but length mismatch | `dimensionality_mismatch` |
| Transport exceeds `timeoutMs` (via `AbortController`) | `embedder_timeout` |
| Transport throws | `embedder_failed` |
| All checks pass | `{ ok: true, embedding, telemetry: ["embedder:ok:<N>"] }` |

## Security guarantees

- **No external API call.** When the endpoint is `https://api.openai.com/...`, the embedder refuses before invoking the transport — verified by the test "never calls an external host even when supplied".
- The module does not access `process.env`. It does not import `node-fetch`, `axios`, `undici`, `http`, or `https`.
- Aborted requests are surfaced as `embedder_timeout`, not as a runtime exception.
- The bridge (`createLocalEmbedderForVectorSearch`) throws on embedder failure, but the Sprint 32 `createPgvectorSearchFromEmbedder` swallows embedder throws and returns `[]` — chain-level safe.

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/localEmbedder.test.ts
 ✓ src/tests/localEmbedder.test.ts (13 tests) 55ms
TEST_EXIT=0
```

Test coverage: happy path with localhost / 127.0.0.1 / extra-allowlisted host; refusal contract for every failure mode; AbortController timeout under 30 ms vs 200 ms delay; end-to-end bridge with the Sprint 32 pgvector adapter; security regression that a non-local endpoint never gets contacted.

## Production gate impact

None. The embedder is foundation only — operator must inject a `transport` AND wire `createLocalEmbedderForVectorSearch` into the Sprint 36 pgvector-gateway path (already flag-gated default OFF).

## What this sprint does NOT do

- Does **not** ship an HTTP transport. Operator supplies one (typically the Sprint 11 local-only transport).
- Does **not** assume Ollama is reachable. The default path returns `no_transport_configured`.
- Does **not** call any external API.
- Does **not** read `DATABASE_URL` or any secret.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
