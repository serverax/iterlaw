-- =====================================================================
-- 148_sprint52_document_entities_enrichment.sql
-- =====================================================================
-- Sprint 52 — Entity extraction enrichment (extends 117 document_entities).
-- PREP: fill implementation after UAT sign-off.
-- =====================================================================

ALTER TABLE public.document_entities
  ADD COLUMN IF NOT EXISTS page_number INT CHECK (page_number IS NULL OR page_number >= 0),
  ADD COLUMN IF NOT EXISTS bounding_box JSONB,
  ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_document_entities_sprint52_type
  ON public.document_entities (entity_type, upload_id);

COMMENT ON TABLE public.document_entities IS
  'Sprint 52 — Extracted entities (person, date, amount, clause, reference).';
