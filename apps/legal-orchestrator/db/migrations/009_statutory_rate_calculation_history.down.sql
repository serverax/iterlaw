-- =====================================================================
-- 009_statutory_rate_calculation_history.down.sql
-- =====================================================================
-- Reverses 009. Drops indexes and table. Does NOT drop schema uk_emp_rag.
-- =====================================================================

DROP INDEX IF EXISTS uk_emp_rag.uk_emp_rag_statutory_rate_calc_hist_run_idx;
DROP INDEX IF EXISTS uk_emp_rag.uk_emp_rag_statutory_rate_calc_hist_source_idx;
DROP INDEX IF EXISTS uk_emp_rag.uk_emp_rag_statutory_rate_calc_hist_category_eff_idx;
DROP INDEX IF EXISTS uk_emp_rag.uk_emp_rag_statutory_rate_calc_hist_rate_idx;
DROP TABLE IF EXISTS uk_emp_rag.statutory_rate_calculation_history;
