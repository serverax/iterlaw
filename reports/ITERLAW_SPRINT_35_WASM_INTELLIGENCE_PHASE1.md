# IterLaw Sprint 35 — WASM Intelligence Phase 1 (Sandbox Setup)

## Scope

- Migration `131_sprint35_wasm_sandbox_phase1.sql` — `wasm_module_registry` sandbox schema (admin RLS policy).
- `wasmSandboxPhase1.ts` — 64 KiB memory ceiling, sandbox init, binary validation.
- `zone2WasmTypes.ts` / `zone2WasmStub.ts` — Zone 2 WASM contract + stub.
- Tests: `sprint35WasmSandboxPhase1.test.ts` (40).

**Commit (code):** 05abc2bc97b4e68e3a358fda6278d2a8bd1dfee9
