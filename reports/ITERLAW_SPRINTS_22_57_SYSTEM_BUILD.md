# IterLaw Sprints 22–57 — Coherent System Build

**Delivery model:** Six schema migrations (**113–117**) plus `src/coherentSystem/` (pure TypeScript APIs) and **574** new Vitest tests (migration static checks + deterministic unit suite). This is one **architectural batch** on `master` (not 36 isolated sprint commits).

## Sprint map (reference)

| Sprints | Theme | Migration | TS modules |
|--------|--------|-----------|------------|
| 22–25 | Law engine fusion, reranker v2 metrics, evidence graph | `113_sprints_22_25_law_engine.sql` | `lawEngineBand.ts`, `rerankerV2.ts` |
| 26–34 | Retrieval / HNSW / Ollama cache / streaming outbox | `114_sprints_26_34_retrieval_stack.sql` | `retrievalBand.ts` |
| 35–45 | WASM catalog + client proof cache | `115_sprints_35_45_wasm_intel.sql` | `wasmBand.ts` |
| 46–51 | Temporal case scope + access audit | `116_sprints_46_51_workspace_temporal.sql` | `workspaceTemporalBand.ts` |
| 52–57 | Document uploads / entities / chunks | `117_sprints_52_57_document_intel.sql` | `documentIntelBand.ts` |

## Schema

- **113:** `law_module_calculator_fusion_runs`, `law_module_reranker_calibration`, `evidence_chain_edges` (+ `pg_trgm` GIN on node ids).
- **114:** `retrieval_hnsw_registry`, `ollama_inference_cache`, `streaming_chunk_outbox` (BRIN on `created_at`).
- **115:** `wasm_module_registry`, `client_proof_cache`.
- **116:** `case_record_temporal_scope`, `workspace_case_access_audit`.
- **117:** `document_uploads`, `document_entities`, `document_chunks`.

RLS uses `current_user_in_workspace`, `current_user_can_write_workspace`, `current_app_user_id`, and `current_app_user_is_admin` helpers from **106**.

## Verify

`cd apps/legal-orchestrator && npm run typecheck && npm test` — expect **2011** tests (post-merge hash recorded below).

**Hash:** `2ad3237`  
**Tests:** 2011 total
