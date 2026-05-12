# WASM Intelligence Architecture

How WebAssembly fits into IterLaw: as the **deterministic intelligence and orchestration layer**, not as the heavy LLM. Heavy inference stays in Ollama / vLLM / llama.cpp workers, sidecars, or shared runtime.

**Status:** target architecture. Existing WASM rule-runner is the only WASM in production today. The module set below is roadmap (Sprints 35–45).

## What WASM is for in IterLaw

| Capability | Why WASM |
| --- | --- |
| Routing | Deterministic, fast, capability-sandboxed. |
| Orchestration | Predictable control flow without process spawn. |
| Policy | Tamper-resistant policy enforcement at the edge. |
| Validation | Deterministic schema + citation validation. |
| Retrieval | Cache lookup + retrieval-router logic close to the data path. |
| Caching | In-process cache primitives with controlled memory. |
| Lightweight classification | Sub-100 ms intent / complexity classification. |
| Streaming control | Backpressure + safety-block decisions inline with the SSE stream. |

## What WASM is NOT for

- **Not** the heavy LLM. Ollama / vLLM / llama.cpp run outside WASM, in dedicated workers.
- **Not** the embedding model (initially). Run via ONNX runtime sidecar or shared runtime instead.
- **Not** unbounded I/O. WASM modules have no ambient network or filesystem.
- **Not** the citation source of truth. Citations come from the SQL retrieval result, not a WASM-internal table.

## Runtime evaluation

The runtime is **operator-deployed**. The agent does not pick a winner; the candidates are:

| Runtime | Why consider it |
| --- | --- |
| **SpinKube** | Kubernetes-native WASM workload abstraction. |
| **containerd-wasm-shim** | Run WASM modules through containerd, alongside existing containers. |
| **Wasmtime** | Bytecode Alliance reference runtime. Mature. WASI-aligned. |
| **WasmEdge** | Strong AI / ML extensions. Edge-friendly. |

Decision criteria (record evidence in the runtime evaluation report, not in this doc):

- Cold-start latency.
- Memory ceiling enforceability.
- WASI version + capability model.
- Observability hooks (metrics, traces, logs).
- Kubernetes integration.
- Multi-tenant safety.

## Deployment target

- **K3s cluster.** Operator-managed. Hetzner-hosted in the current setup.
- Canonical namespaces only: `iterlaw-ai`, `iterlaw-rag`, `iterlaw-api`, `iterlaw-monitoring`, `iterlaw-security`. **Do not introduce new namespaces.** Legacy `iterlaw-data` may remain.
- WASM modules live alongside existing services; they do not get their own namespace.
- Pod-security baseline (`runAsNonRoot`, `readOnlyRootFilesystem`, `automountServiceAccountToken: false`, `seccompProfile: RuntimeDefault`) applies to the host pod, not the WASM module itself.

## Per-module requirements

**Every WASM module** must ship with:

- **Timeout limits.** Hard kill on overrun.
- **Memory caps.** Module manifest specifies max memory; runtime enforces.
- **Observability.** Standard metric set: `module=<name>`, `latency_ms`, `outcome`, `safety_decision`, plus traces.
- **Structured logging.** JSON, with `trace_id` / `request_id` correlation; **no secret values**.
- **Tests.** Unit tests in the host language + WASM bytecode integration tests in the test harness.
- **Feature flags.** Each module is independently disable-able via the standard `ITERLAW_WASM_<MODULE>_ENABLED` env flag (default off until benchmarked).

## Planned module set

| Module | Role | Sprint |
| --- | --- | --- |
| **gateway** | Entry hop for the orchestrator. Auth check, request id, basic shape. | 36 |
| **pii_guard** | Redact PII before downstream modules see the payload. | 36 |
| **rate_limit** | Per-user + per-module rate limit; token bucket. | 36 |
| **cache_lookup** | Tier 0 / Tier 1 cache decision. Reads via host-provided cache port. | 37 |
| **retrieval_router** | Decide Tier 2 vs Tier 3 vs Tier 4 path for this question. | 37 |
| **classifier** | Lightweight intent / complexity classification. ONNX backend allowed via sidecar/shared runtime. | 38 |
| **legal_sources** | Apply the per-module legal-sources allow-list and trust tier filter. | 39 |
| **llm_router** | Choose the local model (qwen / drafting / document). Reuses Sprint 11 `modelRouter` shape. | 40 |
| **external_ai abstraction** | Surface only — no provider call. Lets a future provider be added without rewiring the orchestrator. | 41 |
| **synthesiser** | Wrap the bounded-synthesis call so the safety contract is enforced at the WASM boundary too. | 42 |
| **validator** | Citation re-verification + RAV step inline with the response. | 42 |
| **streamer** | Build SSE events from synthesised output; handle backpressure and `safety_block`. | 43 |
| **observability / cost intelligence** | Per-module cost + latency aggregation; surfaces a feedback signal to routing. | 44 |

## Production hardening

Sprint 45 covers WASM production hardening:

- Image signing for module artefacts.
- Module integrity check on load.
- Per-module memory and CPU SLO.
- Failure mode review (panic, OOM, timeout).
- Operator runbook (start, stop, drain, rollback).

## Embedding / ML model placement

- Do **not** embed huge (≥500 MB) models inside a WASM module initially. Cold-start and memory ceilings will not work.
- Use the **ONNX runtime as a sidecar** or as a **shared runtime** on the host; the WASM module calls into it via a host-port.
- Reassess once WASM runtimes provide first-class GPU / accelerator access at the size class we need.

## Boundary between WASM and the local LLM

```
              ┌─────────────────────┐
SSE stream <──│ streamer (WASM)     │
              └─────────────────────┘
                       ▲
                       │
              ┌─────────────────────┐
              │ synthesiser (WASM)  │ ── citation gate enforced in-WASM
              └─────────────────────┘
                       │
                       ▼
        ┌───────────────────────────┐
        │ Local LLM worker          │   Ollama / vLLM / llama.cpp
        │ (NOT WASM)                │   ── heavy inference, GPU-backed
        └───────────────────────────┘
```

The WASM synthesiser holds the **safety contract**; the LLM produces tokens; the WASM streamer chooses what to emit. The LLM cannot bypass the WASM safety boundary because the WASM module is what speaks to the user.

## Status

- Existing WASM rule-runner: in production (Sprint 4 deliverable).
- Module set above: **target architecture**, not implemented.
- Sprint 35 (WASM Runtime Foundation) is the first delivery step. All other WASM sprints depend on it.
- Production: **BLOCKED** for the WASM stack until Sprint 35 + 36 land and a staging benchmark is recorded.
