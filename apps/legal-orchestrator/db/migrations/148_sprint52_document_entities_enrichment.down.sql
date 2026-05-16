-- 148_sprint52_document_entities_enrichment.down.sql

DROP INDEX IF EXISTS public.idx_document_entities_sprint52_type;

ALTER TABLE public.document_entities
  DROP COLUMN IF EXISTS extracted_at,
  DROP COLUMN IF EXISTS bounding_box,
  DROP COLUMN IF EXISTS page_number;
