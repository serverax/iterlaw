-- =====================================================================
-- 100_iterlaw_core_rag_foundation.down.sql
-- =====================================================================
-- Reverse of 100_iterlaw_core_rag_foundation.sql.
--
-- Migration 100 is a retained draft / compatibility shim. On the
-- approved 001-chain it must not drop canonical tables such as
-- legal_sources, legal_documents, or legal_chunks. This rollback removes
-- only draft-specific objects and additive compatibility columns/indexes.
-- =====================================================================

DROP INDEX IF EXISTS idx_legal_chunks_embedding;
DROP INDEX IF EXISTS idx_rag_runs_answer_status;
DROP INDEX IF EXISTS idx_rag_runs_legal_area;
DROP INDEX IF EXISTS idx_rag_runs_created_at;
DROP INDEX IF EXISTS idx_verified_answers_cache_question_hash;
DROP INDEX IF EXISTS idx_legal_cases_judgment_date;
DROP INDEX IF EXISTS idx_legal_cases_court;
DROP INDEX IF EXISTS idx_legal_cases_neutral_citation;
DROP INDEX IF EXISTS idx_legal_chunks_section_reference;
DROP INDEX IF EXISTS idx_legal_chunks_document_id;
DROP INDEX IF EXISTS idx_legal_documents_status;
DROP INDEX IF EXISTS idx_legal_documents_effective_dates;
DROP INDEX IF EXISTS idx_legal_documents_jurisdiction;
DROP INDEX IF EXISTS idx_legal_documents_legal_area;
DROP INDEX IF EXISTS idx_legal_documents_source_id;

DROP TABLE IF EXISTS answer_verification_log CASCADE;
DROP TABLE IF EXISTS source_update_log CASCADE;
DROP TABLE IF EXISTS rag_runs CASCADE;
DROP TABLE IF EXISTS verified_answers_cache CASCADE;

-- If migration 100 created the draft legal_cases table on a fresh
-- database, remove it. If 102 already rolled it back, this is a no-op.
DROP TABLE IF EXISTS legal_cases CASCADE;

-- Compatibility columns added by migration 100 to existing 001-chain
-- tables. These are intentionally narrower than dropping the tables.
ALTER TABLE IF EXISTS legal_cases DROP COLUMN IF EXISTS judgment_date;
ALTER TABLE IF EXISTS legal_documents DROP COLUMN IF EXISTS status;
ALTER TABLE IF EXISTS legal_documents DROP COLUMN IF EXISTS effective_to;
ALTER TABLE IF EXISTS legal_documents DROP COLUMN IF EXISTS effective_from;
ALTER TABLE IF EXISTS legal_documents DROP COLUMN IF EXISTS jurisdiction;
ALTER TABLE IF EXISTS legal_documents DROP COLUMN IF EXISTS legal_area;

-- Do not drop pgcrypto or vector extensions here. Extension lifecycle is
-- owned by prerequisite / environment migrations.

-- End 100_iterlaw_core_rag_foundation.down.sql
