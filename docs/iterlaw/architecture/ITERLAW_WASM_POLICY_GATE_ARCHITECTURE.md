# IterLaw WASM Policy Gate — Architecture

> Status: Architecture target. No live WASM is loaded by Sprint 14. The
> existing `apps/legal-orchestrator/src/wasm` host already runs
> Wasmtime for deterministic legal-rule checks; the policy gate
> described below is an additional, smaller surface that ships in a
> later sprint.

## 0. Why WASM (and where it does NOT belong)

WASM is the right host for small, deterministic, fast safety checks
that run on every request:

- permission checks (workspace isolation, tenant isolation),
- approval rule enforcement,
- pricing / cost rules,
- RAG source-policy enforcement,
- PII detection,
- output safety gates (PII scrub, profanity, jailbreak signatures),
- tool-permission gates (which MCP tools can an agent call?),
- agent-action validation (is the requested action allowed?).

WASM is the WRONG host for:

- the main LLM inference (too big, too slow for WASM),
- vector search,
- network calls,
- secret material.

## 1. Logical flow

```
LLM suggests an action
  → WASM policy gate evaluates the action
      → policy modules:
          - permission check
          - workspace isolation
          - approval-required matrix
          - pricing / cost rule
          - PII / safety gate
          - tool permission
          - agent-action validator
  → if all-clear: OrchestrAI executes
  → if risky:     approval queue / refusal envelope
```

The decision is binary at the gate level (`allowed` / `denied`) with
a structured reason payload that the controller surfaces in the
response envelope (without breaking the `/ready` contract).

## 2. Boundary with the Intelligence Layer

The Intelligence Gateway (`intelligenceGateway.ts`) produces an
evidence pack and a decision (`proceed | block | needs_review |
insufficient_sources`).

The WASM policy gate runs AFTER the Intelligence Gateway has produced
evidence and AFTER the model has produced a candidate action /
answer. It vets the action against tenant + permission + safety
rules.

```
Intelligence Gateway → model router → model → WASM policy gate
                                     ↓
                                 candidate action
                                     ↓
                                 gate verdict
                                     ↓
                          allowed → controller executes
                          denied  → refusal envelope
```

## 3. Module surface (target)

Files (deferred; do NOT create in Sprint 14):

```
apps/legal-orchestrator/src/wasm/policy/
  permissionGate.wat         (or .rs compiled to .wasm)
  workspaceIsolationGate.*
  approvalMatrixGate.*
  piiGate.*
  toolPermissionGate.*
  agentActionValidatorGate.*
  policyGateHost.ts          (TypeScript host that loads + invokes
                              compiled .wasm; reuses the existing
                              wasm host pattern at
                              apps/legal-orchestrator/src/wasm/)
```

## 4. Hard rules

- Every gate runs in a sandbox with no network, no filesystem, no
  clock beyond what the host injects.
- Every gate accepts an immutable input record and returns one of
  `{allowed: true}` or `{allowed: false, reason_codes: string[]}`.
- The host enforces a hard timeout (e.g. 100 ms total budget).
- No gate may read environment variables.
- No gate may read or print secrets.
- The host's audit envelope must include each gate's reason codes,
  redacted by the existing `redactLlmAuditEvent` machinery.

## 5. Hand-off contract for the Intelligence Layer

The Intelligence Gateway emits `IntelligenceResult.evidence` plus a
trace. The WASM policy gate ingests:

- the workspace + user identity,
- the proposed action,
- (optional) the evidence pack the action is grounded on.

If the action is "answer a legal question", the WASM gates relevant
here are: workspace isolation, PII gate, output-safety gate. If the
action is "execute tool X", tool-permission and agent-action
validator gates apply too.

## 6. Sprint 14 deliverable

This document. No WASM binary, no `.wat`, no host loader. The
existing `apps/legal-orchestrator/src/wasm/` skeleton remains the
home for the deterministic rule-runner already used by Sprint 1–11.
The new policy-gate WASM modules ship in a later sprint with their
own ADR.
