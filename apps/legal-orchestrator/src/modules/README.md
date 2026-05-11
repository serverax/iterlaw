# modules/ — Mother Brain deterministic logic layer

Six pure modules that the Master Brain calls before, around, and after the
LLM. They handle everything that does NOT need a model:

| Module | Job |
|---|---|
| `ruleEngine` | Generic predicate→fact engine. Other modules call this. |
| `deadlineChecker` | Limitation period, qualifying-service, ACAS EC checks. |
| `citationVerifier` | Refuses any answer whose citations don't trace to retrieved chunks. |
| `policyGate` | Forbidden-term, emoji, missing-warning, casual-tone gate. |
| `sourceRanker` | Reorders RAG hits by authority + relevance + freshness. |
| `piiRedactor` | Email, phone, NI number, UK postcode redaction. |

## JSON contract

Each module exports **one** function with the exact shape:

```ts
function module(input: ModuleInput, ctx: LegalPackContext): ModuleOutput
```

Inputs and outputs are JSON-serialisable. The module never:

- calls the network
- calls an LLM
- reads from a database
- mutates state outside its return value

This is the contract a future Rust→WASM port must preserve.

## Why TypeScript today, WASM later

The build host running this code does not currently have a Rust + WASM
toolchain. Rather than commit unbuildable Rust source, the modules are
implemented in TypeScript with the exact JSON contracts the WASM versions
will expose. The contracts in `contracts.ts` are frozen — a Rust port
must produce/consume the same shapes byte-for-byte.

Once the toolchain is available, each module's `lib.rs` will:

```rust
#[wasm_bindgen]
pub fn run(input_json: &str) -> String {
    let input: ModuleInput = serde_json::from_str(input_json).unwrap();
    let output = module_impl(input);
    serde_json::to_string(&output).unwrap()
}
```

The TS host wrapper (not yet written) will accept either:
- `WasmModule(path_to_wasm)` — load via Wasmtime / WasmEdge bindings
- `LocalModule(import_ts_fn)` — call the in-process TS function directly

Selection is a config flag. Functionally identical to callers.

## Performance budget

All six modules MUST respond in **< 50ms for normal payloads** (defined by
their unit tests). TS implementations clear this with headroom — Rust→WASM
will be faster, not slower. See `src/tests/module_perf.test.ts`.

## Legal-pack awareness

Every module receives a `LegalPackContext` with the ruleset for the
current jurisdiction. `legal-packs/uk_employment.ts` is the live UK
ruleset; `legal-packs/se_employment.ts` is the empty Sweden placeholder
that demonstrates the shape. Adding Sweden = editing one file.

## What this directory does NOT contain

- **Rust source.** Will be added when (a) a Rust toolchain is available
  and (b) we have agreed on per-module Cargo crate layout.
- **Wasmtime / WasmEdge host wrappers.** Same reason.
- **HTTP service wrappers.** The cluster Pods `rule-engine-wasm`,
  `citation-verifier-wasm`, `policy-gate-wasm` on the OrdinoxAI cluster
  are out of my reach until I have a kubeconfig for master-of-brains.
  The TS modules here can be served via the existing legal-orchestrator
  HTTP server, OR via separate one-per-module SpinApps once the Rust
  port is built.
