-- =====================================================================
-- 007_legal_documents_superseded_by.down.sql
-- =====================================================================
-- Reverses 007. Drops the indexes, the CHECK + FK constraints, then the
-- superseded_by column. Does NOT drop schema uk_emp_rag.
-- =====================================================================

DROP INDEX IF EXISTS uk_emp_rag.uk_emp_rag_legal_documents_status_active_idx;
DROP INDEX IF EXISTS uk_emp_rag.uk_emp_rag_legal_documents_superseded_by_idx;

ALTER TABLE uk_emp_rag.legal_documents
  DROP CONSTRAINT IF EXISTS uk_emp_rag_legal_documents_status_chk;

ALTER TABLE uk_emp_rag.legal_documents
  DROP CONSTRAINT IF EXISTS uk_emp_rag_legal_documents_no_self_supersede_chk;

ALTER TABLE uk_emp_rag.legal_documents
  DROP CONSTRAINT IF EXISTS uk_emp_rag_legal_documents_superseded_by_fkey;

ALTER TABLE uk_emp_rag.legal_documents
  DROP COLUMN IF EXISTS superseded_by;
