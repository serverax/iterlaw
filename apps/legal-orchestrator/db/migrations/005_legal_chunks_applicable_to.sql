-- =====================================================================
-- 005_legal_chunks_applicable_to.sql
-- =====================================================================
-- Adds optional temporal end column for legal_chunks so Postgres retrieval
-- can filter with the same window as mock retrieval (effective_date +
-- applicable_to vs filters.applicable_on). Safe to run after 001.
-- No data backfill; NULL means "still in force" for temporal filters.
-- =====================================================================

ALTER TABLE legal_chunks
  ADD COLUMN IF NOT EXISTS applicable_to date;

COMMENT ON COLUMN legal_chunks.applicable_to IS
  'Last date this chunk remains in force; NULL = no upper bound. Used with effective_date and filters.applicable_on.';
