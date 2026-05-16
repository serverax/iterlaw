-- =====================================================================
-- 005_legal_chunks_applicable_to.down.sql
-- =====================================================================
-- Reverse of 005_legal_chunks_applicable_to.sql.
-- =====================================================================

ALTER TABLE legal_chunks
  DROP COLUMN IF EXISTS applicable_to;

-- End 005_legal_chunks_applicable_to.down.sql
