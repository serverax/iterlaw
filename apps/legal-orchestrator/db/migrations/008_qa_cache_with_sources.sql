-- =====================================================================
-- 008_qa_cache_with_sources.sql
-- =====================================================================
-- Semantic Q&A cache + join table linking each cached answer to the
-- source chunks / documents it was built from.
--
-- Tables:
--   uk_emp_rag.q_a_cache         (one row per cached answer)
--   uk_emp_rag.q_a_cache_sources (join — mirrors legal_answer_evidence)
--
-- Embeddings: mirrors the Sprint 9 pattern. embedding_jsonb is the
-- always-present fallback; embedding_vector vector(1536) + HNSW index
-- are added conditionally if the pgvector extension is installed.
-- Reason for HNSW (not ivfflat): q_a_cache is write-hot — new cached
-- answers arrive on every uncached question; HNSW handles incremental
-- inserts without list re-tuning.
--
-- legal_reviewer_id is a soft pointer (no FK) until a reviewer table
-- exists; application code validates at insert.
--
-- q_a_cache_sources mirrors uk_emp_rag.legal_answer_evidence exactly:
-- both chunk_id and document_id are nullable with ON DELETE SET NULL.
-- There is NO CHECK requiring one to be set, because Postgres applies
-- SET NULL before re-evaluating CHECKs and the constraint would block
-- legitimate cascades. The "at least one source" invariant is enforced
-- by application code.
--
-- Prerequisites: 003 (uk_emp_rag schema, legal_documents,
-- legal_document_chunks, trigger function uk_emp_rag_set_updated_at).
-- Idempotent: CREATE TABLE IF NOT EXISTS, conditional vector ALTER.
-- No INSERTs. No scraping, no HTTP, no secrets.
-- =====================================================================

CREATE TABLE IF NOT EXISTS uk_emp_rag.q_a_cache (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  question_text               text NOT NULL,
  -- Always-present embedding storage (works without pgvector).
  embedding_jsonb             jsonb NOT NULL DEFAULT '[]'::jsonb,

  answer_law_section          text NOT NULL,
  answer_meaning              text NOT NULL,
  answer_action               text NOT NULL,

  jurisdiction                text NOT NULL DEFAULT 'UK',
  situation_type              text,

  confidence_score            numeric NOT NULL,
  requires_solicitor_review   boolean NOT NULL DEFAULT false,
  -- Soft pointer; no FK until reviewer table exists.
  legal_reviewer_id           uuid,
  legal_review_date           timestamptz,

  source_type                 text NOT NULL,
  legislation_version         text,

  expires_at                  date NOT NULL,
  hit_count                   integer NOT NULL DEFAULT 0,
  last_served_at              timestamptz,

  status                      text NOT NULL DEFAULT 'draft',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uk_emp_rag_q_a_cache_status_chk CHECK (status IN (
    'draft',
    'approved',
    'withdrawn'
  )),
  CONSTRAINT uk_emp_rag_q_a_cache_confidence_chk CHECK (
    confidence_score >= 0 AND confidence_score <= 1
  )
);

-- Optional pgvector column + HNSW index (added only if extension is installed).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    EXECUTE 'ALTER TABLE uk_emp_rag.q_a_cache ADD COLUMN IF NOT EXISTS embedding_vector vector(1536)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS uk_emp_rag_q_a_cache_embedding_hnsw_idx
             ON uk_emp_rag.q_a_cache USING hnsw (embedding_vector vector_cosine_ops)';
    RAISE NOTICE 'Sprint 11/008: pgvector present — q_a_cache.embedding_vector + HNSW added.';
  ELSE
    RAISE NOTICE 'Sprint 11/008: pgvector not installed — using embedding_jsonb. Run CREATE EXTENSION vector; then re-apply for HNSW.';
  END IF;
END
$$;

-- Partial index: serving-time lookup (only approved, non-expired rows).
CREATE INDEX IF NOT EXISTS uk_emp_rag_q_a_cache_status_expires_idx
  ON uk_emp_rag.q_a_cache(status, expires_at)
  WHERE status = 'approved';

-- Filter by jurisdiction + situation_type.
CREATE INDEX IF NOT EXISTS uk_emp_rag_q_a_cache_jurisdiction_situation_idx
  ON uk_emp_rag.q_a_cache(jurisdiction, situation_type);

DROP TRIGGER IF EXISTS uk_emp_rag_q_a_cache_set_updated_at ON uk_emp_rag.q_a_cache;
CREATE TRIGGER uk_emp_rag_q_a_cache_set_updated_at
  BEFORE UPDATE ON uk_emp_rag.q_a_cache
  FOR EACH ROW EXECUTE FUNCTION uk_emp_rag_set_updated_at();


CREATE TABLE IF NOT EXISTS uk_emp_rag.q_a_cache_sources (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  q_a_cache_id      uuid NOT NULL REFERENCES uk_emp_rag.q_a_cache(id) ON DELETE CASCADE,
  -- Both source FKs nullable with ON DELETE SET NULL to mirror
  -- uk_emp_rag.legal_answer_evidence. No CHECK requiring one to be set
  -- (would block legitimate cascading deletes). Application code enforces.
  chunk_id          uuid REFERENCES uk_emp_rag.legal_document_chunks(id) ON DELETE SET NULL,
  document_id       uuid REFERENCES uk_emp_rag.legal_documents(id) ON DELETE SET NULL,
  relevance_score   numeric,
  used_in_answer    boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uk_emp_rag_q_a_cache_sources_cache_id_idx
  ON uk_emp_rag.q_a_cache_sources(q_a_cache_id);
CREATE INDEX IF NOT EXISTS uk_emp_rag_q_a_cache_sources_chunk_id_idx
  ON uk_emp_rag.q_a_cache_sources(chunk_id);
CREATE INDEX IF NOT EXISTS uk_emp_rag_q_a_cache_sources_document_id_idx
  ON uk_emp_rag.q_a_cache_sources(document_id);
