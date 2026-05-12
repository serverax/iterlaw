# Sprint 11 — Local LLM Benchmark Execution Checklist

Status: **operator-side action pending.** The Sprint 11 gateway
foundation (types, default-disabled `describeLocalLlmGateway`, bounded
synthesis guard, `/ready` extension, repo-level safety verifier) is
landed and tested. The remaining Sprint 11 work is to **measure** —
no performance claim may enter active docs until the operator runs
this checklist and records results.

## 1. Purpose

Benchmark the local LLM gateway foundation against a real local
Ollama endpoint. Verify:

- The bounded-synthesis path produces no answer without retrieved
  citations.
- The gateway's `available=true` state path is non-crashing.
- Real first-token / total / tokens-per-second numbers are recorded
  for a 7B-class INT4/GGUF model on the available hardware.

## 2. Preconditions (must all be YES before measurement)

- [ ] Ollama is reachable from the operator workstation. Confirm
      with `curl http://localhost:11434/api/tags` returning a
      non-empty model list.
- [ ] The Ollama endpoint is **local or in-cluster only**. No
      external LLM provider URL appears in the env. `ITERLAW_LLM_GATEWAY_MODE=ollama`
      and `ITERLAW_OLLAMA_BASE_URL=http://localhost:11434`
      (or your local equivalent) are the only LLM-related env vars set.
- [ ] The model list to benchmark is recorded. Minimum: one 3B/4B
      instruct model + one 7B INT4/GGUF model.
- [ ] The citation gate in `apps/legal-orchestrator` is **on**.
      Benchmark prompts always supply retrieved chunks; benchmark
      outputs are inspected only for performance, never used as a
      legal answer.
- [ ] The benchmark must **not** change production behaviour. The
      gateway's default in `localLlmGateway.ts` remains `"disabled"`
      after the run.

## 3. Commands

```bash
# The script is currently a skeleton. Execute it to get the
# "skeleton only" banner. Replace with real measurement logic before
# claiming any number.
bash scripts/benchmarks/sprint11-local-llm-benchmark.sh

# Skeleton extension (operator-edited, NOT committed unless the
# script is hardened). Typical shape:
#
#   1. Pick a model. Warm the cache with one prompt.
#   2. For each prompt template:
#      - Record start time.
#      - Open the Ollama HTTP stream.
#      - On first chunk, record first-token latency.
#      - Count tokens until end-of-stream.
#      - Record total latency.
#   3. Compute tokens/sec.
#   4. Record CPU/MEM via `ps` or `wmic` snapshots before/after.
```

## 4. Metrics to record

For each (model, prompt) pair:

| Metric | Required? |
| --- | --- |
| Model name | yes |
| Prompt type (label) | yes |
| First-token latency (ms) | yes |
| Total latency (ms) for the full answer | yes |
| Tokens/sec (decode) | yes |
| Generated-token count | yes |
| Memory use (peak, MB, if available) | best-effort |
| CPU use (%, average over the run, if available) | best-effort |
| GPU use (only if a real GPU is used) | best-effort |
| Failure rate over N runs (N ≥ 5 per pair) | yes |
| Citation-gate result | yes — must be `synthesised` only when chunks are complete |
| Safety-gate result | yes — must be `blocked_by_policy` or `llm_unavailable` in Sprint 11 |

## 5. Output file

Record raw + summarised results in:

```
docs/benchmarks/SPRINT_11_LOCAL_LLM_BENCHMARK_RESULTS.md
```

Required sections in that file once it is written:

- Hardware + OS at run time.
- Ollama version, model list, INT4/GGUF quantisation level.
- Per-(model, prompt) table of the §4 metrics.
- A `NOT_MEASURED` line for every metric that could not be captured.
- A short narrative of the failure rate and any retry behaviour.

**Do not invent results.** If a metric is not measured, write
`NOT_MEASURED`, not zero.

## 6. Rule

If Ollama is unavailable on the operator workstation, the run is
`BLOCKED / NOT EXECUTED`. Record the reason and stop. Do not fabricate
data. Do not run against a hosted / external LLM service to fill the
gap — that violates the Sprint 11 non-negotiables.

## 7. Acceptance for Sprint 11 close-out

Sprint 11 is marked DONE only when:

- This checklist has been executed end-to-end against a real local
  Ollama.
- `docs/benchmarks/SPRINT_11_LOCAL_LLM_BENCHMARK_RESULTS.md` exists
  with at least one (model, prompt) row populated and the rest
  honestly marked `NOT_MEASURED`.
- `bash scripts/qa/verify-iterlaw-v3-safety.sh` still PASSes —
  particularly the "no unverified performance claims" check.
- No external LLM provider URL was contacted at any point.
- `localLlmGateway.ts`'s default remains `mode = "disabled"`.

## 8. Next-step (post-benchmark)

If benchmark numbers look acceptable for the use case, a follow-up
sprint can replace the `OLLAMA_UNAVAILABLE` branch in
`localLlmGateway.ts` with a real `fetch`-backed adapter — **only**
behind the citation gate and **only** through the bounded-synthesis
guard. That adapter is out of scope for Sprint 11.
