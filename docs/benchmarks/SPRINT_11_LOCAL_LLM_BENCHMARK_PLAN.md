# Sprint 11 Local LLM Benchmark Plan

## Purpose

Benchmark local inference honestly before choosing a production runtime.

## Hardware Target

Initial target:

Intel i7-8700
CPU-only unless GPU is explicitly verified

## Runtime Candidates

1. Ollama
2. llama.cpp server
3. WasmEdge/WASI-NN experimental path

## Models to Benchmark

Use locally available models only.

Suggested model classes:

- 3B or 4B instruct model
- 7B INT4/GGUF model
- small reranker model if available

## Metrics

Measure:

- model load time
- first-token latency
- tokens/sec
- 300-token answer latency
- retrieval latency
- bounded synthesis latency
- end-to-end legal answer latency
- CPU usage
- memory usage
- thermal behaviour if available

## Benchmark Prompts

Use citation-bound prompts only.

Example:

Using only the supplied retrieved chunks, draft a short answer explaining notice rights. Include citations.

## Safety Rule

Benchmark answers are not legal advice.

Benchmark outputs must not be added to trusted legal data.

## Performance Rule

No performance claim may be added to project docs unless benchmark output exists.
