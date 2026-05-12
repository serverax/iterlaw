# Sprint 11 — Local LLM Gateway and Bounded Synthesis

## Status

Planned / In Progress

## Goal

Add a safe local LLM gateway interface for IterLaw.

The gateway will support future local model synthesis, but the default behaviour must remain disabled and safe.

## Current Position

Sprint 10 live RAG code-side is complete.

Sprint 10 operator-side is still pending until live database migrations and smoke tests are executed.

## Runtime Strategy

Sprint 11 defines a local gateway abstraction.

Supported runtime candidates:

1. Ollama
2. llama.cpp server
3. WasmEdge/WASI-NN as experimental benchmark-only path

The first implementation should use an Ollama-compatible interface because it is simplest and aligns with the current local model direction.

## Safety Rules

- Default LLM mode is disabled.
- No external LLM calls.
- No OpenAI, Anthropic, Gemini, or public provider calls.
- No legal answer without citations.
- No answer from model memory.
- No uncited legal reasoning.
- No secret or base URL leakage in `/ready`.
- No production deployment.
- No Kubernetes apply.

## Bounded Synthesis

The LLM may only draft from retrieved chunks.

If there are no retrieved chunks, return:

insufficient_sources

If citation metadata is incomplete, return:

citation_failed

If local LLM is unavailable, return:

llm_unavailable

## Benchmark Rule

No performance claim is allowed until measured.

Benchmark targets must measure:

- tokens per second
- first-token latency
- 300-token cited answer latency
- retrieval latency
- bounded synthesis latency
- total end-to-end latency
- CPU usage
- memory usage
- thermal behaviour if available

## Out of Scope

- No public SaaS launch
- No automatic model deployment
- No DSPy optimiser deployment
- No WASM inference deployment
- No TensorRT path on CPU-only i7-8700
- No synthetic scenarios in trusted legal data
- No Sprint 14 WASM implementation in this task
