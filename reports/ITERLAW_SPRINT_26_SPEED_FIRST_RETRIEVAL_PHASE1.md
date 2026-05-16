# Sprint 26: Speed-First Retrieval Phase 1 (HNSW Setup)

**Date:** 2026-05-16

**Commit (code):** 8d537e23abfb1992121d1f6fed7d09511149f28f

**Commit (report):** `git log -1 --format=%H -- reports/ITERLAW_SPRINT_26_SPEED_FIRST_RETRIEVAL_PHASE1.md` after merge

**Tag:** sprint-26-complete

**Tests:** 42 new tests (`sprint26RetrievalHNSWPhase1.test.ts`)

**Total tests passing:** 2238

## What Was Built

### Database Migration

- File: `apps/legal-orchestrator/db/migrations/122_sprint26_retrieval_hnsw_setup.sql`
- Rollback: `apps/legal-orchestrator/db/migrations/122_sprint26_retrieval_hnsw_setup.down.sql`
- Tables: `retrieval_hnsw_lane_profiles` (lane_id, index_name, dimensions, distance, lists, m, ef_construction)
- RLS: `retrieval_hnsw_lane_profiles_admin_all` (admin-only; matches `retrieval_hnsw_registry` pattern from migration 114)
- Indexes: `idx_retrieval_hnsw_lane_profiles_index_name`
- Seed: `UK_EMP_LEGAL_CHUNKS_PRIMARY` profile row (`ON CONFLICT DO NOTHING`)

### Code Files

- New: `apps/legal-orchestrator/src/coherentSystem/zone2RetrievalTypes.ts`
- New: `apps/legal-orchestrator/src/coherentSystem/zone2RetrievalStub.ts`
- New: `apps/legal-orchestrator/src/coherentSystem/retrievalHNSWPhase1.ts` (`vectorOpClassFor`, `buildHnswCreateIndexSql`, `anonymizeRetrievalQueryHint`, `RetrievalHNSWPhase1Band`)
- Modified: `apps/legal-orchestrator/src/coherentSystem/index.ts` (exports + `retrievalHnswPhase1Band`)

### Tests

- New: `apps/legal-orchestrator/src/tests/sprint26RetrievalHNSWPhase1.test.ts`
- Test count: 42
- All tests pass: YES

## Zone Integration

- Zone 1: SQL hints for pgvector HNSW (`buildHnswCreateIndexSql`), `hnswEfSearchDefault` merge over max(Zone1 lists, Zone2 recommended lists), query anonymization before remote hints.
- Zone 2 stub: `Zone2RetrievalServiceStub.suggestRemoteHnswBuild` — deterministic `remoteIndexId`, capped `recommendedLists`, no I/O.
- Dependency injection: `RetrievalHNSWPhase1Band` accepts any `Zone2RetrievalService`.

## How This Connects

- Uses: Migration 114 `retrieval_hnsw_registry` concept; existing `hnswEfSearchDefault` in `retrievalBand.ts`.
- Builds on: pgvector / prior RAG migrations (embedding columns elsewhere).
- Enables: Sprints 27–34 retrieval phases (tuning, fusion, adapters) on top of lane profiles + Zone 2 contract.

## Test Results

npm run typecheck: 0 errors

npm test: 2238 tests passed

## Notes

Migration 114 already created `retrieval_hnsw_registry`; Sprint 26 adds **lane profiles** plus TypeScript HNSW planning helpers without altering 114 objects.
