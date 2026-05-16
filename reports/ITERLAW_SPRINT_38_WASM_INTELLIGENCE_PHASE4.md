# Sprint 38 — WASM Intelligence Phase 4 (Signed Evidence Package)

**Branch:** `feature/sprint-38-wasm-signed-package-phase4`  
**Migration:** `134_sprint38_wasm_signed_evidence_packages.sql`  
**Band:** `WasmSignedPackagePhase4Band` (`wasmSignedPackagePhase4.ts`)  
**Zone 2:** `signPackageRemote`, `verifySignatureRemote` in `zone2WasmStub.ts`  
**Tests:** `sprint38WasmSignedPackagePhase4.test.ts` — **40 passed**

## Deliverables

| Item | Status |
|------|--------|
| Table `wasm_signed_evidence_packages` (user-scoped RLS) | Migration 134 |
| `signEvidencePackage()` | Hash + remote sign stub |
| `verifySignature()` | Remote verify stub |
| `storeSignedPackage()` | In-memory store |
| Tamper detection | `detectTamper()` |

## Verification

```bash
cd apps/legal-orchestrator && npm run typecheck && npm test -- src/tests/sprint38WasmSignedPackagePhase4.test.ts
```
