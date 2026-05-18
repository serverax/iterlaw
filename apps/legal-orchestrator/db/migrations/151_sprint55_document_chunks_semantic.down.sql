-- 151_sprint55_document_chunks_semantic.down.sql

DROP INDEX IF EXISTS public.idx_document_chunks_sprint55_embedding;
DROP INDEX IF EXISTS public.idx_document_chunks_sprint55_topic;

ALTER TABLE public.document_chunks
  DROP COLUMN IF EXISTS embedding_vector,
  DROP COLUMN IF EXISTS legal_significance,
  DROP COLUMN IF EXISTS semantic_topic;
