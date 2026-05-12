-- =====================================================================
-- 007_legal_documents_superseded_by.sql
-- =====================================================================
-- Adds temporal versioning to uk_emp_rag.legal_documents:
--   * superseded_by uuid self-FK (ON DELETE SET NULL)
--   * CHECK preventing self-supersession
--   * Tightens status from free text to ('active','superseded','withdrawn')
--     using ADD CONSTRAINT ... NOT VALID followed by VALIDATE CONSTRAINT,
--     so existing rows are surfaced (not silently masked) if any sit
--     outside the allowed set.
--
-- Status semantics:
--   active     = current law, in use
--   superseded = replaced by newer legislation (link via superseded_by)
--   withdrawn  = no longer valid, no replacement
--
-- Prerequisites: 003 (uk_emp_rag schema + legal_documents table).
-- Idempotent: ADD COLUMN IF NOT EXISTS / ADD CONSTRAINT IF NOT EXISTS.
-- No INSERTs. No scraping, no HTTP, no secrets.
-- =====================================================================

ALTER TABLE uk_emp_rag.legal_documents
  ADD COLUMN IF NOT EXISTS superseded_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uk_emp_rag_legal_documents_superseded_by_fkey'
  ) THEN
    ALTER TABLE uk_emp_rag.legal_documents
      ADD CONSTRAINT uk_emp_rag_legal_documents_superseded_by_fkey
      FOREIGN KEY (superseded_by)
      REFERENCES uk_emp_rag.legal_documents(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uk_emp_rag_legal_documents_no_self_supersede_chk'
  ) THEN
    ALTER TABLE uk_emp_rag.legal_documents
      ADD CONSTRAINT uk_emp_rag_legal_documents_no_self_supersede_chk
      CHECK (superseded_by IS NULL OR superseded_by <> id);
  END IF;
END
$$;

-- Tighten status: add CHECK as NOT VALID first so the migration applies
-- even if a stale row exists, then VALIDATE to surface bad data clearly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uk_emp_rag_legal_documents_status_chk'
  ) THEN
    ALTER TABLE uk_emp_rag.legal_documents
      ADD CONSTRAINT uk_emp_rag_legal_documents_status_chk
      CHECK (status IN ('active','superseded','withdrawn'))
      NOT VALID;
  END IF;
END
$$;

ALTER TABLE uk_emp_rag.legal_documents
  VALIDATE CONSTRAINT uk_emp_rag_legal_documents_status_chk;

-- Partial index: documents that supersede something.
CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_documents_superseded_by_idx
  ON uk_emp_rag.legal_documents(superseded_by)
  WHERE superseded_by IS NOT NULL;

-- Partial index: active documents (hot path for retrieval).
CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_documents_status_active_idx
  ON uk_emp_rag.legal_documents(status)
  WHERE status = 'active';
