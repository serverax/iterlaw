-- =====================================================================
-- 009_statutory_rate_calculation_history.sql
-- =====================================================================
-- Audit trail for statutory_rate (created in 006). Slowly-changing-dimension
-- Type 2: each rate change inserts a new row with effective_from set and
-- effective_to NULL; when the rate is later replaced, the predecessor row's
-- effective_to is updated to mark the close of its window.
--
-- No superseded_by_run_id: the "what replaced me" link is the next history
-- row whose effective_from equals this row's effective_to. ingestion_run_id
-- on each row already points back to the run that created the record.
--
-- The unit CHECK is imported from 006 so the audit table cannot record a
-- unit the live table would reject.
--
-- Prerequisites: 003 (legal_documents, legal_ingestion_runs), 006 (statutory_rate).
-- Idempotent: CREATE TABLE IF NOT EXISTS.
-- No INSERTs. No scraping, no HTTP, no secrets.
-- =====================================================================

CREATE TABLE IF NOT EXISTS uk_emp_rag.statutory_rate_calculation_history (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  statutory_rate_id     uuid NOT NULL REFERENCES uk_emp_rag.statutory_rate(id) ON DELETE RESTRICT,
  source_document_id    uuid REFERENCES uk_emp_rag.legal_documents(id) ON DELETE SET NULL,
  ingestion_run_id      uuid REFERENCES uk_emp_rag.legal_ingestion_runs(id) ON DELETE SET NULL,

  rate_category         text NOT NULL,
  previous_value        numeric,
  new_value             numeric NOT NULL,
  currency              text NOT NULL DEFAULT 'GBP',
  unit                  text NOT NULL,

  effective_from        date NOT NULL,
  effective_to          date,

  change_reason         text,
  -- Soft pointer (no FK until a user/auditor table exists).
  changed_by            uuid,

  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uk_emp_rag_statutory_rate_calc_hist_unit_chk CHECK (unit IN (
    'GBP',
    'GBP_PER_HOUR',
    'GBP_PER_WEEK',
    'WEEKS',
    'PERCENT'
  )),
  CONSTRAINT uk_emp_rag_statutory_rate_calc_hist_window_chk CHECK (
    effective_to IS NULL OR effective_to > effective_from
  )
);

-- "All history rows for this rate"
CREATE INDEX IF NOT EXISTS uk_emp_rag_statutory_rate_calc_hist_rate_idx
  ON uk_emp_rag.statutory_rate_calculation_history(statutory_rate_id);

-- "Current rate by category" — partial, because effective_to IS NULL is the hot path.
CREATE INDEX IF NOT EXISTS uk_emp_rag_statutory_rate_calc_hist_category_eff_idx
  ON uk_emp_rag.statutory_rate_calculation_history(rate_category, effective_from)
  WHERE effective_to IS NULL;

-- "Trace this rate back to the source document"
CREATE INDEX IF NOT EXISTS uk_emp_rag_statutory_rate_calc_hist_source_idx
  ON uk_emp_rag.statutory_rate_calculation_history(source_document_id);

-- "Which rates did this ingestion run create?"
CREATE INDEX IF NOT EXISTS uk_emp_rag_statutory_rate_calc_hist_run_idx
  ON uk_emp_rag.statutory_rate_calculation_history(ingestion_run_id);
