-- =====================================================================
-- 102_add_legal_cases_table.down.sql
-- =====================================================================
-- Reverse of 102_add_legal_cases_table.sql.
--
-- WARNING: destructive rollback for the canonical case-law ingestion
-- table. Use only after snapshot / operator approval.
-- =====================================================================

DROP INDEX IF EXISTS idx_legal_cases_metadata_gin;
DROP INDEX IF EXISTS idx_legal_cases_document_id;
DROP INDEX IF EXISTS idx_legal_cases_source_id;
DROP INDEX IF EXISTS idx_legal_cases_source_provider;
DROP INDEX IF EXISTS idx_legal_cases_decision_date;
DROP INDEX IF EXISTS idx_legal_cases_court;
DROP INDEX IF EXISTS idx_legal_cases_neutral_citation;

DROP TABLE IF EXISTS public.legal_cases CASCADE;

-- End 102_add_legal_cases_table.down.sql
