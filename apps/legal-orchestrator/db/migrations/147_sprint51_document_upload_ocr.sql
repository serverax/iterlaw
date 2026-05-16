-- =====================================================================
-- 147_sprint51_document_upload_ocr.sql
-- =====================================================================
-- Sprint 51 — Document upload OCR metadata (extends 117 document_uploads).
-- PREP: fill implementation after UAT sign-off.
-- =====================================================================

ALTER TABLE public.document_uploads
  ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES public.legal_case_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS file_size INT CHECK (file_size IS NULL OR file_size > 0),
  ADD COLUMN IF NOT EXISTS raw_text TEXT,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(3,2) CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours');

CREATE INDEX IF NOT EXISTS idx_document_uploads_sprint51_case
  ON public.document_uploads (case_id)
  WHERE case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_uploads_sprint51_expires
  ON public.document_uploads (expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON COLUMN public.document_uploads.raw_text IS
  'Sprint 51 — OCR output from Azure Document Intelligence.';
