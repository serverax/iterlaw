-- 147_sprint51_document_upload_ocr.down.sql

DROP INDEX IF EXISTS public.idx_document_uploads_sprint51_expires;
DROP INDEX IF EXISTS public.idx_document_uploads_sprint51_case;

ALTER TABLE public.document_uploads
  DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS confidence_score,
  DROP COLUMN IF EXISTS raw_text,
  DROP COLUMN IF EXISTS file_size,
  DROP COLUMN IF EXISTS file_name,
  DROP COLUMN IF EXISTS case_id;
