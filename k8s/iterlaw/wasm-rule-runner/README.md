# WASM Rule Runner — Cluster bundle

This directory holds the manifest for the `iterlaw-wasm-rule-runner` ConfigMap.
That ConfigMap is mounted **read-only** at `/app/wasm-rules` inside the
`legal-orchestrator` pod.

## Adding a binary

1. Build the `.wasm` module from its source. The binary must:
   - Export a single deterministic `run` function.
   - Import only `env.memory`.
   - Make no host I/O calls.
2. Encode the binary as base64 and add it under `binaryData` in
   `configmap.yaml`. The key MUST match an allowed logical module ID from
   `infra/iterlaw/wasm-contract.md` (e.g. `deadline_calculator.wasm`).
3. Re-apply the ConfigMap. The orchestrator picks up new binaries on its
   next pod restart.

## Removing or replacing

Replacing a binary is a routine ConfigMap edit. Removing one downgrades the
runner to the TypeScript fallback — no restart strictly required, but a
restart is recommended so the audit log reflects the change cleanly.

## Forbidden

- Embedding scripts, shell binaries, or any non-`.wasm` payload.
- Storing secrets here.
- Mounting this volume read-write into any pod.
