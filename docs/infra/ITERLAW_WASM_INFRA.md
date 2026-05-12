# IterLaw — WASM Infrastructure

## Where WASM lives

| Layer       | Path                                              |
| ----------- | ------------------------------------------------- |
| Source      | `apps/legal-orchestrator/src/wasm/`               |
| Cluster CM  | `k8s/iterlaw/wasm-rule-runner/configmap.yaml`     |
| Mount path  | `/app/wasm-rules` (read-only)                     |
| Contract    | `infra/iterlaw/wasm-contract.md`                  |

## Source layout

```
apps/legal-orchestrator/src/wasm/
├── ruleModule.types.ts           # contracts
├── wasmRunner.ts                 # runner + audit + safety
├── rules/
│   ├── deadlineCalculator.ts     # TS fallback for the 'deadline_calculator' module
│   ├── redundancyCalculator.ts   # TS fallback for the 'redundancy_calculator' module
│   └── ventoBandSelector.ts      # TS fallback for the 'vento_band_selector' module
└── __tests__/
    └── wasmRunner.test.ts        # 13 tests covering safety, fallback, timeout
```

Additional logical modules (`nmw_rate_selector`, `citation_validator`,
`chunk_scorer`) are in the allow-list but have no implementation yet. The
runner rejects calls to any module that has not been registered.

## Cluster mount

The `iterlaw-wasm-rule-runner` ConfigMap is projected at `/app/wasm-rules`
inside the `legal-orchestrator` container. The volume is read-only and the
container's root filesystem is also read-only. WASM modules cannot write
anywhere, including `/tmp`.

## Adding a binary later

1. Build a `.wasm` whose only import is `env.memory` and whose only export
   is a deterministic `run` function. No host syscalls, no network, no FS.
2. base64-encode the binary and add it under `binaryData` in
   `k8s/iterlaw/wasm-rule-runner/configmap.yaml`. The key MUST match a
   logical module ID listed in the WASM contract.
3. `kubectl apply -f k8s/iterlaw/wasm-rule-runner/configmap.yaml` and
   restart the orchestrator pod.

If the binary fails to compile or its exported `run` is missing, the runner
silently falls back to the TypeScript implementation. The audit log will
show `backend: "fallback_ts"` for those calls.

## Runtime guarantees

- Wall-clock timeout (default 1000 ms) is enforced per call.
- Linear memory is capped at 64 pages (4 MiB) by default.
- Path resolution rejects `..` and absolute paths before any FS access.
- Module IDs are matched against a closed allow-list.
- Per-run audit entries record `external_llm_used=false` and a redacted
  result summary; raw inputs and personal data are never logged.

## What WASM is NOT

- Not a substitute for the LLM. Synthesis flows through `synthesis-worker`.
- Not a substitute for the database. Postgres remains the system of record.
- Not a substitute for Redis. Streams remain the synthesis transport.
- Not a sandbox for arbitrary user input. Inputs are validated by each
  module's `validateInput` schema before execution.
