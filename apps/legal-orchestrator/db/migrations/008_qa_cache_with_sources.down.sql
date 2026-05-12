-- =====================================================================
-- 008_qa_cache_with_sources.down.sql
-- =====================================================================
-- Reverses 008. Drops indexes, trigger, join table, main table.
-- Does NOT drop schema uk_emp_rag.
-- =====================================================================

DROP INDEX IF EXISTS uk_emp_rag.uk_emp_rag_q_a_cache_sources_document_id_idx;
DROP INDEX IF EXISTS uk_emp_rag.uk_emp_rag_q_a_cache_sources_chunk_id_idx;
DROP INDEX IF EXISTS uk_emp_rag.uk_emp_rag_q_a_cache_sources_cache_id_idx;
DROP TABLE IF EXISTS uk_emp_rag.q_a_cache_sources;

DROP TRIGGER IF EXISTS uk_emp_rag_q_a_cache_set_updated_at ON uk_emp_rag.q_a_cache;

DROP INDEX IF EXISTS uk_emp_rag.uk_emp_rag_q_a_cache_jurisdiction_situation_idx;
DROP INDEX IF EXISTS uk_emp_rag.uk_emp_rag_q_a_cache_status_expires_idx;
DROP INDEX IF EXISTS uk_emp_rag.uk_emp_rag_q_a_cache_embedding_hnsw_idx;
DROP TABLE IF EXISTS uk_emp_rag.q_a_cache;
