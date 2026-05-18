-- =====================================================================
-- 151_sprint55_document_chunks_semantic.sql
-- =====================================================================
-- Sprint 55 — Semantic chunking + pgvector embeddings (extends 117 chunks).
-- PREP: fill implementation after UAT sign-off.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS semantic_topic VARCHAR(200),
  ADD COLUMN IF NOT EXISTS legal_significance NUMERIC(3,2) CHECK (legal_significance IS NULL OR (legal_significance >= 0 AND legal_significance <= 1)),
  ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);

CREATE INDEX IF NOT EXISTS idx_document_chunks_sprint55_topic
  ON public.document_chunks (semantic_topic)
  WHERE semantic_topic IS NOT NULL;

-- IVFFlat index: requires rows; lists=100 is a prep default for implementation tuning.
CREATE INDEX IF NOT EXISTS idx_document_chunks_sprint55_embedding
  ON public.document_chunks USING ivfflat (embedding_vector vector_cosine_ops)
  WITH (lists = 100);

COMMENT ON COLUMN public.document_chunks.embedding_vector IS
  'Sprint 55 — Azure OpenAI text-embedding-3-small (1536 dims).';
