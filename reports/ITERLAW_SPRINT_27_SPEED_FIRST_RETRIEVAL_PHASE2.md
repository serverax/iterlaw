# Sprint 27: Speed-First Retrieval Phase 2 (Ollama Inference)

**Date:** 2026-05-16

**Commit (code):** 2d7a072281dc608b267e83128627621844e50b1d

**Commit (report):** `git log -1 --format=%H -- reports/ITERLAW_SPRINT_27_SPEED_FIRST_RETRIEVAL_PHASE2.md` after merge

**Tag:** sprint-27-complete

**Tests:** 48 new tests (`sprint27RetrievalOllamaPhase2.test.ts`)

**Total tests passing:** 2286

## What Was Built

### Database Migration

- File: `apps/legal-orchestrator/db/migrations/123_sprint27_retrieval_ollama_phase2.sql`
- Rollback: `apps/legal-orchestrator/db/migrations/123_sprint27_retrieval_ollama_phase2.down.sql`
- Tables: `retrieval_ollama_inference_cache` (user_id, optional workspace_id, model, prompt_hash, response_json, zone1_ttl_ms, zone2_ttl_ms, merged_ttl_ms, expires_at)
- RLS: `retrieval_ollama_cache_self_select`, `retrieval_ollama_cache_self_insert`, `retrieval_ollama_cache_admin_delete`
- Indexes: `idx_retrieval_ollama_cache_user_model`, `idx_retrieval_ollama_cache_expires`

### Code Files

- New: `apps/legal-orchestrator/src/coherentSystem/retrievalOllamaPhase2.ts` (`computeMergedOllamaTtlMs`, `ollamaExpiresAtIso`, `RetrievalOllamaPhase2Band`)
- Modified: `apps/legal-orchestrator/src/coherentSystem/zone2RetrievalTypes.ts` (`Zone2OllamaTtlHint`, `suggestOllamaCacheTtl` on `Zone2RetrievalService`)
- Modified: `apps/legal-orchestrator/src/coherentSystem/zone2RetrievalStub.ts` (`suggestOllamaCacheTtl` using `ollamaCacheTtlMs` minus 1h floor 60s)
- Modified: `apps/legal-orchestrator/src/coherentSystem/index.ts` (exports + `retrievalOllamaPhase2Band`)
- Modified: `apps/legal-orchestrator/src/tests/sprint26RetrievalHNSWPhase1.test.ts` (partial `Zone2RetrievalService` mocks implement `suggestOllamaCacheTtl`)

### Tests

- New: `apps/legal-orchestrator/src/tests/sprint27RetrievalOllamaPhase2.test.ts`
- Test count: 48
- All tests pass: YES

## Zone Integration

- Zone 1: `ollamaCacheTtlMs` baseline; `computeMergedOllamaTtlMs` conservative `min`; `ollamaExpiresAtIso` for `expires_at` computation in app code.
- Zone 2 stub: `suggestOllamaCacheTtl` returns deterministic shorter TTL hint (no HTTP).
- Dependency injection: `RetrievalOllamaPhase2Band` accepts any `Zone2RetrievalService`.

## How This Connects

- Uses: Sprint 26 `Zone2RetrievalService` / stub; migration 114 `ollama_inference_cache` concept (this table is Phase 2 merge-oriented).
- Builds on: `ollamaCacheTtlMs` in `retrievalBand.ts`.
- Enables: Sprints 28+ retrieval (streaming, fusion) to persist rows with merged TTL.

## Test Results

npm run typecheck: 0 errors

npm test: 2286 tests passed

## Notes

Migration 114 already defines `public.ollama_inference_cache`; Sprint 27 adds **`retrieval_ollama_inference_cache`** for merged TTL columns without altering 114.
