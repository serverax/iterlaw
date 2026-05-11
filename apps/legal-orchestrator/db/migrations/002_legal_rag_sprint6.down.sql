-- =====================================================================
-- 002_legal_rag_sprint6.down.sql — rollback Sprint 6 forward migration
-- =====================================================================
-- Run ONLY after 002_legal_rag_sprint6.sql. Drops Sprint 6 objects in
-- dependency-safe order. Does NOT drop 001 tables (legal_domains, …).
-- Reversible for legal_sources CHECK: restores 001-era CHECK definition.
-- =====================================================================

DROP INDEX IF EXISTS rag_query_audit_ranking_gin_idx;

ALTER TABLE rag_query_audit DROP COLUMN IF EXISTS query_redacted;
ALTER TABLE rag_query_audit DROP COLUMN IF EXISTS final_citation_ids;
ALTER TABLE rag_query_audit DROP COLUMN IF EXISTS ranking_scores;
ALTER TABLE rag_query_audit DROP COLUMN IF EXISTS retrieved_chunk_ids;

DROP INDEX IF EXISTS legal_chunks_legal_domain_idx;
ALTER TABLE legal_chunks DROP COLUMN IF EXISTS last_checked_at;
ALTER TABLE legal_chunks DROP COLUMN IF EXISTS publication_date;
ALTER TABLE legal_chunks DROP COLUMN IF EXISTS legal_domain;
ALTER TABLE legal_chunks DROP COLUMN IF EXISTS section_heading;

DROP INDEX IF EXISTS legal_documents_version_hash_idx;
DROP INDEX IF EXISTS legal_documents_legal_domain_idx;
ALTER TABLE legal_documents DROP COLUMN IF EXISTS last_checked_at;
ALTER TABLE legal_documents DROP COLUMN IF EXISTS publication_date;
ALTER TABLE legal_documents DROP COLUMN IF EXISTS version_hash;
ALTER TABLE legal_documents DROP COLUMN IF EXISTS legal_domain;

DROP INDEX IF EXISTS legal_sources_legal_domain_idx;
ALTER TABLE legal_sources DROP COLUMN IF EXISTS legal_domain;
ALTER TABLE legal_sources DROP COLUMN IF EXISTS last_checked_at;
ALTER TABLE legal_sources DROP COLUMN IF EXISTS publication_date;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'legal_sources_source_type_chk'
  ) THEN
    ALTER TABLE legal_sources DROP CONSTRAINT legal_sources_source_type_chk;
  END IF;
END $$;

ALTER TABLE legal_sources ADD CONSTRAINT legal_sources_source_type_chk CHECK (source_type IN (
  'legislation',
  'statutory_instrument',
  'gov_guidance',
  'acas_guidance',
  'tribunal_case',
  'appeal_case',
  'case_law',
  'internal_note',
  'template'
));

-- Drop pgvector column if present (extension may still be installed).
ALTER TABLE legal_chunk_embeddings DROP COLUMN IF EXISTS embedding;

DROP INDEX IF EXISTS citation_registry_active_idx;
DROP INDEX IF EXISTS citation_registry_accessed_at_idx;
DROP INDEX IF EXISTS citation_registry_url_idx;
DROP INDEX IF EXISTS citation_registry_chunk_idx;
DROP TABLE IF EXISTS citation_registry;

DROP INDEX IF EXISTS legal_chunk_embeddings_chunk_idx;
DROP TABLE IF EXISTS legal_chunk_embeddings;

DROP INDEX IF EXISTS legal_document_versions_pub_date_idx;
DROP INDEX IF EXISTS legal_document_versions_hash_idx;
DROP INDEX IF EXISTS legal_document_versions_document_idx;
DROP TABLE IF EXISTS legal_document_versions;

DROP INDEX IF EXISTS source_fetch_audit_checksum_idx;
DROP INDEX IF EXISTS source_fetch_audit_fetched_at_idx;
DROP INDEX IF EXISTS source_fetch_audit_url_idx;
DROP INDEX IF EXISTS source_fetch_audit_domain_type_idx;
DROP INDEX IF EXISTS source_fetch_audit_job_idx;
DROP TABLE IF EXISTS source_fetch_audit;

DROP INDEX IF EXISTS ingestion_job_events_http_status_idx;
DROP INDEX IF EXISTS ingestion_job_events_created_idx;
DROP INDEX IF EXISTS ingestion_job_events_job_idx;
DROP TABLE IF EXISTS ingestion_job_events;

DROP INDEX IF EXISTS ingestion_jobs_created_at_idx;
DROP INDEX IF EXISTS ingestion_jobs_status_idx;
DROP INDEX IF EXISTS ingestion_jobs_source_type_idx;
DROP INDEX IF EXISTS ingestion_jobs_legal_domain_idx;
DROP TABLE IF EXISTS ingestion_jobs;

-- End 002_legal_rag_sprint6.down.sql
