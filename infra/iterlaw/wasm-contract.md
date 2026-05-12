# IterLaw — WASM Contract

## Purpose

WASM is used by IterLaw **only** for deterministic legal rule execution. It is
not a replacement for the LLM, the database, Redis, or Kubernetes.

## Allowed modules

The following logical modules MAY be backed by `.wasm` binaries. They are the
only `module_id` values accepted by `apps/legal-orchestrator/src/wasm/`:

| Logical module ID         | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `deadline_calculator`     | UK/SE limitation-window calculator.                |
| `redundancy_calculator`   | Statutory redundancy pay calculation.              |
| `nmw_rate_selector`       | National Minimum Wage rate selection.              |
| `vento_band_selector`     | Vento injury-to-feelings band selection.           |
| `citation_validator`      | Validates a citation string against allow-rules.   |
| `chunk_scorer`            | Pure scoring of a retrieval chunk.                 |

Any other ID is rejected at the runner boundary.

## Load surface

- WASM binaries live under `/app/wasm-rules/` in the
  `legal-orchestrator` pod. The path is read-only and backed by a
  `ConfigMap` projected via `subPath` (binaries only — no scripts).
- The runner allow-lists relative paths. Path traversal is rejected.

## Runtime constraints

| Constraint           | Setting                                       |
| -------------------- | --------------------------------------------- |
| Network              | Forbidden. No host import provides a socket.  |
| Filesystem write     | Forbidden. The mount is read-only.            |
| Wall-clock timeout   | Default 1000 ms per call.                     |
| Linear memory cap    | Default 64 pages (4 MiB).                     |
| Imports              | `env.memory` only.                            |

## Fallback

Every allowed module ships a deterministic TypeScript fallback in
`apps/legal-orchestrator/src/wasm/rules/`. When the `.wasm` binary is
absent or fails to compile, the runner uses the fallback transparently and
records `backend: "fallback_ts"` in the audit log.

## Audit

Per execution, the runner appends a `RuleAuditEntry`:

```json
{
  "module_id": "deadline_calculator",
  "backend": "wasm" | "fallback_ts",
  "duration_ms": 4,
  "result_summary": "deadline_calculator:uk_ew:status=imminent:days=6:window=91",
  "external_llm_used": false,
  "timed_out": false
}
```

`result_summary` is intentionally redacted: numbers, categorical results, and
module identifiers only. No personal data of the caller is recorded.

## Hard rules

- No LLM call from a WASM module. WASM modules are pure functions.
- No HTTP / Redis / Postgres client may be linked into a WASM rule.
- WASM is **not** a code execution sandbox for arbitrary user input. Inputs
  are validated against a per-module schema before execution.
