-- =====================================================================
-- 003_legal_rag_sprint9_uk_employment_core.sql
-- =====================================================================
-- Sprint 9 — UK Employment Law RAG: production-oriented registry + document
-- store + chunk + embeddings + citations + ingestion audit + answer evidence.
--
-- Physical placement: schema `uk_emp_rag` so these relations coexist with
-- legacy `public.legal_*` objects from 001/002 (same logical names, different
-- namespace). Application code should qualify: uk_emp_rag.legal_sources, etc.
--
-- Prerequisites: PostgreSQL 13+ (gen_random_uuid). Optional: pgvector
-- extension for optional `embedding_vector` column on legal_chunk_embeddings.
-- Without pgvector, embeddings are stored in `embedding_jsonb` (numeric array).
--
-- Idempotent: CREATE IF NOT EXISTS, guarded ALTERs. No data scraping.
-- No secrets, no DATABASE_URL, no external API calls.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS uk_emp_rag;

-- ---------------------------------------------------------------------
-- updated_at helper (self-contained; does not depend on 001)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION uk_emp_rag_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------
-- 1) legal_sources — trusted source registry
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uk_emp_rag.legal_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  source_type     text NOT NULL,
  base_url        text NOT NULL,
  jurisdiction    text NOT NULL DEFAULT 'UK',
  trust_level     text NOT NULL,
  enabled         boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_emp_rag_legal_sources_source_type_chk CHECK (source_type IN (
    'legislation',
    'gov_guidance',
    'acas_guidance',
    'tribunal_decision',
    'eat_decision',
    'hmcts_guidance',
    'trusted_secondary_source'
  )),
  CONSTRAINT uk_emp_rag_legal_sources_trust_level_chk CHECK (trust_level IN (
    'primary_law',
    'official_guidance',
    'tribunal_authority',
    'secondary_guidance'
  ))
);

CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_sources_source_type_idx
  ON uk_emp_rag.legal_sources(source_type);
CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_sources_enabled_idx
  ON uk_emp_rag.legal_sources(enabled) WHERE enabled = true;

DROP TRIGGER IF EXISTS uk_emp_rag_legal_sources_set_updated_at ON uk_emp_rag.legal_sources;
CREATE TRIGGER uk_emp_rag_legal_sources_set_updated_at
  BEFORE UPDATE ON uk_emp_rag.legal_sources
  FOR EACH ROW EXECUTE FUNCTION uk_emp_rag_set_updated_at();


-- ---------------------------------------------------------------------
-- 2) legal_documents — imported / scraped pages, acts, judgments
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uk_emp_rag.legal_documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id           uuid NOT NULL REFERENCES uk_emp_rag.legal_sources(id) ON DELETE RESTRICT,
  title               text NOT NULL,
  canonical_url       text NOT NULL,
  document_type       text NOT NULL,
  topic               text,
  jurisdiction        text NOT NULL DEFAULT 'UK',
  published_at        timestamptz,
  updated_at_source   timestamptz,
  scraped_at          timestamptz,
  content_hash        text NOT NULL,
  raw_text            text,
  raw_html            text,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  status              text NOT NULL DEFAULT 'active',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_emp_rag_legal_documents_url_hash_uq UNIQUE (canonical_url, content_hash)
);

CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_documents_source_idx
  ON uk_emp_rag.legal_documents(source_id);
CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_documents_status_idx
  ON uk_emp_rag.legal_documents(status);

DROP TRIGGER IF EXISTS uk_emp_rag_legal_documents_set_updated_at ON uk_emp_rag.legal_documents;
CREATE TRIGGER uk_emp_rag_legal_documents_set_updated_at
  BEFORE UPDATE ON uk_emp_rag.legal_documents
  FOR EACH ROW EXECUTE FUNCTION uk_emp_rag_set_updated_at();


-- ---------------------------------------------------------------------
-- 3) legal_document_chunks — RAG chunks + citation metadata
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uk_emp_rag.legal_document_chunks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id        uuid NOT NULL REFERENCES uk_emp_rag.legal_documents(id) ON DELETE CASCADE,
  chunk_index        integer NOT NULL,
  heading_path       text[],
  section_reference  text,
  chunk_text         text NOT NULL,
  token_count        integer,
  citation_label     text,
  citation_url       text,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_emp_rag_legal_document_chunks_doc_idx_uq UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_document_chunks_document_idx
  ON uk_emp_rag.legal_document_chunks(document_id);
CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_document_chunks_section_ref_idx
  ON uk_emp_rag.legal_document_chunks(section_reference);
CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_document_chunks_citation_label_idx
  ON uk_emp_rag.legal_document_chunks(citation_label);
CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_document_chunks_chunk_text_fts_idx
  ON uk_emp_rag.legal_document_chunks
  USING gin (to_tsvector('english', coalesce(chunk_text, '')));


-- ---------------------------------------------------------------------
-- 4) legal_chunk_embeddings — vectors when pgvector exists; jsonb fallback
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uk_emp_rag.legal_chunk_embeddings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id             uuid NOT NULL REFERENCES uk_emp_rag.legal_document_chunks(id) ON DELETE CASCADE,
  embedding_model      text NOT NULL,
  embedding_dimensions integer,
  -- Fallback when pgvector is not installed: store embedding as JSON array of numbers.
  embedding_jsonb      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_chunk_embeddings_chunk_idx
  ON uk_emp_rag.legal_chunk_embeddings(chunk_id);

-- Optional pgvector column (same relation name as logical model; qualified by schema).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    EXECUTE 'ALTER TABLE uk_emp_rag.legal_chunk_embeddings ADD COLUMN IF NOT EXISTS embedding_vector vector(1536)';
    RAISE NOTICE 'Sprint 9: pgvector present — uk_emp_rag.legal_chunk_embeddings.embedding_vector added.';
  ELSE
    RAISE NOTICE 'Sprint 9: pgvector not installed — use embedding_jsonb for vectors until CREATE EXTENSION vector; then re-run optional ALTER.';
  END IF;
END
$$;


-- ---------------------------------------------------------------------
-- 5) legal_citations — normalized citations
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uk_emp_rag.legal_citations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id        uuid NOT NULL REFERENCES uk_emp_rag.legal_documents(id) ON DELETE CASCADE,
  chunk_id           uuid REFERENCES uk_emp_rag.legal_document_chunks(id) ON DELETE SET NULL,
  citation_type      text NOT NULL,
  citation_text      text NOT NULL,
  neutral_citation   text,
  statute_title      text,
  section_reference  text,
  case_name          text,
  court_or_tribunal  text,
  decision_date      date,
  url                text,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_emp_rag_legal_citations_type_chk CHECK (citation_type IN (
    'statute',
    'regulation',
    'case',
    'tribunal_decision',
    'acas_guidance',
    'gov_guidance'
  ))
);

CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_citations_document_idx
  ON uk_emp_rag.legal_citations(document_id);
CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_citations_chunk_idx
  ON uk_emp_rag.legal_citations(chunk_id);


-- ---------------------------------------------------------------------
-- 6) legal_ingestion_runs — audit each import / scraper run
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uk_emp_rag.legal_ingestion_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id           uuid REFERENCES uk_emp_rag.legal_sources(id) ON DELETE SET NULL,
  run_type            text NOT NULL,
  status              text NOT NULL,
  started_at          timestamptz NOT NULL DEFAULT now(),
  finished_at         timestamptz,
  documents_found     integer NOT NULL DEFAULT 0,
  documents_created   integer NOT NULL DEFAULT 0,
  documents_updated   integer NOT NULL DEFAULT 0,
  chunks_created        integer NOT NULL DEFAULT 0,
  errors_count          integer NOT NULL DEFAULT 0,
  error_summary         text,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_ingestion_runs_source_idx
  ON uk_emp_rag.legal_ingestion_runs(source_id);
CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_ingestion_runs_status_idx
  ON uk_emp_rag.legal_ingestion_runs(status);


-- ---------------------------------------------------------------------
-- 7) legal_answer_evidence — evidence rows per answer request
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uk_emp_rag.legal_answer_evidence (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        text NOT NULL,
  chunk_id          uuid REFERENCES uk_emp_rag.legal_document_chunks(id) ON DELETE SET NULL,
  document_id       uuid REFERENCES uk_emp_rag.legal_documents(id) ON DELETE SET NULL,
  relevance_score   numeric,
  used_in_answer    boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_answer_evidence_request_idx
  ON uk_emp_rag.legal_answer_evidence(request_id);
CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_answer_evidence_chunk_idx
  ON uk_emp_rag.legal_answer_evidence(chunk_id);
CREATE INDEX IF NOT EXISTS uk_emp_rag_legal_answer_evidence_document_idx
  ON uk_emp_rag.legal_answer_evidence(document_id);

-- End of 003_legal_rag_sprint9_uk_employment_core.sql
