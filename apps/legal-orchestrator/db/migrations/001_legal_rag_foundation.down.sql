-- =====================================================================
-- 001_legal_rag_foundation.down.sql
-- =====================================================================
-- Reverse of 001_legal_rag_foundation.sql.
--
-- WARNING: destructive rollback. This drops the foundational legal RAG
-- tables and all dependent objects. Use only on disposable/dev databases
-- or after an operator-approved snapshot.
-- =====================================================================

DROP INDEX IF EXISTS legal_chunks_embedding_ivfflat_idx;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'legal_domains', 'legal_sources', 'legal_documents',
    'legal_chunks', 'legal_case_law'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON %I', t, t);
  END LOOP;
END
$$;

DROP TABLE IF EXISTS answer_audit_log CASCADE;
DROP TABLE IF EXISTS rag_query_audit CASCADE;
DROP TABLE IF EXISTS rag_ingestion_events CASCADE;
DROP TABLE IF EXISTS rag_ingestion_jobs CASCADE;
DROP TABLE IF EXISTS source_quality_scores CASCADE;
DROP TABLE IF EXISTS legislation_versions CASCADE;
DROP TABLE IF EXISTS tribunal_decisions CASCADE;
DROP TABLE IF EXISTS legal_case_law CASCADE;
DROP TABLE IF EXISTS legal_citations CASCADE;
DROP TABLE IF EXISTS legal_chunks CASCADE;
DROP TABLE IF EXISTS legal_documents CASCADE;
DROP TABLE IF EXISTS legal_sources CASCADE;
DROP TABLE IF EXISTS legal_domains CASCADE;

DROP FUNCTION IF EXISTS rag_set_updated_at();

-- End 001_legal_rag_foundation.down.sql
