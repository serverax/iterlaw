-- =====================================================================
-- 006_statutory_rates.down.sql
-- =====================================================================
-- Reverses 006_statutory_rates.sql. Drops only what 006 created.
-- =====================================================================

DROP INDEX IF EXISTS uk_emp_rag.uk_emp_rag_vento_band_source_idx;
DROP INDEX IF EXISTS uk_emp_rag.uk_emp_rag_vento_band_one_open_per_level_uq;
DROP TABLE IF EXISTS uk_emp_rag.vento_band;

DROP INDEX IF EXISTS uk_emp_rag.uk_emp_rag_statutory_rate_one_open_per_category_uq;
DROP INDEX IF EXISTS uk_emp_rag.uk_emp_rag_statutory_rate_source_idx;
DROP INDEX IF EXISTS uk_emp_rag.uk_emp_rag_statutory_rate_category_effective_idx;
DROP TABLE IF EXISTS uk_emp_rag.statutory_rate;
